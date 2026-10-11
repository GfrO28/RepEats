import type { Session } from '@/repositories/SessionRepository'
import { bestOneRepMax } from './personalRecords'
import { calculateSessionVolume } from './volume'
import { getCurrentWeekRange } from './weekRange'

// Cuántas semanas muestran las gráficas de constancia y de volumen
export const SUMMARY_WEEKS = 8

// El día al que pertenece una sesión completada: cuando terminó (igual que el volumen semanal por grupo muscular),
// para que todas las cifras de Progreso agrupen las sesiones de la misma manera.
export function getSessionDate(session: Session): Date {
  return session.endedAt ?? session.startedAt
}

function completedSessions(sessions: readonly Session[]): Session[] {
  return sessions.filter((session) => session.status === 'completed')
}

export interface WeekSummary {
  weekStart: Date // el lunes a las 00:00, hora local
  sessionCount: number
  volumeKg: number // sin contar el calentamiento
  durationSeconds: number
  trainedDays: boolean[] // 7 posiciones, de lunes (0) a domingo (6)
}

// Resumen de la semana (lunes a domingo) que contiene a referenceDate
export function summarizeWeek(sessions: readonly Session[], referenceDate: Date): WeekSummary {
  const { start, end } = getCurrentWeekRange(referenceDate)
  const trainedDays = Array.from({ length: 7 }, () => false)
  let sessionCount = 0
  let volumeKg = 0
  let durationSeconds = 0

  for (const session of completedSessions(sessions)) {
    const date = getSessionDate(session)
    if (date < start || date > end) continue

    sessionCount += 1
    volumeKg += calculateSessionVolume(session)
    durationSeconds += Math.max(Math.floor((getSessionDate(session).getTime() - session.startedAt.getTime()) / 1000), 0)
    trainedDays[(date.getDay() + 6) % 7] = true // getDay(): domingo = 0; aquí el lunes es 0
  }

  return { weekStart: start, sessionCount, volumeKg, durationSeconds, trainedDays }
}

// Las últimas "weeks" semanas, de la más antigua a la actual, incluyendo las semanas sin entrenar (con ceros)
export function getWeeklyHistory(
  sessions: readonly Session[],
  referenceDate: Date,
  weeks: number = SUMMARY_WEEKS,
): WeekSummary[] {
  return Array.from({ length: weeks }, (_, index) => {
    const weeksAgo = weeks - 1 - index
    const reference = new Date(referenceDate)
    reference.setDate(reference.getDate() - 7 * weeksAgo) // setDate y no restar milisegundos: respeta cambios de hora
    return summarizeWeek(sessions, reference)
  })
}

export interface WeekComparison {
  sessionCount: number // esta semana − la anterior (negativo = menos)
  volumeKg: number
  durationSeconds: number
}

export function compareWeeks(current: WeekSummary, previous: WeekSummary): WeekComparison {
  return {
    sessionCount: current.sessionCount - previous.sessionCount,
    volumeKg: current.volumeKg - previous.volumeKg,
    durationSeconds: current.durationSeconds - previous.durationSeconds,
  }
}

// ── Récords personales ──

export interface RecordEvent {
  sessionId: string // la sesión en la que se logró
  exerciseId: string
  date: Date
  previousBest: number // 1RM estimado anterior (siempre mayor que 0)
  newBest: number
}

// Todos los récords, del más antiguo al más reciente. Es un récord superar tu mejor 1RM estimado anterior en ese
// ejercicio; la primera vez que haces un ejercicio no cuenta (no hay nada que superar y llenaría la lista de ruido).
export function collectRecords(sessions: readonly Session[]): RecordEvent[] {
  const chronological = [...completedSessions(sessions)].sort(
    (a, b) => getSessionDate(a).getTime() - getSessionDate(b).getTime(),
  )
  const bestByExercise = new Map<string, number>()
  const events: RecordEvent[] = []

  for (const session of chronological) {
    for (const sessionExercise of session.exercises) {
      const best = bestOneRepMax(sessionExercise.sets)
      const previousBest = bestByExercise.get(sessionExercise.exerciseId) ?? 0
      if (best <= previousBest) continue

      bestByExercise.set(sessionExercise.exerciseId, best)
      if (previousBest > 0) {
        events.push({
          sessionId: session.id,
          exerciseId: sessionExercise.exerciseId,
          date: getSessionDate(session),
          previousBest,
          newBest: best,
        })
      }
    }
  }
  return events
}

// Los más recientes primero
export function findRecentRecords(events: readonly RecordEvent[], limit: number): RecordEvent[] {
  return [...events].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit)
}

export function countRecordsInWeek(events: readonly RecordEvent[], referenceDate: Date): number {
  const { start, end } = getCurrentWeekRange(referenceDate)
  return events.filter((event) => event.date >= start && event.date <= end).length
}
