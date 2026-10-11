import type { PhaseType, Macros, PhaseTransition } from '@/domain/nutritionGoals'

export interface Phase {
  id: string
  // TODO: type, startDate, endDate, weeklyRatePercent, targetCalories, macros
  type: PhaseType
  startDate: string
  endDate: string | null
  weeklyRatePercent: number
  targetCalories: number
  macros: Macros
  transition: PhaseTransition | null // solo en las fases de transición; null en las demás
}

export interface PhaseRepository {
  // TODO: los 5 métodos, con el mismo molde que RoutineRepository
    generatePhaseId(): string
    subscribePhases(onChange: (phases: Phase[]) => void): () => void
    addPhase(phase: Phase): void
    updatePhase(phase: Phase): void
    deletePhase(id: string): void
}
