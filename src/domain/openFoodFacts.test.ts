import { describe, it, expect } from 'vitest'
import { parseOpenFoodFactsResponse, findProductDataIssue, describeProductDataIssue } from './openFoodFacts'

const CODE = '7750182007269'

const response = (product: Record<string, unknown>) => ({ status: 1, product })

const yogurt = {
  product_name: 'Yogurt',
  product_name_es: 'Yogurt natural',
  brands: 'Gloria, Otra marca',
  serving_quantity: 120,
  nutriments: { 'energy-kcal_100g': 61, proteins_100g: 3.5, fat_100g: 3.3, carbohydrates_100g: 4.7 },
}

describe('parseOpenFoodFactsResponse', () => {
  it('convierte un producto completo', () => {
    const result = parseOpenFoodFactsResponse(response(yogurt), CODE)
    expect(result).toEqual({
      status: 'found',
      product: {
        barcode: CODE,
        name: 'Yogurt natural',
        brand: 'Gloria',
        per100g: { kcal: 61, proteinG: 3.5, fatG: 3.3, carbsG: 4.7 },
        partial: { kcal: 61, proteinG: 3.5, fatG: 3.3, carbsG: 4.7 },
        servingGrams: 120,
      },
    })
  })

  it('un código que OFF no conoce (status 0) es "notFound"', () => {
    expect(parseOpenFoodFactsResponse({ code: CODE, status: 0 }, CODE)).toEqual({ status: 'notFound' })
  })

  it('una respuesta que no es un objeto reconocible es "notFound", sin lanzar errores', () => {
    expect(parseOpenFoodFactsResponse(null, CODE)).toEqual({ status: 'notFound' })
    expect(parseOpenFoodFactsResponse('hola', CODE)).toEqual({ status: 'notFound' })
    expect(parseOpenFoodFactsResponse({ status: 1 }, CODE)).toEqual({ status: 'notFound' })
  })

  it('prefiere el nombre en español y, si falta, usa el genérico', () => {
    const generic = { ...yogurt, product_name_es: '  ' }
    const result = parseOpenFoodFactsResponse(response(generic), CODE)
    expect(result.status === 'found' && result.product.name).toBe('Yogurt')
  })

  it('sin nombre ni marca deja el nombre vacío y la marca en null', () => {
    const result = parseOpenFoodFactsResponse(response({ nutriments: yogurt.nutriments }), CODE)
    expect(result.status === 'found' && result.product.name).toBe('')
    expect(result.status === 'found' && result.product.brand).toBeNull()
  })

  it('si faltan macros, per100g es null y "partial" conserva lo que sí vino', () => {
    const product = { ...yogurt, nutriments: { 'energy-kcal_100g': 61, proteins_100g: 3.5 } }
    const result = parseOpenFoodFactsResponse(response(product), CODE)
    expect(result.status === 'found' && result.product.per100g).toBeNull()
    expect(result.status === 'found' && result.product.partial).toEqual({ kcal: 61, proteinG: 3.5 })
  })

  it('acepta números que vienen como texto y descarta los negativos o inválidos', () => {
    const product = {
      ...yogurt,
      nutriments: { 'energy-kcal_100g': '61', proteins_100g: '3.5', fat_100g: -1, carbohydrates_100g: 'mucho' },
    }
    const result = parseOpenFoodFactsResponse(response(product), CODE)
    expect(result.status === 'found' && result.product.partial).toEqual({ kcal: 61, proteinG: 3.5 })
  })

  it('sin kcal usa los kJ (kJ / 4.184)', () => {
    const product = { ...yogurt, nutriments: { 'energy-kj_100g': 255, proteins_100g: 3.5, fat_100g: 3.3, carbohydrates_100g: 4.7 } }
    const result = parseOpenFoodFactsResponse(response(product), CODE)
    expect(result.status === 'found' && result.product.per100g?.kcal).toBe(60.95)
  })

  it('si las kcal no cuadran con los macros pero los kJ sí, usa los kJ', () => {
    // kcal 20 está mal tecleado; 1355 kJ = 324 kcal cuadra con 8 g carbohidratos + 31 g grasa
    const product = {
      nutriments: { 'energy-kcal_100g': 20, 'energy-kj_100g': 1355, proteins_100g: 0, fat_100g: 31, carbohydrates_100g: 8 },
    }
    const result = parseOpenFoodFactsResponse(response(product), CODE)
    expect(result.status === 'found' && result.product.per100g?.kcal).toBe(323.85)
  })

  it('si tampoco los kJ cuadran, deja las kcal tal cual para que se avise del error', () => {
    const product = {
      nutriments: { 'energy-kcal_100g': 20, 'energy-kj_100g': 84, proteins_100g: 0, fat_100g: 31, carbohydrates_100g: 8 },
    }
    const result = parseOpenFoodFactsResponse(response(product), CODE)
    expect(result.status === 'found' && result.product.per100g?.kcal).toBe(20)
  })

  it('la porción debe ser mayor que 0', () => {
    const result = parseOpenFoodFactsResponse(response({ ...yogurt, serving_quantity: 0 }), CODE)
    expect(result.status === 'found' && result.product.servingGrams).toBeNull()
  })
})

describe('findProductDataIssue', () => {
  it('datos coherentes no tienen problema', () => {
    expect(findProductDataIssue({ kcal: 61, proteinG: 3.5, fatG: 3.3, carbsG: 4.7 })).toBeNull()
  })

  it('detecta macros que suman más de 100 g', () => {
    expect(findProductDataIssue({ kcal: 500, proteinG: 60, fatG: 30, carbsG: 30 })).toBe('macrosExceed100')
  })

  it('detecta kcal que no cuadran con los macros', () => {
    const values = { kcal: 20, proteinG: 0, fatG: 31, carbsG: 8 }
    expect(findProductDataIssue(values)).toBe('kcalMismatch')
    expect(describeProductDataIssue('kcalMismatch', values)).toContain('311')
  })
})
