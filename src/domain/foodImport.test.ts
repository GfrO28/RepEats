import { describe, it, expect } from 'vitest'
import exampleFile from '../../docs/seed-data/alimentos-ejemplo.json?raw'
import tpcaFile from '../../docs/seed-data/tpca-2023-alimentos.json?raw'
import platosFile from '../../docs/seed-data/tpca-2023-platos.json?raw'
import { parseFoodImport, normalizeFoodName, MAX_IMPORT_FOODS } from './foodImport'

const rice = { name: 'Arroz blanco cocido', kcal: 130, proteinG: 2.7, fatG: 0.3, carbsG: 28 }

function importText(foods: unknown[], existing: string[] = []) {
  return parseFoodImport(JSON.stringify({ foods }), existing)
}

describe('normalizeFoodName', () => {
  it('ignora mayúsculas, tildes y espacios repetidos', () => {
    expect(normalizeFoodName('  Plátano   MADURO ')).toBe('platano maduro')
  })
})

describe('parseFoodImport: archivo completo', () => {
  it('un texto que no es JSON es un error fatal', () => {
    const result = parseFoodImport('{ foods: [', [])
    expect(result.fatalError).not.toBeNull()
    expect(result.foods).toEqual([])
  })

  it('un JSON sin la lista foods es un error fatal', () => {
    expect(parseFoodImport('{ "alimentos": [] }', []).fatalError).not.toBeNull()
    expect(parseFoodImport('"hola"', []).fatalError).not.toBeNull()
  })

  it('una lista vacía es un error fatal', () => {
    expect(importText([]).fatalError).not.toBeNull()
  })

  it('más del máximo permitido es un error fatal', () => {
    const tooMany = Array.from({ length: MAX_IMPORT_FOODS + 1 }, (_, i) => ({ ...rice, name: `Alimento ${i}` }))
    expect(importText(tooMany).fatalError).not.toBeNull()
  })

  it('acepta también una lista directa, sin el objeto { foods }', () => {
    const result = parseFoodImport(JSON.stringify([rice]), [])
    expect(result.fatalError).toBeNull()
    expect(result.foods).toHaveLength(1)
  })
})

describe('parseFoodImport: alimentos válidos', () => {
  it('convierte un alimento al formato de la app, con la unidad en null si no viene', () => {
    const result = importText([rice])
    expect(result.errors).toEqual([])
    expect(result.foods).toEqual([
      {
        name: 'Arroz blanco cocido',
        brand: null,
        barcode: null,
        source: 'import',
        per100g: { kcal: 130, proteinG: 2.7, fatG: 0.3, carbsG: 28 },
        unit: null,
        isPreparedDish: false,
      },
    ])
  })

  it('lee la marca y el código de barras opcionales', () => {
    const result = importText([{ ...rice, name: 'Leche entera', brand: ' Gloria ', barcode: '7750182007269' }])
    expect(result.errors).toEqual([])
    expect(result.foods[0]).toMatchObject({ brand: 'Gloria', barcode: '7750182007269' })
  })

  it('rechaza un código de barras inválido o que no sea texto', () => {
    const result = importText([
      { ...rice, name: 'A', barcode: '7750182007268' },
      { ...rice, name: 'B', barcode: 7750182007269 },
      { ...rice, name: 'C', brand: 5 },
    ])
    expect(result.foods).toEqual([])
    expect(result.errors).toHaveLength(3)
  })

  it('lee la marca "prepared" de los platos de restaurante; sin ella no es plato preparado', () => {
    const result = importText([{ ...rice, name: 'Lomo saltado', prepared: true }, { ...rice, name: 'Arroz', prepared: false }, rice])
    expect(result.foods.map((f) => f.isPreparedDish)).toEqual([true, false, false])
  })

  it('rechaza una marca "prepared" que no sea true o false', () => {
    const result = importText([{ ...rice, prepared: 'si' }])
    expect(result.errors[0]?.message).toContain('prepared')
  })

  it('lee la unidad y limpia los espacios de los textos', () => {
    const result = importText([{ ...rice, name: '  Huevo  ', unit: { label: ' huevo ', grams: 50 } }])
    expect(result.foods[0]?.name).toBe('Huevo')
    expect(result.foods[0]?.unit).toEqual({ label: 'huevo', grams: 50 })
  })

  it('acepta unit: null y valores en cero (agua)', () => {
    const result = importText([{ name: 'Agua', kcal: 0, proteinG: 0, fatG: 0, carbsG: 0, unit: null }])
    expect(result.errors).toEqual([])
    expect(result.foods).toHaveLength(1)
  })

  it('acepta un aceite con 100 g de grasa (el límite exacto)', () => {
    const result = importText([{ name: 'Aceite', kcal: 900, proteinG: 0, fatG: 100, carbsG: 0 }])
    expect(result.errors).toEqual([])
  })
})

describe('parseFoodImport: errores por alimento', () => {
  it('rechaza el que falla, importa el resto e indica la posición', () => {
    const result = importText([rice, { name: 'Roto', kcal: 'mucho', proteinG: 1, fatG: 1, carbsG: 1 }, { ...rice, name: 'Fideos' }])
    expect(result.foods.map((f) => f.name)).toEqual(['Arroz blanco cocido', 'Fideos'])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatchObject({ position: 2, name: 'Roto' })
    expect(result.errors[0]?.message).toContain('kcal')
  })

  it('rechaza números negativos, en texto o ausentes', () => {
    const result = importText([
      { ...rice, name: 'A', proteinG: -1 },
      { ...rice, name: 'B', fatG: '0.3' },
      { name: 'C', kcal: 100, proteinG: 1, fatG: 1 },
    ])
    expect(result.foods).toEqual([])
    expect(result.errors.map((e) => e.position)).toEqual([1, 2, 3])
  })

  it('rechaza un nombre vacío o ausente', () => {
    const result = importText([{ ...rice, name: '   ' }, { kcal: 1, proteinG: 0, fatG: 0, carbsG: 0 }])
    expect(result.errors).toHaveLength(2)
    expect(result.errors[1]?.name).toBe('(sin nombre)')
  })

  it('rechaza los que no son objetos', () => {
    expect(importText([42, null, 'arroz']).errors).toHaveLength(3)
  })

  it('rechaza macros que suman más de 100 g', () => {
    const result = importText([{ name: 'Imposible', kcal: 500, proteinG: 60, fatG: 30, carbsG: 20 }])
    expect(result.errors[0]?.message).toContain('100 g')
  })

  it('rechaza una unidad incompleta o con gramos en cero', () => {
    const result = importText([
      { ...rice, name: 'A', unit: { label: 'taza' } },
      { ...rice, name: 'B', unit: { label: 'taza', grams: 0 } },
      { ...rice, name: 'C', unit: 'taza' },
    ])
    expect(result.errors).toHaveLength(3)
  })
})

describe('parseFoodImport: repetidos', () => {
  it('omite los que ya existen, sin distinguir mayúsculas ni tildes', () => {
    const result = importText([{ ...rice, name: 'PLÁTANO' }, { ...rice, name: 'Fideos' }], ['platano'])
    expect(result.foods.map((f) => f.name)).toEqual(['Fideos'])
    expect(result.duplicates).toMatchObject([{ position: 1, message: 'ya existe un alimento con ese nombre' }])
  })

  it('omite el segundo cuando el mismo nombre viene dos veces en el archivo', () => {
    const result = importText([rice, { ...rice, name: 'arroz blanco COCIDO' }])
    expect(result.foods).toHaveLength(1)
    expect(result.duplicates[0]?.message).toContain('repetido')
  })
})

describe('archivo de ejemplo documentado', () => {
  it('docs/seed-data/alimentos-ejemplo.json se importa completo, sin errores ni avisos', () => {
    const result = parseFoodImport(exampleFile, [])
    expect(result.fatalError).toBeNull()
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
    expect(result.foods).toHaveLength(8)
  })
})

describe('Tablas Peruanas (generadas con scripts/tpca-to-json.py)', () => {
  it('se importan completas: sin errores ni repetidos, y con alimentos conocidos', () => {
    const result = parseFoodImport(tpcaFile, [])
    expect(result.fatalError).toBeNull()
    expect(result.errors).toEqual([])
    expect(result.duplicates).toEqual([])
    expect(result.foods).toHaveLength(1123)

    // Valores tomados de la tabla impresa (pág. 16 y 76): arroz pilado cocido y queso fresco de vaca
    expect(result.foods.find((f) => f.name === 'Arroz pilado o pulido cocido')?.per100g).toEqual({
      kcal: 115,
      proteinG: 2.4,
      fatG: 0.1,
      carbsG: 25.2,
    })
    expect(result.foods.find((f) => f.name === 'Queso fresco de vaca')?.per100g).toEqual({
      kcal: 265,
      proteinG: 17.2,
      fatG: 20.2,
      carbsG: 3.6,
    })
  })
})

describe('Platos preparados de las Tablas Peruanas (grupo S)', () => {
  const foodNames = () => parseFoodImport(tpcaFile, []).foods.map((f) => f.name)

  it('se importan completos: 567 platos, sin errores ni repetidos ni avisos de kcal', () => {
    const result = parseFoodImport(platosFile, [])
    expect(result.fatalError).toBeNull()
    expect(result.errors).toEqual([])
    expect(result.duplicates).toEqual([])
    expect(result.warnings).toEqual([])
    expect(result.foods).toHaveLength(567)
  })

  it('todos van marcados como plato preparado, y ningún alimento de las tablas lo está', () => {
    expect(parseFoodImport(platosFile, []).foods.every((f) => f.isPreparedDish)).toBe(true)
    expect(parseFoodImport(tpcaFile, []).foods.some((f) => f.isPreparedDish)).toBe(false)
  })

  it('promedian los estratos: Aguadito de pollo = media de sus 5 versiones', () => {
    // kcal 38, 43, 45, 41, 45 -> 42; proteína 2.0, 2.9, 2.4, 2.3, 2.3 -> 2.4 (págs. 106 de la tabla)
    const dish = parseFoodImport(platosFile, []).foods.find((f) => f.name === 'Aguadito de pollo (restaurante)')
    expect(dish?.per100g).toMatchObject({ kcal: 42, proteinG: 2.4, fatG: 0.9 })
  })

  it('un mismo nombre en entradas y segundos se distingue: dos cebiches', () => {
    const names = parseFoodImport(platosFile, []).foods.map((f) => f.name)
    expect(names).toContain('Cebiche de pescado (entrada) (restaurante)')
    expect(names).toContain('Cebiche de pescado (segundo) (restaurante)')
  })

  it('no chocan con los alimentos: se pueden importar ambos archivos', () => {
    const afterFoods = parseFoodImport(platosFile, foodNames())
    expect(afterFoods.duplicates).toEqual([])
    expect(afterFoods.foods).toHaveLength(567)
  })
})

describe('parseFoodImport: avisos', () => {
  it('avisa, pero importa, cuando las kcal no coinciden con los macros', () => {
    // 10 g de proteína + 10 g de carbohidratos + 5 g de grasa ≈ 125 kcal, no 900
    const result = importText([{ name: 'Dudoso', kcal: 900, proteinG: 10, fatG: 5, carbsG: 10 }])
    expect(result.foods).toHaveLength(1)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]?.position).toBe(1)
  })

  it('no avisa cuando las kcal son coherentes', () => {
    expect(importText([rice]).warnings).toEqual([])
  })

  it('no avisa por diferencias pequeñas (fibra, redondeo)', () => {
    // 4*2 + 4*20 + 9*1 = 97; con 110 kcal la diferencia es 13, dentro de la tolerancia
    expect(importText([{ name: 'Verdura', kcal: 110, proteinG: 2, fatG: 1, carbsG: 20 }]).warnings).toEqual([])
  })
})
