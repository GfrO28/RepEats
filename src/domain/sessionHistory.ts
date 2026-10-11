import type { CompletedSet, Session } from '@/repositories/SessionRepository'
import { getSessionDate } from './progressSummary'
import type { SetTypes } from './setTypes'

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const
const WEEKDAY_ABBREVIATIONS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const
const MONTH_ABBREVIATIONS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const

// "mié 4 mar": el día de la semana ayuda a reconocer la sesión ("el miércoles de piernas")
export function formatSessionDate(date: Date): string {
  return `${WEEKDAY_ABBREVIATIONS[date.getDay()]} ${date.getDate()} ${MONTH_ABBREVIATIONS[date.getMonth()]}`
}

// '2026-03' → 'Marzo 2026'
export function formatMonthLabel(monthKey: string): string {
  const [year = '', month = '1'] = monthKey.split('-')
  const name: string = MONTH_NAMES[Number(month) - 1] ?? ''
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`
}

export interface MonthGroup {
  monthKey: string // 'YYYY-MM' en hora local
  label: string
  sessions: Session[] // la más reciente primero
}

// Las sesiones completadas, más reciente primero y agrupadas por mes (según el día en que terminaron)
export function groupSessionsByMonth(sessions: readonly Session[]): MonthGroup[] {
  const newestFirst = sessions
    .filter((session) => session.status === 'completed')
    .sort((a, b) => getSessionDate(b).getTime() - getSessionDate(a).getTime())

  const groups: MonthGroup[] = []
  for (const session of newestFirst) {
    const date = getSessionDate(session)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const current = groups[groups.length - 1]
    if (current && current.monthKey === monthKey) {
      current.sessions.push(session)
    } else {
      groups.push({ monthKey, label: formatMonthLabel(monthKey), sessions: [session] })
    }
  }
  return groups
}

export function getSessionDurationSeconds(session: Session): number {
  return Math.max(Math.floor((getSessionDate(session).getTime() - session.startedAt.getTime()) / 1000), 0)
}

// Series efectivas: sin calentamiento
export function countEffectiveSets(session: Session): number {
  return session.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => set.type !== 'Calentamiento').length,
    0,
  )
}

// Los ejercicios en los que se hizo al menos una serie (un ejercicio de la rutina que se saltó no cuenta)
export function countPerformedExercises(session: Session): number {
  return session.exercises.filter((exercise) => exercise.sets.length > 0).length
}

export interface SetGroup {
  type: SetTypes
  count: number
  reps: number
  weight: number
}

// Series seguidas idénticas (mismo tipo, peso y repeticiones) se juntan: cuatro de 60 kg × 8 son "4 × 8 @ 60 kg"
export function summarizeSets(sets: readonly CompletedSet[]): SetGroup[] {
  const groups: SetGroup[] = []
  for (const set of sets) {
    const last = groups[groups.length - 1]
    if (last && last.type === set.type && last.weight === set.weight && last.reps === set.reps) {
      last.count += 1
    } else {
      groups.push({ type: set.type, count: 1, reps: set.reps, weight: set.weight })
    }
  }
  return groups
}

const SET_TYPE_PREFIX: Record<SetTypes, string> = {
  Normal: '',
  Calentamiento: 'Calentamiento: ',
  'Al Fallo': 'Al fallo: ',
  'Drop Set': 'Drop set: ',
}

// "4 × 8 @ 60 kg", "3 × 10 (peso corporal)" o "Calentamiento: 1 × 12 @ 20 kg"
export function formatSetGroup(group: SetGroup): string {
  const load = group.weight > 0 ? ` @ ${group.weight} kg` : ' (peso corporal)'
  return `${SET_TYPE_PREFIX[group.type]}${group.count} × ${group.reps}${load}`
}
