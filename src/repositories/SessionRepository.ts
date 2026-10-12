import type { SetTypes } from "@/domain/setTypes"

// Serie hija de un Drop Set: la bajada de peso que sigue a la serie madre, sin descanso entre una y otra
export interface DropSet {
  reps: number
  weight: number
  rir?: number
  completedAt: Date
}

export interface CompletedSet {
  type: SetTypes
  reps: number
  weight: number
  rir?: number
  completedAt: Date
  // Solo en series 'Drop Set' nuevas (puede ser []). Las sesiones viejas, donde cada bajada era una fila suelta,
  // no lo tienen y se leen igual que antes.
  drops?: DropSet[]
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