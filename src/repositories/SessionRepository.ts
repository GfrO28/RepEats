import type { SetTypes } from "@/domain/setTypes"

export interface CompletedSet {
  type: SetTypes
  reps: number
  weight: number
  rir?: number
  completedAt: Date
}

export interface SessionExercise {
  exerciseId: string
  notes: string
  sets: CompletedSet[]
}

export interface Session {
  id: string
  routineId: string | null
  startedAt: Date
  endedAt: Date | null
  status: 'in_progress' | 'completed'
  exercises: SessionExercise[]
  // Corrección manual de las kcal de ejercicio (p. ej. desde un smartwatch); si es null, se usa la estimación por MET
  manualExerciseKcal: number | null
}

export interface SessionRepository {
  generateSessionId(): string
  subscribeSessions(onChange: (sessions: Session[]) => void): () => void
  addSession(session: Session): void
  updateSession(session: Session): void
  deleteSession(id: string): void
}