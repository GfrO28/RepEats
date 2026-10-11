import { calculateTdee, type ActivityLevel } from './energyExpenditure'
import { addDaysToLocalDate, daysBetweenLocalDates } from './localDate'
import { calculateWeightTrend, type WeighIn } from './weightTrend'

export interface DailyIntake {
  date: string // 'YYYY-MM-DD' en hora local; una sola entrada por día
  kcal: number // total del diario ese día
}

export const KCAL_PER_KG = 7700 // mismo valor que usa el cálculo del plan (kcal de un kg de peso corporal)
export const ADAPTIVE_WINDOW_DAYS = 21 // ventana de 3 semanas (la especificación pide 2 a 3)
export const MIN_LOGGED_DAYS = 10 // días con diario completo en la ventana
export const MIN_WEIGH_INS = 5 // pesajes en la ventana: con menos, la tendencia depende demasiado de un día
export const MIN_TREND_SPAN_DAYS = 14 // separación entre el primer y el último pesaje de la ventana
// Un día con menos que esto casi seguro quedó a medias (se olvidó anotar comidas): no cuenta como registrado
export const MIN_COMPLETE_DAY_KCAL = 800
// Gasto diario fuera de este rango = dato erróneo (peso mal tecleado, comidas sin anotar, etc.)
export const PLAUSIBLE_TDEE_RANGE = { min: 1000, max: 6000 } as const

export const TDEE_BLEND_WEIGHT = 0.3 // cuánto del gasto observado entra en cada actualización
export const MAX_TDEE_CHANGE_KCAL = 150 // tope del cambio por actualización

export type InsufficientReason = 'fewWeighIns' | 'shortSpan' | 'fewLoggedDays' | 'implausible'

export type ObservedTdeeResult =
  | {
      status: 'ok'
      observedTdee: number
      averageIntakeKcal: number
      trendChangeKg: number // cambio del peso de tendencia en el periodo (negativo = bajó)
      spanDays: number // días entre el primer y el último pesaje usados
      loggedDays: number // días con diario completo dentro de ese periodo
    }
  | { status: 'insufficient'; reason: InsufficientReason }

export interface ObservedTdeeInput {
  endDate: string // último día de la ventana, normalmente hoy
  weighIns: readonly WeighIn[] // todos los pesajes: la tendencia necesita el historial previo para "calentar"
  intakes: readonly DailyIntake[]
  windowDays?: number
}

// Gasto observado: lo que comiste de promedio menos lo que tu cuerpo "guardó" (o perdió), en kcal por día.
// gasto = ingesta promedio − (cambio de peso de tendencia × 7700) / días
export function calculateObservedTdee(input: ObservedTdeeInput): ObservedTdeeResult {
  const windowDays = input.windowDays ?? ADAPTIVE_WINDOW_DAYS
  const windowStart = addDaysToLocalDate(input.endDate, -(windowDays - 1))

  // La tendencia se calcula con todo el historial y después se recorta a la ventana
  const trend = calculateWeightTrend(input.weighIns).filter(
    (point) => point.date >= windowStart && point.date <= input.endDate,
  )
  const first = trend[0]
  const last = trend[trend.length - 1]
  if (!first || !last || trend.length < MIN_WEIGH_INS) return { status: 'insufficient', reason: 'fewWeighIns' }

  const spanDays = daysBetweenLocalDates(first.date, last.date)
  if (spanDays < MIN_TREND_SPAN_DAYS) return { status: 'insufficient', reason: 'shortSpan' }

  // Solo la ingesta del mismo periodo en que se midió el cambio de peso, y solo de días completos
  const loggedIntakes = input.intakes.filter(
    (intake) => intake.date >= first.date && intake.date <= last.date && intake.kcal >= MIN_COMPLETE_DAY_KCAL,
  )
  if (loggedIntakes.length < MIN_LOGGED_DAYS) return { status: 'insufficient', reason: 'fewLoggedDays' }

  const averageIntakeKcal = loggedIntakes.reduce((sum, intake) => sum + intake.kcal, 0) / loggedIntakes.length
  const trendChangeKg = last.trendKg - first.trendKg
  const observedTdee = averageIntakeKcal - (trendChangeKg * KCAL_PER_KG) / spanDays

  if (observedTdee < PLAUSIBLE_TDEE_RANGE.min || observedTdee > PLAUSIBLE_TDEE_RANGE.max) {
    return { status: 'insufficient', reason: 'implausible' }
  }

  return { status: 'ok', observedTdee, averageIntakeKcal, trendChangeKg, spanDays, loggedDays: loggedIntakes.length }
}

// Nuevo gasto estimado: mezcla suave entre el anterior y el observado, con tope por actualización.
// Así un par de semanas raras (un viaje, una enfermedad) no desbaratan el objetivo de golpe.
export function blendTdee(previousTdee: number, observedTdee: number): number {
  const step = TDEE_BLEND_WEIGHT * (observedTdee - previousTdee)
  const limitedStep = Math.min(Math.max(step, -MAX_TDEE_CHANGE_KCAL), MAX_TDEE_CHANGE_KCAL)
  return Math.round(previousTdee + limitedStep)
}

// ── Gasto ajustado guardado en el perfil ──

export interface AdaptiveTdee {
  kcal: number
  updatedAt: string // 'YYYY-MM-DD' del último ajuste
}

// El gasto que usa el plan: el ajustado si ya hay uno; si no, la estimación por fórmula y nivel de actividad
export function resolveTdee(bmr: number, activityLevel: ActivityLevel, adaptive: AdaptiveTdee | null): number {
  return adaptive ? adaptive.kcal : calculateTdee(bmr, activityLevel)
}

export const MIN_DAYS_BETWEEN_UPDATES = 7 // un ajuste por semana: menos daría más ruido que información
export const MIN_MEANINGFUL_CHANGE_KCAL = 25 // por debajo de esto no vale la pena proponer nada

// Primer día en que se puede volver a ajustar; null si nunca se ha ajustado (se puede ya)
export function getNextTdeeUpdateDate(adaptive: AdaptiveTdee | null): string | null {
  return adaptive ? addDaysToLocalDate(adaptive.updatedAt, MIN_DAYS_BETWEEN_UPDATES) : null
}

export function canUpdateTdee(adaptive: AdaptiveTdee | null, today: string): boolean {
  const next = getNextTdeeUpdateDate(adaptive)
  return next === null || today >= next
}

export interface TdeeProposal {
  proposedTdee: number
  changeKcal: number // propuesto − actual
  isMeaningful: boolean // ¿el cambio es lo bastante grande para proponerlo?
}

export function proposeTdeeUpdate(currentTdee: number, observedTdee: number): TdeeProposal {
  const proposedTdee = blendTdee(currentTdee, observedTdee)
  const changeKcal = proposedTdee - Math.round(currentTdee)
  return { proposedTdee, changeKcal, isMeaningful: Math.abs(changeKcal) >= MIN_MEANINGFUL_CHANGE_KCAL }
}

// Qué falta cuando no se puede calcular (texto para mostrar)
export const INSUFFICIENT_REASON_MESSAGES: Record<InsufficientReason, string> = {
  fewWeighIns: `Faltan pesajes: necesito al menos ${MIN_WEIGH_INS} en las últimas 3 semanas.`,
  shortSpan: `Tus pesajes de las últimas 3 semanas abarcan menos de ${MIN_TREND_SPAN_DAYS} días. Sigue pesándote y en unos días se podrá calcular.`,
  fewLoggedDays: `Faltan días de diario: necesito al menos ${MIN_LOGGED_DAYS} días con todo lo que comiste anotado (más de ${MIN_COMPLETE_DAY_KCAL} kcal) dentro de ese periodo.`,
  implausible: 'Con esos datos sale un resultado que no parece real. Revisa que los pesajes y el diario estén bien anotados.',
}
