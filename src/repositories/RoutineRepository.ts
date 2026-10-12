import type { SetTypes } from "@/domain/setTypes"

export interface TargetSet {
  type: SetTypes
  repsMin: number
  repsMax: number
  weight: number
  restSeconds: number
}

export interface RoutineExercise {
  exerciseId: string
  targetSets: TargetSet[]
  // Dos ejercicios consecutivos con el mismo valor forman un superset (ver domain/superset). Ausente = ejercicio suelto.
  supersetGroup?: string
}

export interface Routine {
  id: string
  name: string
  suggestedDay: string
  suggestedTime: string | null // hora sugerida ("HH:mm"), para calcular cuándo comer antes/después de entrenar
  exercises: RoutineExercise[]
  order: number // posición a gusto del usuario en la lista (arrastrar para reordenar); menor = más arriba
}

export interface RoutineRepository {
  generateRoutineId(): string
  subscribeRoutines(onChange: (routines: Routine[]) => void): () => void
  addRoutine(routine: Routine): void
  updateRoutine(routine: Routine): void
  deleteRoutine(id: string): void
}