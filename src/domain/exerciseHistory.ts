import type { CompletedSet, Session } from '@/repositories/SessionRepository'
import { bestOneRepMax } from './personalRecords'

export interface ExerciseSessionStat {
  sessionId: string
  date: Date
  maxWeight: number
  bestOneRepMax: number
  volume: number // sin contar el calentamiento, igual que el volumen de la sesión
  sets: CompletedSet[]
}

export function getExerciseHistory(sessions: Session[], exerciseId: string): ExerciseSessionStat[] {
  return sessions
    .filter((session) => session.status === 'completed')
    .flatMap((session) => {
      const sessionExercise = session.exercises.find((e) => e.exerciseId === exerciseId)
      if (!sessionExercise || sessionExercise.sets.length === 0) {
        return []
      }

      return [
        {
          sessionId: session.id,
          date: session.endedAt ?? session.startedAt,
          maxWeight: Math.max(...sessionExercise.sets.map((set) => set.weight)),
          bestOneRepMax: bestOneRepMax(sessionExercise.sets),
          volume: sessionExercise.sets
            .filter((set) => set.type !== 'Calentamiento')
            .reduce((total, set) => total + set.weight * set.reps, 0),
          sets: sessionExercise.sets,
        },
      ]
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}

// La serie de la sesión anterior con la que se compara la fila activa. Se empareja por tipo y por orden dentro de ese tipo:
// la 2.ª Normal de hoy contra la 2.ª Normal de la vez pasada, así un calentamiento que sumas o quitas no desfasa las demás.
// "currentSets" son las series ya completadas hoy (las anteriores a la fila activa). null si no hay una equivalente.
export function findPreviousSetForType(
  previousSets: readonly CompletedSet[] | null,
  currentSets: readonly CompletedSet[],
  type: CompletedSet['type'],
): CompletedSet | null {
  if (!previousSets) return null
  const sameTypeIndex = currentSets.filter((set) => set.type === type).length
  return previousSets.filter((set) => set.type === type)[sameTypeIndex] ?? null
}

// Cuándo se hizo por última vez cada ejercicio (solo sesiones completadas). Sirve para ofrecer primero los que usas.
export function getLastPerformedDates(sessions: readonly Session[]): Map<string, Date> {
  const lastDates = new Map<string, Date>()
  for (const session of sessions) {
    if (session.status !== 'completed') continue
    const date = session.endedAt ?? session.startedAt
    for (const exercise of session.exercises) {
      if (exercise.sets.length === 0) continue
      const current = lastDates.get(exercise.exerciseId)
      if (!current || date > current) lastDates.set(exercise.exerciseId, date)
    }
  }
  return lastDates
}

export interface ExerciseSummary {
  sessionCount: number
  bestOneRepMax: { value: number; date: Date }
  maxWeight: { value: number; date: Date }
  first: ExerciseSessionStat
  last: ExerciseSessionStat
  // Cambio del mejor 1RM estimado entre la primera sesión y la última; el porcentaje es null si la primera valía 0
  oneRepMaxChange: { kg: number; percent: number | null }
}

// null si todavía no hay sesiones de ese ejercicio. "history" viene ordenado de la más antigua a la más reciente.
export function summarizeExercise(history: readonly ExerciseSessionStat[]): ExerciseSummary | null {
  const first = history[0]
  const last = history[history.length - 1]
  if (!first || !last) return null

  // En un empate gana la sesión más antigua: el récord se logró la primera vez que se alcanzó
  const bestOneRm = history.reduce((best, stat) => (stat.bestOneRepMax > best.bestOneRepMax ? stat : best), first)
  const heaviest = history.reduce((best, stat) => (stat.maxWeight > best.maxWeight ? stat : best), first)
  const kgChange = last.bestOneRepMax - first.bestOneRepMax

  return {
    sessionCount: history.length,
    bestOneRepMax: { value: bestOneRm.bestOneRepMax, date: bestOneRm.date },
    maxWeight: { value: heaviest.maxWeight, date: heaviest.date },
    first,
    last,
    oneRepMaxChange: {
      kg: kgChange,
      percent: first.bestOneRepMax > 0 ? (kgChange / first.bestOneRepMax) * 100 : null,
    },
  }
}
