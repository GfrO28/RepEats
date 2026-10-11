export const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number]

// Abreviatura de una letra por día (para tiras de calendario); "X" para miércoles, porque "M" ya es martes
export const DAY_ABBREVIATIONS: Record<DayOfWeek, string> = {
  Lunes: 'L',
  Martes: 'M',
  Miércoles: 'X',
  Jueves: 'J',
  Viernes: 'V',
  Sábado: 'S',
  Domingo: 'D',
}
