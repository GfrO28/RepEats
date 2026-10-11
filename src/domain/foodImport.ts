import type { Food, FoodUnit } from '@/repositories/FoodRepository'
import { estimateKcalFromMacros, isKcalConsistent } from './foodNutrition'
import { isValidBarcode } from './foodLabel'

// Un alimento importado: solo datos nutricionales. El id, el favorito y el uso se asignan al guardar
export type FoodDraft = Omit<Food, 'id' | 'isFavorite' | 'useCount' | 'useCountByMeal' | 'lastUsedAt' | 'recipe'>

export interface ImportIssue {
  position: number // posición del alimento en el archivo, empezando en 1
  name: string
  message: string
}

export interface FoodImportResult {
  foods: FoodDraft[] // válidos, listos para guardar
  errors: ImportIssue[] // rechazados
  duplicates: ImportIssue[] // omitidos porque ya existen (en la base o antes en el mismo archivo)
  warnings: ImportIssue[] // se importan, pero conviene revisarlos
  fatalError: string | null // el archivo completo no se pudo leer
}

export const MAX_IMPORT_FOODS = 2000 // las Tablas Peruanas completas son ~1100 alimentos

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

// Para comparar nombres ignorando mayúsculas, tildes y espacios repetidos ("Plátano" = "platano")
export function normalizeFoodName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

function parseEntry(entry: unknown): { food: FoodDraft; warning: string | null } | { error: string } {
  if (!isRecord(entry)) return { error: 'no es un objeto { ... }' }

  const { name, kcal, proteinG, fatG, carbsG, unit, prepared } = entry

  if (typeof name !== 'string' || name.trim() === '') return { error: '"name" debe ser un texto no vacío' }
  if (prepared !== undefined && typeof prepared !== 'boolean') return { error: '"prepared" debe ser true o false' }
  // Marca y código de barras son opcionales; el código se guarda solo con dígitos
  if (entry.brand !== undefined && typeof entry.brand !== 'string') return { error: '"brand" debe ser un texto' }
  if (entry.barcode !== undefined && typeof entry.barcode !== 'string') {
    return { error: '"barcode" debe ser un texto entre comillas (así no se pierden los ceros iniciales)' }
  }
  const brand = entry.brand ?? ''
  const barcode = (entry.barcode ?? '').trim()
  if (barcode !== '' && !isValidBarcode(barcode)) return { error: `"barcode" ${barcode} no es un código de barras válido` }
  if (!isAmount(kcal)) return { error: '"kcal" debe ser un número mayor o igual a 0' }
  if (!isAmount(proteinG)) return { error: '"proteinG" debe ser un número mayor o igual a 0' }
  if (!isAmount(fatG)) return { error: '"fatG" debe ser un número mayor o igual a 0' }
  if (!isAmount(carbsG)) return { error: '"carbsG" debe ser un número mayor o igual a 0' }

  const macrosTotal = proteinG + fatG + carbsG
  if (macrosTotal > 100) {
    return { error: `proteína + grasa + carbohidratos suman ${macrosTotal} g; no pueden superar 100 g por cada 100 g` }
  }

  let parsedUnit: FoodUnit | null = null
  if (unit !== undefined && unit !== null) {
    if (!isRecord(unit)) return { error: '"unit" debe ser { "label": texto, "grams": número } o null' }
    const { label, grams } = unit
    if (typeof label !== 'string' || label.trim() === '' || typeof grams !== 'number' || !Number.isFinite(grams) || grams <= 0) {
      return { error: '"unit" debe tener "label" (texto no vacío) y "grams" (número mayor a 0)' }
    }
    parsedUnit = { label: label.trim(), grams }
  }

  // Aviso (no bloquea): las kcal deberían ser parecidas a 4·proteína + 4·carbohidratos + 9·grasa
  const per100g = { kcal, proteinG, fatG, carbsG }
  const warning = isKcalConsistent(per100g)
    ? null
    : `las ${kcal} kcal no coinciden con lo que suman sus macros (unas ${Math.round(estimateKcalFromMacros(per100g))} kcal); revisa los datos`

  return {
    food: {
      name: name.trim(),
      brand: brand.trim() === '' ? null : brand.trim(),
      barcode: barcode === '' ? null : barcode,
      source: 'import',
      per100g,
      unit: parsedUnit,
      isPreparedDish: prepared === true,
    },
    warning,
  }
}

// Acepta { "foods": [ ... ] } o directamente una lista [ ... ]
export function parseFoodImport(text: string, existingNames: readonly string[]): FoodImportResult {
  const result: FoodImportResult = { foods: [], errors: [], duplicates: [], warnings: [], fatalError: null }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ...result, fatalError: 'El texto no es un JSON válido. Revisa las comas, las comillas y las llaves.' }
  }

  let entries: unknown[] | null = null
  if (Array.isArray(parsed)) {
    entries = parsed
  } else if (isRecord(parsed) && Array.isArray(parsed['foods'])) {
    entries = parsed['foods']
  }

  if (entries === null) return { ...result, fatalError: 'No se encontró la lista. Debe ser { "foods": [ ... ] }.' }
  if (entries.length === 0) return { ...result, fatalError: 'La lista "foods" está vacía.' }
  if (entries.length > MAX_IMPORT_FOODS) {
    return { ...result, fatalError: `Hay ${entries.length} alimentos; el máximo por importación es ${MAX_IMPORT_FOODS}.` }
  }

  const existing = new Set(existingNames.map(normalizeFoodName))
  const seenInFile = new Set<string>()

  entries.forEach((entry, index) => {
    const position = index + 1
    const displayName = isRecord(entry) && typeof entry['name'] === 'string' ? entry['name'] : '(sin nombre)'

    const parsedEntry = parseEntry(entry)
    if ('error' in parsedEntry) {
      result.errors.push({ position, name: displayName, message: parsedEntry.error })
      return
    }

    const key = normalizeFoodName(parsedEntry.food.name)
    if (existing.has(key)) {
      result.duplicates.push({ position, name: displayName, message: 'ya existe un alimento con ese nombre' })
      return
    }
    if (seenInFile.has(key)) {
      result.duplicates.push({ position, name: displayName, message: 'está repetido en este archivo' })
      return
    }

    seenInFile.add(key)
    result.foods.push(parsedEntry.food)
    if (parsedEntry.warning) result.warnings.push({ position, name: displayName, message: parsedEntry.warning })
  })

  return result
}
