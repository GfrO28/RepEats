import type { Session, CompletedSet } from '@/repositories/SessionRepository'
import { estimateOneRepMax } from './oneRepMax'

export interface PersonalRecord {
  exerciseId: string
  previousBest: number
  newBest: number
}

// El mejor 1RM estimado dentro de una lista de series (0 si la lista está vacía)
export function bestOneRepMax(sets: CompletedSet[]): number {
  return sets.reduce((best, set) => (Math.max(estimateOneRepMax(set.weight, set.reps), best)), 0)
}

// Todas las series de un ejercicio en particular, juntando varias sesiones en un solo array
function allSetsForExercise(sessions: Session[], exerciseId: string): CompletedSet[] {
  return sessions.flatMap((session) =>
    session.exercises
      .filter((exercise) => exercise.exerciseId === exerciseId)
      .flatMap((exercise) => exercise.sets),
  )
}

export function findNewRecords(session: Session, pastSessions: Session[]): PersonalRecord[] {
  return session.exercises
    .map((sessionExercise) => ({
      exerciseId: sessionExercise.exerciseId,
      previousBest: bestOneRepMax(allSetsForExercise(pastSessions, sessionExercise.exerciseId)),
      newBest: bestOneRepMax(sessionExercise.sets),
    }))
    .filter((record) => record.newBest > record.previousBest)
}
