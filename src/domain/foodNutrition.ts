export interface NutritionValues {
  kcal: number
  proteinG: number
  fatG: number
  carbsG: number
}

export function calculatePortionNutrition(per100g: NutritionValues, grams: number): NutritionValues {
  return { 
    kcal: per100g.kcal * grams / 100,
    proteinG: per100g.proteinG * grams / 100,
    fatG: per100g.fatG * grams / 100,
    carbsG: per100g.carbsG * grams / 100
  }
}

// kcal que "deberían" tener los macros (Atwater: 4 kcal/g proteína y carbohidratos, 9 kcal/g grasa)
export function estimateKcalFromMacros(values: NutritionValues): number {
  return 4 * values.proteinG + 4 * values.carbsG + 9 * values.fatG
}

// Las kcal de una etiqueta rara vez coinciden al kcal exacto (redondeos, fibra, alcoholes),
// así que se tolera el mayor entre 25 kcal y un 20 %
export function isKcalConsistent(values: NutritionValues): boolean {
  const tolerance = Math.max(25, 0.2 * values.kcal)
  return Math.abs(values.kcal - estimateKcalFromMacros(values)) <= tolerance
}

export function sumNutrition(items: NutritionValues[]): NutritionValues {
  // TODO: reduce con valor inicial en ceros
  return items.reduce(
    (total, item) => ({
        kcal: total.kcal + item.kcal,
        proteinG: total.proteinG + item.proteinG,
        fatG: total.fatG + item.fatG,
        carbsG: total.carbsG + item.carbsG
    }),
    { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 }
  )
}

export function calculateProgressRatio(consumed: number, target: number): number {
  // TODO: 0 si target es 0; nunca más de 1
  if(target===0){
    return 0
  } else {
    return Math.min(1, (consumed/target))
  }
}
