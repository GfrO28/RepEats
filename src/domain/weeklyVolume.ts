import type { Session } from '@/repositories/SessionRepository'
import type { Exercise } from '@/repositories/WorkoutRepository'
import { getMuscleGroup, MUSCLE_GROUP_INFO, type MuscleGroupName } from './muscleGroups'

// Cuánto aporta una serie a un grupo donde el ejercicio lo trabaja como secundario, en vez de como primario.
// Es una heurística de coach (RP / Mike Israetel, Eric Helms la citan en ese orden de magnitud), no una constante
// medida en laboratorio: un secundario recibe algo de estímulo, pero menos que una serie dedicada a ese músculo.
export const SECONDARY_MUSCLE_SET_WEIGHT = 0.5

export function calculateWeeklyVolumeByMuscleGroup(
  sessions: Session[],
  exercises: Exercise[],
  weekStart: Date,
  weekEnd: Date,
): Partial<Record<MuscleGroupName, number>> {
  const volumeByGroup: Partial<Record<MuscleGroupName, number>> = {}

  function addCredit(group: MuscleGroupName, credit: number) {
    if (!MUSCLE_GROUP_INFO[group].countsTowardVolume) return
    volumeByGroup[group] = (volumeByGroup[group] ?? 0) + credit
  }

  const relevantSessions = sessions.filter(
    (session) =>
      session.status === 'completed' &&
      session.endedAt !== null &&
      session.endedAt >= weekStart &&
      session.endedAt <= weekEnd,
  )

  for (const session of relevantSessions) {
    for (const sessionExercise of session.exercises) {
      const exercise = exercises.find((e) => e.id === sessionExercise.exerciseId)
      // Series efectivas: el calentamiento no cuenta (igual que en el volumen de la sesión)
      const effectiveSetCount = sessionExercise.sets.filter((set) => set.type !== 'Calentamiento').length
      if (!exercise || effectiveSetCount === 0) continue

      // Primario y secundario se suman por separado: si dos músculos específicos de un mismo grupo aparecen uno
      // como primario y otro como secundario (p. ej. Romboides primario y Trapecio medio secundario, ambos
      // "Espalda alta"), el grupo recibe el crédito de los dos, porque son músculos distintos, no el mismo dos veces.
      const primaryGroups = new Set(exercise.primaryMuscles.map(getMuscleGroup))
      const secondaryGroups = new Set(exercise.secondaryMuscles.map(getMuscleGroup))

      for (const group of primaryGroups) addCredit(group, effectiveSetCount)
      for (const group of secondaryGroups) addCredit(group, effectiveSetCount * SECONDARY_MUSCLE_SET_WEIGHT)
    }
  }

  return volumeByGroup
}
