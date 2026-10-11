import type { EquipmentType } from "@/domain/equipmentTypes"
import type { SpecificMuscle } from "@/domain/muscleGroups"

export interface Exercise {
  id: string
  name: string
  primaryMuscles: SpecificMuscle[]
  secondaryMuscles: SpecificMuscle[]
  equipment: EquipmentType
  notes: string
}

export interface WorkoutRepository {
  generateExerciseId(): string
  subscribeExercises(onChange: (exercises: Exercise[]) => void): () => void
  addExercise(exercise: Exercise): void
  updateExercise(exercise: Exercise): void
  deleteExercise(id: string): void
}