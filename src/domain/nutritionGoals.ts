import { daysBetweenLocalDates } from './localDate'
import { MEAL_TYPES, type MealType } from './mealTypes'

// 1. Tipo de fase
export const PHASE_TYPES = ['deficit', 'maintenance', 'surplus', 'transition'] as const
export type PhaseType = (typeof PHASE_TYPES)[number]
export const DEFAULT_MIN_CALORIES = 1200
export const MAX_WEEKLY_DEFICIT_PERCENT = 1 // % del peso corporal por semana

export const PHASE_TYPE_LABELS: Record<PhaseType, string> = {
  deficit: 'Déficit',
  maintenance: 'Mantenimiento',
  surplus: 'Superávit',
  transition: 'Transición'
}

// 2. Kcal objetivo
export function calculateTargetCalories(tdee: number, weeklyRateKg: number): number {
  // TODO: TDEE + (ritmo_kg_semana * 7700) / 7
  return tdee + (weeklyRateKg * 7700) / 7
}

// 3. Macros
export interface Macros {
  proteinG: number
  fatG: number
  carbsG: number
}

export function calculateMacros(
  targetCalories: number,
  weightKg: number,
  proteinPerKg: number,
  fatPerKg: number,
): Macros {
  // TODO:
  const proteinG = weightKg * proteinPerKg
  const fatG = weightKg * fatPerKg
  const kcal = proteinG*4 + fatG*9
  const carbsKcal = targetCalories - kcal
  const carbsG = Math.max(0, carbsKcal / 4) // proteína + grasa pueden superar el objetivo; nunca devolvemos negativos

  return { proteinG, fatG, carbsG }
}

export function calculateWeeklyRateKg(weightKg: number, weeklyRatePercent: number): number {
  // TODO: weightKg * weeklyRatePercent / 100
  return (weightKg * weeklyRatePercent) / 100
}

export function clampWeeklyRatePercent(weeklyRatePercent: number): number {
  // TODO: si weeklyRatePercent es más negativo que -MAX_WEEKLY_DEFICIT_PERCENT, recórtalo a -MAX_WEEKLY_DEFICIT_PERCENT
  // pista: Math.max(a, b) devuelve el mayor de los dos — ¿cuál de los dos es "el límite"?
  return Math.max(-MAX_WEEKLY_DEFICIT_PERCENT, weeklyRatePercent)
}

export function clampTargetCalories(targetCalories: number, minCalories: number = DEFAULT_MIN_CALORIES): number {
  // TODO: nunca devolver menos que minCalories
  return Math.max(minCalories, targetCalories)
}

export interface PhasePlanInput {
  type: PhaseType
  weeklyRatePercent: number   // magnitud positiva, ej. 0.75
  weightKg: number
  tdee: number
  proteinPerKg: number
  fatPerKg: number
  minCalories?: number
}

export interface PhasePlan {
  weeklyRatePercent: number   // ya con signo y limitado
  targetCalories: number
  macros: Macros
  macrosExceedTarget: boolean // proteína + grasa ya superan las kcal objetivo (los carbohidratos quedaron en 0)
}

export function calculatePhasePlan(input: PhasePlanInput): PhasePlan {
  // 1. signo según el tipo (transition se trata como mantenimiento por ahora)
  const magnitude = Math.abs(input.weeklyRatePercent)
  let signedRate = 0
  if (input.type === 'deficit') {
    signedRate = -magnitude
  } else if (input.type === 'surplus') {
    signedRate = magnitude
  }

  // 2. el déficit nunca supera el máximo permitido
  const weeklyRatePercent = clampWeeklyRatePercent(signedRate)

  // 3. porcentaje del peso → kg por semana
  const weeklyRateKg = calculateWeeklyRateKg(input.weightKg, weeklyRatePercent)

  // 4. kcal objetivo, sin bajar del piso (minCalories undefined usa el valor por defecto)
  const targetCalories = clampTargetCalories(calculateTargetCalories(input.tdee, weeklyRateKg), input.minCalories)

  // 5. macros a partir de las kcal ya limitadas
  const macros = calculateMacros(targetCalories, input.weightKg, input.proteinPerKg, input.fatPerKg)

  // 6. ¿proteína y grasa caben en el objetivo? (tolerancia de 0.01 kcal por decimales de punto flotante)
  const macrosExceedTarget = macros.proteinG * 4 + macros.fatG * 9 - targetCalories > 0.01

  return { weeklyRatePercent, targetCalories, macros, macrosExceedTarget }
}

export interface PhaseRetargetInput {
  weeklyRatePercent: number // ya con signo, como se guarda en la fase
  macros: Macros // los de la fase actual: proteína y grasa se conservan
  weightKg: number
  tdee: number
  minCalories?: number
}

// Recalcula el objetivo de una fase que ya está en curso cuando cambia el gasto (TDEE): mismo ritmo, mismas
// proteína y grasa, y los carbohidratos se ajustan a las kcal nuevas.
export function recalculatePhaseTarget(input: PhaseRetargetInput): { targetCalories: number; macros: Macros; macrosExceedTarget: boolean } {
  const weeklyRateKg = calculateWeeklyRateKg(input.weightKg, input.weeklyRatePercent)
  const targetCalories = clampTargetCalories(calculateTargetCalories(input.tdee, weeklyRateKg), input.minCalories)

  const proteinAndFatKcal = input.macros.proteinG * 4 + input.macros.fatG * 9
  const carbsG = Math.max(0, (targetCalories - proteinAndFatKcal) / 4)

  return {
    targetCalories,
    macros: { proteinG: input.macros.proteinG, fatG: input.macros.fatG, carbsG },
    macrosExceedTarget: proteinAndFatKcal - targetCalories > 0.01,
  }
}

// ── Fase de transición: llevar las calorías poco a poco hacia mantenimiento ──

export interface PhaseTransition {
  startCalories: number // el objetivo con el que empieza (el de la fase anterior)
  endCalories: number // adonde llega: el gasto de mantenimiento (TDEE)
  weeks: number
}

export const MIN_TRANSITION_WEEKS = 2
export const MAX_TRANSITION_WEEKS = 12
export const DEFAULT_TRANSITION_WEEKS = 4

export function isValidTransitionWeeks(weeks: number): boolean {
  return Number.isInteger(weeks) && weeks >= MIN_TRANSITION_WEEKS && weeks <= MAX_TRANSITION_WEEKS
}

// Las kcal objetivo de cada semana (la posición 0 es la semana 1): cada semana sube o baja una parte igual del camino
// y la última semana llega exactamente a endCalories. Nunca baja del piso de calorías.
export function buildTransitionSchedule(transition: PhaseTransition, minCalories: number = DEFAULT_MIN_CALORIES): number[] {
  const { startCalories, endCalories, weeks } = transition
  return Array.from({ length: weeks }, (_, index) =>
    clampTargetCalories(Math.round(startCalories + ((endCalories - startCalories) * (index + 1)) / weeks), minCalories),
  )
}

// En qué semana de la transición va (1 a weeks): el primer día ya cuenta como semana 1 y pasado el final se queda en la última
export function getTransitionWeek(startDate: string, today: string, weeks: number): number {
  const daysElapsed = Math.max(daysBetweenLocalDates(startDate, today), 0)
  return Math.min(Math.floor(daysElapsed / 7) + 1, weeks)
}

// Mantiene proteína y grasa y ajusta los carbohidratos a las kcal dadas (nunca negativos)
export function adjustMacrosToCalories(macros: Macros, targetCalories: number): Macros {
  const proteinAndFatKcal = macros.proteinG * 4 + macros.fatG * 9
  return { proteinG: macros.proteinG, fatG: macros.fatG, carbsG: Math.max(0, (targetCalories - proteinAndFatKcal) / 4) }
}

// Lo que necesita una fase para saber su objetivo de un día
export interface PhaseTargetSource {
  startDate: string
  targetCalories: number
  macros: Macros
  transition: PhaseTransition | null
}

export interface PhaseTargets {
  targetCalories: number
  macros: Macros
  transitionWeek: number | null // solo en una transición
}

// El objetivo de una fase en un día. Una fase normal tiene el mismo objetivo siempre; una transición cambia cada semana.
export function resolvePhaseTargets(phase: PhaseTargetSource, today: string, minCalories?: number): PhaseTargets {
  if (!phase.transition) return { targetCalories: phase.targetCalories, macros: phase.macros, transitionWeek: null }

  const week = getTransitionWeek(phase.startDate, today, phase.transition.weeks)
  const targetCalories = buildTransitionSchedule(phase.transition, minCalories)[week - 1] ?? phase.transition.endCalories
  return { targetCalories, macros: adjustMacrosToCalories(phase.macros, targetCalories), transitionWeek: week }
}

// ── Objetivo por comida: reparte el objetivo del día entre las comidas del diario ──

export interface DayTarget {
  kcal: number
  macros: Macros
}

// Peso relativo de cada comida (no hace falta que sumen 100: se normalizan según cuáles estén visibles ese día).
// Las tres principales llevan más peso que las opcionales, que son más ligeras.
const DEFAULT_MEAL_SHARE: Record<MealType, number> = {
  breakfast: 25,
  midMorning: 5,
  lunch: 35,
  midAfternoon: 5,
  dinner: 25,
  snack: 5,
}

// El objetivo de cada comida visible ese día, a partir del objetivo del día completo y del peso de cada una.
// Si un día no usa alguna comida (opcional desactivada, o quitada ese día), su parte se reparte entre las demás:
// no hay que guardar ni recalcular nada aparte, el reparto ya sale de a cuáles `visibleMealTypes` se les pase.
export function distributeMealTargets(dayTarget: DayTarget, visibleMealTypes: readonly MealType[]): Record<MealType, DayTarget> {
  const totalWeight = visibleMealTypes.reduce((sum, type) => sum + DEFAULT_MEAL_SHARE[type], 0)

  return Object.fromEntries(
    MEAL_TYPES.map((type) => {
      const share = visibleMealTypes.includes(type) && totalWeight > 0 ? DEFAULT_MEAL_SHARE[type] / totalWeight : 0
      return [
        type,
        {
          kcal: dayTarget.kcal * share,
          macros: {
            proteinG: dayTarget.macros.proteinG * share,
            fatG: dayTarget.macros.fatG * share,
            carbsG: dayTarget.macros.carbsG * share,
          },
        },
      ]
    }),
  ) as Record<MealType, DayTarget>
}
