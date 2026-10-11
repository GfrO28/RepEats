import type { Routine } from '@/repositories/RoutineRepository'
import { DAYS_OF_WEEK, type DayOfWeek } from './daysOfWeek'

// El día de la semana de una fecha, en el mismo orden que DAYS_OF_WEEK (lunes primero), igual que getCurrentWeekRange
export function getDayOfWeek(date: Date): DayOfWeek {
  return DAYS_OF_WEEK[(date.getDay() + 6) % 7] ?? 'Lunes'
}

// Las rutinas sugeridas para un día en particular, respetando el orden en que vinieron (ordénalas antes si hace falta).
// Nada impide que dos rutinas compartan el mismo día sugerido (p. ej. "Piernas A" y "Piernas B" alternadas).
export function getRoutinesForDay(routines: readonly Routine[], day: DayOfWeek): Routine[] {
  return routines.filter((routine) => routine.suggestedDay === day)
}

// La hora de entreno de ese día: la de la primera rutina sugerida ese día que tenga una hora configurada (en el
// orden recibido). Sirve para calcular a qué hora conviene comer antes/después de entrenar (ver `mealSchedule.ts`).
export function getTrainingTimeForDay(routines: readonly Routine[], day: DayOfWeek): string | null {
  const withTime = getRoutinesForDay(routines, day).find((routine) => routine.suggestedTime)
  return withTime?.suggestedTime ?? null
}
