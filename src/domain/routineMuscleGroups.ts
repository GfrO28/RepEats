import type { Routine } from '@/repositories/RoutineRepository'
import type { Exercise } from '@/repositories/WorkoutRepository'
import { getMuscleGroup, type MuscleGroupName } from './muscleGroups'

export function getRoutineMuscleGroups(routine: Routine, exercises: Exercise[]): MuscleGroupName[] {
  const groups = new Set<MuscleGroupName>()

  for (const routineExercise of routine.exercises) {
    const exercise = exercises.find((e) => e.id === routineExercise.exerciseId)
    if (!exercise) continue

    for (const muscle of exercise.primaryMuscles) {
      groups.add(getMuscleGroup(muscle))
    }
  }

  return Array.from(groups)
}
