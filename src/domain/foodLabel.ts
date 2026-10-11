import type { Food } from '@/repositories/FoodRepository'
import type { NutritionValues } from './foodNutrition'

const round2 = (value: number) => Math.round(value * 100) / 100

// La etiqueta de un producto puede dar los valores "por 100 g" o "por porción de X g".
// Se guardan siempre por 100 g, así que aquí se convierte. basisGrams debe ser mayor que 0 (lo valida el formulario).
// Los productos líquidos vienen "por 100 ml": se toman como 100 g (para leche o jugos el error es de ~3 %).
export function convertLabelToPer100g(labelValues: NutritionValues, basisGrams: number): NutritionValues {
  if (!(basisGrams > 0)) throw new RangeError('basisGrams debe ser mayor que 0')
  const factor = 100 / basisGrams
  return {
    kcal: round2(labelValues.kcal * factor),
    proteinG: round2(labelValues.proteinG * factor),
    fatG: round2(labelValues.fatG * factor),
    carbsG: round2(labelValues.carbsG * factor),
  }
}

// Código de barras GTIN (EAN-8, UPC-12, EAN-13 o GTIN-14): solo dígitos y con el dígito de control correcto.
// El dígito de control atrapa la mayoría de errores al teclear el código a mano.
export function isValidBarcode(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false

  const digits = code.split('').map(Number)
  const checkDigit = digits.pop() as number
  // De derecha a izquierda (sin contar el dígito de control) los pesos alternan 3, 1, 3, 1...
  const sum = digits.reduceRight((total, digit, index) => {
    const positionFromRight = digits.length - index
    return total + digit * (positionFromRight % 2 === 1 ? 3 : 1)
  }, 0)

  return (10 - (sum % 10)) % 10 === checkDigit
}

// El alimento que ya tiene ese código (para avisar de repetidos y, más adelante, al escanear)
export function findFoodByBarcode(foods: readonly Food[], barcode: string, excludedId: string | null = null): Food | null {
  if (barcode === '') return null
  return foods.find((food) => food.barcode === barcode && food.id !== excludedId) ?? null
}
