import { describe, it, expect } from 'vitest'
import {
  calculateTargetCalories,
  calculateMacros,
  calculateWeeklyRateKg,
  clampWeeklyRatePercent,
  clampTargetCalories,
  calculatePhasePlan,
  recalculatePhaseTarget,
  isValidTransitionWeeks,
  buildTransitionSchedule,
  getTransitionWeek,
  adjustMacrosToCalories,
  resolvePhaseTargets,
  distributeMealTargets,
  type PhasePlanInput,
} from './nutritionGoals'

const basePlanInput: PhasePlanInput = {
  type: 'deficit',
  weeklyRatePercent: 0.5,
  weightKg: 80,
  tdee: 2759,
  proteinPerKg: 1.8,
  fatPerKg: 0.8,
}

describe('calculateTargetCalories', () => {
  it('calcular kcal objetivo en déficit', () => {
    // TODO: calculateTargetCalories(2759, -0.5) → 2209
    const result = calculateTargetCalories(2759, -0.5)
    expect(result).toBe(2209)
  })
})

describe('calculateMacros', () => {
  it('calcular macros a partir de las kcal objetivo', () => {
    // TODO: calculateMacros(2209, 80, 1.8, 0.8) →
    // proteinG: 144, fatG: 64, carbsG: 264.25
    const result = calculateMacros(2209, 80, 1.8, 0.8)
    expect(result).toEqual({ proteinG: 144, fatG: 64, carbsG: 264.25 })

  })
})

describe('calculateWeeklyRateKg', () => {
  it('calcular el ratio', () => {
    // TODO: calculateWeeklyRateKg(80, -1) → -0.8
    const result = calculateWeeklyRateKg(80, -1)
    expect(result).toBe(-0.8)
  })
})

describe('clampWeeklyRatePercent', () => {
  it('calcular el ratio', () => {
    // TODO: clampWeeklyRatePercent(-0.5) → -0.5 (dentro del rango, no se toca)
    const result = clampWeeklyRatePercent(-0.5)
    expect(result).toBe(-0.5)
  })
})

describe('clampWeeklyRatePercent', () => {
  it('calcular el ratio', () => {
    // TODO: clampWeeklyRatePercent(-2) → -1 (se recorta al máximo permitido)
    const result = clampWeeklyRatePercent(-2)
    expect(result).toBe(-1)
  })
})

describe('clampWeeklyRatePercent', () => {
  it('calcular el ratio', () => {
    // TODO: clampWeeklyRatePercent(0.3) → 0.3 (superávit, el límite solo aplica a déficit)
    const result = clampWeeklyRatePercent(0.3)
    expect(result).toBe(0.3)
  })
})

describe('clampTargetCalories', () => {
  it('calcular el ratio', () => {
    // TODO: clampTargetCalories(900, 1200) → 1200 (estaba por debajo del piso)
    const result = clampTargetCalories(900, 1200)
    expect(result).toBe(1200)
  })
})

describe('clampTargetCalories', () => {
  it('calcular el ratio', () => {
    // TODO: clampTargetCalories(2209, 1200) → 2209 (sin cambios)
    const result = clampTargetCalories(2209, 1200)
    expect(result).toBe(2209)
  })
})

describe('calculateMacros con objetivo muy bajo', () => {
  it('los carbohidratos nunca son negativos', () => {
    // 100 kg: proteína 180 g + grasa 80 g = 1440 kcal, más que las 1200 kcal objetivo
    const result = calculateMacros(1200, 100, 1.8, 0.8)
    expect(result.carbsG).toBe(0)
  })
})

describe('calculatePhasePlan', () => {
  it('déficit normal: ritmo negativo y kcal por debajo del TDEE', () => {
    const plan = calculatePhasePlan(basePlanInput)
    expect(plan.weeklyRatePercent).toBe(-0.5)
    expect(plan.targetCalories).toBeCloseTo(2319, 5)
    expect(plan.macros.proteinG).toBeCloseTo(144, 5)
    expect(plan.macros.fatG).toBeCloseTo(64, 5)
    expect(plan.macros.carbsG).toBeCloseTo(291.75, 5)
  })

  it('déficit excesivo: el ritmo se recorta al máximo permitido', () => {
    const plan = calculatePhasePlan({ ...basePlanInput, weeklyRatePercent: 2 })
    expect(plan.weeklyRatePercent).toBe(-1)
    expect(plan.targetCalories).toBeCloseTo(1879, 5)
    expect(plan.macros.carbsG).toBeCloseTo(181.75, 5)
  })

  it('mantenimiento ignora el ritmo recibido', () => {
    const plan = calculatePhasePlan({ ...basePlanInput, type: 'maintenance' })
    expect(plan.weeklyRatePercent).toBe(0)
    expect(plan.targetCalories).toBeCloseTo(2759, 5)
  })

  it('superávit: ritmo positivo y kcal por encima del TDEE', () => {
    const plan = calculatePhasePlan({ ...basePlanInput, type: 'surplus', weeklyRatePercent: 0.25 })
    expect(plan.weeklyRatePercent).toBe(0.25)
    expect(plan.targetCalories).toBeCloseTo(2979, 5)
  })

  it('el piso de kcal sube un objetivo demasiado bajo', () => {
    const plan = calculatePhasePlan({ ...basePlanInput, tdee: 1300, weeklyRatePercent: 1 })
    expect(plan.targetCalories).toBe(1200)
  })

  it('un piso configurado por el usuario reemplaza al valor por defecto', () => {
    const plan = calculatePhasePlan({ ...basePlanInput, tdee: 1300, weeklyRatePercent: 1, minCalories: 1500 })
    expect(plan.targetCalories).toBe(1500)
  })

  it('un ritmo negativo en déficit se trata como magnitud', () => {
    const plan = calculatePhasePlan({ ...basePlanInput, weeklyRatePercent: -0.5 })
    expect(plan.weeklyRatePercent).toBe(-0.5)
  })

  it('avisa cuando proteína y grasa superan las kcal objetivo', () => {
    const plan = calculatePhasePlan({ ...basePlanInput, type: 'maintenance', weightKg: 100, tdee: 1200 })
    expect(plan.targetCalories).toBe(1200)
    expect(plan.macros.carbsG).toBe(0)
    expect(plan.macrosExceedTarget).toBe(true)
  })

  it('no avisa en un plan normal', () => {
    const plan = calculatePhasePlan(basePlanInput)
    expect(plan.macrosExceedTarget).toBe(false)
  })

  it('no avisa cuando proteína y grasa igualan exactamente el objetivo', () => {
    // 80 kg: 144 g * 4 + 64 g * 9 = 1152 kcal
    const plan = calculatePhasePlan({ ...basePlanInput, type: 'maintenance', tdee: 1152, minCalories: 1000 })
    expect(plan.targetCalories).toBe(1152)
    expect(plan.macrosExceedTarget).toBe(false)
  })

  it('transición se comporta como mantenimiento por ahora', () => {
    const plan = calculatePhasePlan({ ...basePlanInput, type: 'transition' })
    expect(plan.weeklyRatePercent).toBe(0)
    expect(plan.targetCalories).toBeCloseTo(2759, 5)
  })
})
describe('recalculatePhaseTarget', () => {
  const macros = { proteinG: 130, fatG: 58, carbsG: 250 }

  it('mantiene el ritmo y recalcula las kcal con el gasto nuevo (déficit de 0.5 %)', () => {
    // 72 kg × −0.5 % = −0.36 kg/sem → −396 kcal/día
    const result = recalculatePhaseTarget({ weeklyRatePercent: -0.5, macros, weightKg: 72, tdee: 2500 })
    expect(result.targetCalories).toBeCloseTo(2500 - 396, 5)
  })

  it('conserva proteína y grasa y ajusta solo los carbohidratos', () => {
    const result = recalculatePhaseTarget({ weeklyRatePercent: 0, macros, weightKg: 72, tdee: 2400 })
    // (2400 − 130·4 − 58·9) / 4 = (2400 − 520 − 522) / 4 = 339.5
    expect(result.macros).toEqual({ proteinG: 130, fatG: 58, carbsG: 339.5 })
    expect(result.macrosExceedTarget).toBe(false)
  })

  it('mantenimiento (ritmo 0): el objetivo es el propio gasto', () => {
    expect(recalculatePhaseTarget({ weeklyRatePercent: 0, macros, weightKg: 72, tdee: 2300 }).targetCalories).toBe(2300)
  })

  it('un superávit suma kcal', () => {
    const result = recalculatePhaseTarget({ weeklyRatePercent: 0.25, macros, weightKg: 72, tdee: 2400 })
    expect(result.targetCalories).toBeGreaterThan(2400)
  })

  it('nunca baja del piso de calorías', () => {
    const result = recalculatePhaseTarget({ weeklyRatePercent: -1, macros, weightKg: 72, tdee: 1300 })
    expect(result.targetCalories).toBe(1200)
  })

  it('con el piso, si proteína y grasa ya superan las kcal, los carbohidratos quedan en 0 y avisa', () => {
    const heavy = { proteinG: 200, fatG: 100, carbsG: 0 } // 800 + 900 = 1700 kcal
    const result = recalculatePhaseTarget({ weeklyRatePercent: 0, macros: heavy, weightKg: 72, tdee: 1500 })
    expect(result.macros.carbsG).toBe(0)
    expect(result.macrosExceedTarget).toBe(true)
  })
})

describe('isValidTransitionWeeks', () => {
  it('acepta números enteros de 2 a 12 semanas', () => {
    expect(isValidTransitionWeeks(2)).toBe(true)
    expect(isValidTransitionWeeks(4)).toBe(true)
    expect(isValidTransitionWeeks(12)).toBe(true)
  })

  it('rechaza menos de 2, más de 12, decimales y valores no numéricos', () => {
    expect(isValidTransitionWeeks(1)).toBe(false)
    expect(isValidTransitionWeeks(13)).toBe(false)
    expect(isValidTransitionWeeks(3.5)).toBe(false)
    expect(isValidTransitionWeeks(0)).toBe(false)
    expect(isValidTransitionWeeks(Number.NaN)).toBe(false)
  })
})

describe('buildTransitionSchedule', () => {
  it('sube en partes iguales y la última semana llega a mantenimiento', () => {
    expect(buildTransitionSchedule({ startCalories: 2000, endCalories: 2400, weeks: 4 })).toEqual([2100, 2200, 2300, 2400])
  })

  it('también baja hacia mantenimiento si se venía de un superávit', () => {
    expect(buildTransitionSchedule({ startCalories: 2800, endCalories: 2400, weeks: 2 })).toEqual([2600, 2400])
  })

  it('redondea las kcal y la última semana es exactamente el final', () => {
    const schedule = buildTransitionSchedule({ startCalories: 2000, endCalories: 2401, weeks: 3 })
    expect(schedule.every(Number.isInteger)).toBe(true)
    expect(schedule[2]).toBe(2401)
  })

  it('si empieza igual que termina, se queda igual', () => {
    expect(buildTransitionSchedule({ startCalories: 2400, endCalories: 2400, weeks: 3 })).toEqual([2400, 2400, 2400])
  })

  it('nunca baja del piso de calorías', () => {
    expect(buildTransitionSchedule({ startCalories: 1500, endCalories: 900, weeks: 3 })).toEqual([1300, 1200, 1200])
    expect(buildTransitionSchedule({ startCalories: 1500, endCalories: 900, weeks: 2 }, 1000)).toEqual([1200, 1000])
  })
})

describe('getTransitionWeek', () => {
  it('el primer día ya es la semana 1, y hasta el día 6', () => {
    expect(getTransitionWeek('2026-03-02', '2026-03-02', 4)).toBe(1)
    expect(getTransitionWeek('2026-03-02', '2026-03-08', 4)).toBe(1)
  })

  it('cada 7 días pasa a la semana siguiente', () => {
    expect(getTransitionWeek('2026-03-02', '2026-03-09', 4)).toBe(2)
    expect(getTransitionWeek('2026-03-02', '2026-03-23', 4)).toBe(4)
  })

  it('pasado el final se queda en la última semana', () => {
    expect(getTransitionWeek('2026-03-02', '2026-06-01', 4)).toBe(4)
  })

  it('una fecha anterior al inicio cuenta como semana 1', () => {
    expect(getTransitionWeek('2026-03-02', '2026-02-20', 4)).toBe(1)
  })
})

describe('adjustMacrosToCalories', () => {
  it('conserva proteína y grasa y recalcula los carbohidratos', () => {
    // (2400 − 130·4 − 58·9) / 4 = 339.5
    expect(adjustMacrosToCalories({ proteinG: 130, fatG: 58, carbsG: 0 }, 2400)).toEqual({ proteinG: 130, fatG: 58, carbsG: 339.5 })
  })

  it('los carbohidratos nunca son negativos', () => {
    expect(adjustMacrosToCalories({ proteinG: 200, fatG: 100, carbsG: 50 }, 1200).carbsG).toBe(0)
  })
})

describe('resolvePhaseTargets', () => {
  const macros = { proteinG: 130, fatG: 58, carbsG: 250 }
  const normal = { startDate: '2026-03-02', targetCalories: 2100, macros, transition: null }

  it('una fase normal tiene siempre el mismo objetivo, sin semana de transición', () => {
    expect(resolvePhaseTargets(normal, '2026-03-20')).toEqual({ targetCalories: 2100, macros, transitionWeek: null })
  })

  it('una transición cambia cada semana según su calendario', () => {
    const transition = { ...normal, transition: { startCalories: 2000, endCalories: 2400, weeks: 4 } }
    expect(resolvePhaseTargets(transition, '2026-03-02')).toMatchObject({ targetCalories: 2100, transitionWeek: 1 })
    expect(resolvePhaseTargets(transition, '2026-03-10')).toMatchObject({ targetCalories: 2200, transitionWeek: 2 })
    expect(resolvePhaseTargets(transition, '2026-03-24')).toMatchObject({ targetCalories: 2400, transitionWeek: 4 })
    expect(resolvePhaseTargets(transition, '2026-08-01')).toMatchObject({ targetCalories: 2400, transitionWeek: 4 })
  })

  it('en una transición los carbohidratos siguen a las kcal y proteína y grasa se mantienen', () => {
    const transition = { ...normal, transition: { startCalories: 2000, endCalories: 2400, weeks: 4 } }
    const week1 = resolvePhaseTargets(transition, '2026-03-02')
    const week4 = resolvePhaseTargets(transition, '2026-03-24')
    expect(week1.macros.proteinG).toBe(130)
    expect(week4.macros.fatG).toBe(58)
    expect(week4.macros.carbsG - week1.macros.carbsG).toBeCloseTo(75, 5) // 300 kcal más / 4
  })

  it('respeta el piso de calorías configurado', () => {
    const transition = { ...normal, transition: { startCalories: 1300, endCalories: 900, weeks: 2 } }
    expect(resolvePhaseTargets(transition, '2026-03-20').targetCalories).toBe(1200)
  })
})

describe('distributeMealTargets', () => {
  const dayTarget = { kcal: 2000, macros: { proteinG: 150, fatG: 60, carbsG: 220 } }

  it('con las 3 comidas base, reparte más a favor de las principales', () => {
    const result = distributeMealTargets(dayTarget, ['breakfast', 'lunch', 'dinner'])
    // pesos 25/35/25 -> normalizados sobre 85: breakfast y dinner iguales, lunch más grande
    expect(result.breakfast.kcal).toBeCloseTo(result.dinner.kcal, 5)
    expect(result.lunch.kcal).toBeGreaterThan(result.breakfast.kcal)
  })

  it('entre todas las visibles, el reparto suma el 100 % del objetivo (kcal y cada macro)', () => {
    const visible = ['breakfast', 'midMorning', 'lunch', 'midAfternoon', 'dinner', 'snack'] as const
    const result = distributeMealTargets(dayTarget, visible)
    const totalKcal = visible.reduce((sum, type) => sum + result[type].kcal, 0)
    const totalProtein = visible.reduce((sum, type) => sum + result[type].macros.proteinG, 0)
    expect(totalKcal).toBeCloseTo(dayTarget.kcal, 5)
    expect(totalProtein).toBeCloseTo(dayTarget.macros.proteinG, 5)
  })

  it('una comida no visible ese día queda en cero (su parte ya se repartió entre las demás)', () => {
    const withSnack = distributeMealTargets(dayTarget, ['breakfast', 'lunch', 'dinner', 'snack'])
    const withoutSnack = distributeMealTargets(dayTarget, ['breakfast', 'lunch', 'dinner'])
    expect(withSnack.snack.kcal).toBeGreaterThan(0)
    expect(withoutSnack.snack.kcal).toBe(0)
    // al quitar el snack, lo suyo se reparte: las demás comidas suben
    expect(withoutSnack.breakfast.kcal).toBeGreaterThan(withSnack.breakfast.kcal)
  })

  it('sin ninguna comida visible, no revienta: todo queda en cero', () => {
    const result = distributeMealTargets(dayTarget, [])
    expect(result.breakfast).toEqual({ kcal: 0, macros: { proteinG: 0, fatG: 0, carbsG: 0 } })
  })
})
