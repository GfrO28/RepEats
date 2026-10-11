import { estimateKcalFromMacros, isKcalConsistent, type NutritionValues } from './foodNutrition'

// Un producto tal como lo entrega Open Food Facts, ya limpio y por 100 g
export interface ScannedProduct {
  barcode: string
  name: string // puede venir vacío: en OFF muchos productos no tienen nombre
  brand: string | null
  per100g: NutritionValues | null // null si faltan datos; en ese caso "partial" trae lo que sí vino
  partial: Partial<NutritionValues>
  servingGrams: number | null
}

export type ProductLookup =
  | { status: 'found'; product: ScannedProduct }
  | { status: 'notFound' } // OFF no conoce ese código

// La búsqueda puede fallar por falta de conexión o porque OFF no responde
export type ProductLookupResult = ProductLookup | { status: 'error' }

const KJ_PER_KCAL = 4.184
const round2 = (value: number) => Math.round(value * 100) / 100

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// OFF entrega números, pero a veces como texto ("12.5"); lo demás se descarta
function toAmount(value: unknown): number | null {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof number === 'number' && Number.isFinite(number) && number >= 0 ? number : null
}

function firstBrand(brands: unknown): string | null {
  if (typeof brands !== 'string') return null
  const first = brands.split(',')[0]?.trim() ?? ''
  return first === '' ? null : first
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return ''
}

// Convierte la respuesta de GET /api/v2/product/{código} (con status 0 = no existe)
export function parseOpenFoodFactsResponse(json: unknown, barcode: string): ProductLookup {
  if (!isRecord(json) || json.status !== 1 || !isRecord(json.product)) return { status: 'notFound' }
  const product = json.product
  const nutriments = isRecord(product.nutriments) ? product.nutriments : {}

  const proteinG = toAmount(nutriments['proteins_100g'])
  const fatG = toAmount(nutriments['fat_100g'])
  const carbsG = toAmount(nutriments['carbohydrates_100g'])
  const kcalField = toAmount(nutriments['energy-kcal_100g'])
  const kjField = toAmount(nutriments['energy-kj_100g'] ?? nutriments['energy_100g'])
  const kcalFromKj = kjField === null ? null : kjField / KJ_PER_KCAL

  // Las kcal de OFF a veces están mal tecleadas mientras los kJ están bien (o al revés): si las kcal no cuadran
  // con los macros pero los kJ sí, se usan los kJ
  let kcal = kcalField ?? kcalFromKj
  if (kcal !== null && proteinG !== null && fatG !== null && carbsG !== null && kcalFromKj !== null) {
    const macros = { proteinG, fatG, carbsG }
    if (!isKcalConsistent({ kcal, ...macros }) && isKcalConsistent({ kcal: kcalFromKj, ...macros })) kcal = kcalFromKj
  }

  const partial: Partial<NutritionValues> = {}
  if (kcal !== null) partial.kcal = round2(kcal)
  if (proteinG !== null) partial.proteinG = proteinG
  if (fatG !== null) partial.fatG = fatG
  if (carbsG !== null) partial.carbsG = carbsG

  const servingQuantity = toAmount(product.serving_quantity)

  return {
    status: 'found',
    product: {
      barcode,
      name: firstText(product.product_name_es, product.product_name),
      brand: firstBrand(product.brands),
      per100g:
        partial.kcal !== undefined && proteinG !== null && fatG !== null && carbsG !== null
          ? { kcal: partial.kcal, proteinG, fatG, carbsG }
          : null,
      partial,
      servingGrams: servingQuantity !== null && servingQuantity > 0 ? servingQuantity : null,
    },
  }
}

// OFF es colaborativa: antes de guardar hay que revisar que los datos no sean absurdos
export type ProductDataIssue = 'macrosExceed100' | 'kcalMismatch'

export function findProductDataIssue(per100g: NutritionValues): ProductDataIssue | null {
  if (per100g.proteinG + per100g.fatG + per100g.carbsG > 100) return 'macrosExceed100'
  if (!isKcalConsistent(per100g)) return 'kcalMismatch'
  return null
}

// Texto listo para mostrar
export function describeProductDataIssue(issue: ProductDataIssue, per100g: NutritionValues): string {
  if (issue === 'macrosExceed100') {
    return 'Proteína, grasa y carbohidratos suman más de 100 g por cada 100 g: hay un error en esos datos.'
  }
  return `Las kcal no coinciden con lo que suman los macros (unas ${Math.round(estimateKcalFromMacros(per100g))} kcal): hay un error en esos datos.`
}
