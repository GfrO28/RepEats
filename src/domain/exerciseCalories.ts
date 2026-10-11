import type { Session } from '@/repositories/SessionRepository'
import { getSessionDate } from './progressSummary'
import { toLocalDateString } from './localDate'

// Entrenamiento de fuerza en general (Compendio de Actividades Físicas, "resistance training, light or moderate effort").
// Es un valor conservador: el MET promedia toda la sesión, descansos incluidos, que es como se mide aquí la duración.
// Solo es una estimación para tener una idea; no se suma al objetivo diario (el ajuste adaptativo ya la refleja).
export const RESISTANCE_TRAINING_MET = 3.5

// kcal = MET × peso (kg) × horas. Sin duración o sin peso no hay estimación (0).
export function estimateExerciseKcal(
  durationSeconds: number,
  bodyWeightKg: number,
  met: number = RESISTANCE_TRAINING_MET,
): number {
  if (!(durationSeconds > 0) || !(bodyWeightKg > 0)) return 0
  return Math.round(met * bodyWeightKg * (durationSeconds / 3600))
}

export function estimateSessionKcal(session: Session, bodyWeightKg: number): number {
  const seconds = Math.floor((getSessionDate(session).getTime() - session.startedAt.getTime()) / 1000)
  return estimateExerciseKcal(seconds, bodyWeightKg)
}

// Las kcal estimadas de todas las sesiones completadas que terminaron ese día ('YYYY-MM-DD' en hora local)
export function estimateDayExerciseKcal(sessions: readonly Session[], date: string, bodyWeightKg: number): number {
  return sessions
    .filter((session) => session.status === 'completed' && toLocalDateString(getSessionDate(session)) === date)
    .reduce((total, session) => total + estimateSessionKcal(session, bodyWeightKg), 0)
}

// Kcal de la sesión: la corrección manual (p. ej. de un smartwatch) si existe, si no la estimación por MET
export function resolveSessionKcal(session: Session, bodyWeightKg: number): number {
  return session.manualExerciseKcal ?? estimateSessionKcal(session, bodyWeightKg)
}

export function resolveDayExerciseKcal(sessions: readonly Session[], date: string, bodyWeightKg: number): number {
  return sessions
    .filter((session) => session.status === 'completed' && toLocalDateString(getSessionDate(session)) === date)
    .reduce((total, session) => total + resolveSessionKcal(session, bodyWeightKg), 0)
}
