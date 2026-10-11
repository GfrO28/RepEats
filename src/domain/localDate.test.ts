import { describe, it, expect } from 'vitest'
import {
  toLocalDateString,
  parseLocalDate,
  addDaysToLocalDate,
  daysBetweenLocalDates,
  formatShortLocalDate,
} from './localDate'

describe('daysBetweenLocalDates', () => {
  it('cuenta los días entre dos fechas', () => {
    expect(daysBetweenLocalDates('2026-03-01', '2026-03-15')).toBe(14)
  })

  it('la misma fecha da 0 y una anterior da negativo', () => {
    expect(daysBetweenLocalDates('2026-03-01', '2026-03-01')).toBe(0)
    expect(daysBetweenLocalDates('2026-03-15', '2026-03-01')).toBe(-14)
  })

  it('cruza el fin de mes y de año', () => {
    expect(daysBetweenLocalDates('2026-02-27', '2026-03-02')).toBe(3)
    expect(daysBetweenLocalDates('2025-12-30', '2026-01-02')).toBe(3)
  })

  it('un año bisiesto tiene 29 de febrero', () => {
    expect(daysBetweenLocalDates('2028-02-28', '2028-03-01')).toBe(2)
    expect(daysBetweenLocalDates('2027-02-28', '2027-03-01')).toBe(1)
  })
})

describe('toLocalDateString', () => {
  it('rellena mes y día con cero', () => {
    expect(toLocalDateString(new Date(2026, 2, 5))).toBe('2026-03-05')
  })

  it('un día de dos dígitos no lleva relleno', () => {
    expect(toLocalDateString(new Date(2026, 11, 25))).toBe('2026-12-25')
  })

  it('casi medianoche sigue siendo el mismo día local', () => {
    expect(toLocalDateString(new Date(2026, 0, 1, 23, 30))).toBe('2026-01-01')
  })

  it('primer instante del día', () => {
    expect(toLocalDateString(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01')
  })
})

describe('parseLocalDate', () => {
  it('crea la fecha a medianoche local, sin corrimiento de día', () => {
    const date = parseLocalDate('2026-03-05')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(2)
    expect(date.getDate()).toBe(5)
    expect(date.getHours()).toBe(0)
  })

  it('es el inverso de toLocalDateString', () => {
    expect(toLocalDateString(parseLocalDate('2026-12-31'))).toBe('2026-12-31')
  })
})

describe('addDaysToLocalDate', () => {
  it('avanza un día dentro del mes', () => {
    expect(addDaysToLocalDate('2026-03-05', 1)).toBe('2026-03-06')
  })

  it('cruza el fin de mes', () => {
    expect(addDaysToLocalDate('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('cruza el fin de año', () => {
    expect(addDaysToLocalDate('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('retrocede al mes anterior', () => {
    expect(addDaysToLocalDate('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('respeta los años bisiestos', () => {
    expect(addDaysToLocalDate('2028-03-01', -1)).toBe('2028-02-29')
  })

  it('sumar 0 días devuelve la misma fecha', () => {
    expect(addDaysToLocalDate('2026-09-25', 0)).toBe('2026-09-25')
  })
})

describe('formatShortLocalDate', () => {
  it('da día/mes con ceros', () => {
    expect(formatShortLocalDate('2026-03-05')).toBe('05/03')
    expect(formatShortLocalDate('2026-12-25')).toBe('25/12')
  })
})
