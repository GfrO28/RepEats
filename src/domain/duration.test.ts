import { describe, it, expect } from 'vitest'
import { formatDuration, formatHoursMinutes } from './duration'

describe('formatDuration', () => {
  it('formatea 0 segundos como 0:00', () => {
    expect(formatDuration(0)).toBe('0:00')
  })
  it('formatea 1 minuto con 5 segundos como 1:05', () => {
    expect(formatDuration(65)).toBe('1:05')
  })
  it('formatea 3599 segundos como 59:59 (todavía sin usar horas)', () => {
    expect(formatDuration(3599)).toBe('59:59')
  })
  it('formatea 1 hora 1 minuto 1 segundo como 1:01:01', () => {
    expect(formatDuration(3661)).toBe('1:01:01')
  })
})

describe('formatHoursMinutes', () => {
  it('menos de una hora: solo minutos', () => {
    expect(formatHoursMinutes(0)).toBe('0 min')
    expect(formatHoursMinutes(59)).toBe('0 min')
    expect(formatHoursMinutes(45 * 60)).toBe('45 min')
  })

  it('una hora o más: horas y minutos', () => {
    expect(formatHoursMinutes(3600 + 5 * 60)).toBe('1 h 5 min')
    expect(formatHoursMinutes(3 * 3600 + 20 * 60)).toBe('3 h 20 min')
  })

  it('horas exactas sin "0 min"', () => {
    expect(formatHoursMinutes(2 * 3600)).toBe('2 h')
  })

  it('un valor negativo se trata como 0', () => {
    expect(formatHoursMinutes(-120)).toBe('0 min')
  })
})
