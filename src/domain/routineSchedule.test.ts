import { describe, expect, it } from 'vitest'
import type { Routine } from '@/repositories/RoutineRepository'
import { getDayOfWeek, getRoutinesForDay, getTrainingTimeForDay } from './routineSchedule'

describe('getDayOfWeek', () => {
  it('da el día en español, con lunes primero', () => {
    expect(getDayOfWeek(new Date(2026, 2, 2))).toBe('Lunes') // 2 de marzo de 2026 es lunes
    expect(getDayOfWeek(new Date(2026, 2, 3))).toBe('Martes')
    expect(getDayOfWeek(new Date(2026, 2, 4))).toBe('Miércoles')
    expect(getDayOfWeek(new Date(2026, 2, 5))).toBe('Jueves')
    expect(getDayOfWeek(new Date(2026, 2, 6))).toBe('Viernes')
    expect(getDayOfWeek(new Date(2026, 2, 7))).toBe('Sábado')
    expect(getDayOfWeek(new Date(2026, 2, 8))).toBe('Domingo')
  })

  it('no le importa la hora del día, solo la fecha', () => {
    expect(getDayOfWeek(new Date(2026, 2, 2, 23, 59))).toBe('Lunes')
  })
})

const routine = (id: string, suggestedDay: string, suggestedTime: string | null = null): Routine => ({
  id,
  name: id,
  suggestedDay,
  suggestedTime,
  exercises: [],
  order: 0,
})

describe('getRoutinesForDay', () => {
  it('filtra por el día sugerido, respetando el orden recibido', () => {
    const routines = [routine('a', 'Lunes'), routine('b', 'Martes'), routine('c', 'Lunes')]
    expect(getRoutinesForDay(routines, 'Lunes').map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('dos rutinas pueden compartir el mismo día (p. ej. alternadas)', () => {
    const routines = [routine('a', 'Lunes'), routine('b', 'Lunes')]
    expect(getRoutinesForDay(routines, 'Lunes')).toHaveLength(2)
  })

  it('sin ninguna rutina ese día, devuelve una lista vacía', () => {
    expect(getRoutinesForDay([routine('a', 'Lunes')], 'Domingo')).toEqual([])
  })
})

describe('getTrainingTimeForDay', () => {
  it('la hora de la rutina sugerida ese día, si la tiene', () => {
    const routines = [routine('a', 'Lunes', '18:00')]
    expect(getTrainingTimeForDay(routines, 'Lunes')).toBe('18:00')
  })

  it('sin ninguna rutina ese día, no hay hora', () => {
    expect(getTrainingTimeForDay([routine('a', 'Lunes', '18:00')], 'Domingo')).toBeNull()
  })

  it('con rutina ese día pero sin hora configurada, no hay hora', () => {
    expect(getTrainingTimeForDay([routine('a', 'Lunes', null)], 'Lunes')).toBeNull()
  })

  it('con varias rutinas ese día, usa la primera que sí tenga hora', () => {
    const routines = [routine('a', 'Lunes', null), routine('b', 'Lunes', '07:00')]
    expect(getTrainingTimeForDay(routines, 'Lunes')).toBe('07:00')
  })
})
