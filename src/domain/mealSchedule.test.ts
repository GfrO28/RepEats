import { describe, it, expect } from 'vitest'
import {
  parseTimeToMinutes,
  formatMinutesToTime,
  resolveMealTimes,
  DEFAULT_FIRST_MEAL_TIME,
  DEFAULT_MEAL_GAP_MINUTES,
  POST_WORKOUT_MINUTES,
} from './mealSchedule'

describe('parseTimeToMinutes', () => {
  it('convierte "HH:mm" a minutos desde medianoche', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0)
    expect(parseTimeToMinutes('06:30')).toBe(390)
    expect(parseTimeToMinutes('23:59')).toBe(1439)
  })

  it('un texto que no es una hora válida da null', () => {
    expect(parseTimeToMinutes('25:00')).toBeNull()
    expect(parseTimeToMinutes('6:30')).toBeNull()
    expect(parseTimeToMinutes('')).toBeNull()
    expect(parseTimeToMinutes('abc')).toBeNull()
  })
})

describe('formatMinutesToTime', () => {
  it('formatea minutos a "HH:mm"', () => {
    expect(formatMinutesToTime(0)).toBe('00:00')
    expect(formatMinutesToTime(390)).toBe('06:30')
    expect(formatMinutesToTime(1439)).toBe('23:59')
  })

  it('envuelve pasada la medianoche', () => {
    expect(formatMinutesToTime(1440)).toBe('00:00')
    expect(formatMinutesToTime(1450)).toBe('00:10')
  })

  it('redondea minutos con decimales', () => {
    expect(formatMinutesToTime(389.6)).toBe('06:30')
  })
})

describe('resolveMealTimes', () => {
  it('sin ninguna hora elegida, la primera comida cae en la hora por defecto', () => {
    const result = resolveMealTimes(['breakfast', 'lunch', 'dinner'], {}, null)
    expect(result.breakfast).toBe(DEFAULT_FIRST_MEAL_TIME)
  })

  it('sin entreno, cada comida siguiente se separa de la anterior por el margen por defecto', () => {
    const result = resolveMealTimes(['breakfast', 'lunch', 'dinner'], {}, null)
    const breakfast = parseTimeToMinutes(result.breakfast as string) as number
    expect(result.lunch).toBe(formatMinutesToTime(breakfast + DEFAULT_MEAL_GAP_MINUTES))
    expect(result.dinner).toBe(formatMinutesToTime(breakfast + 2 * DEFAULT_MEAL_GAP_MINUTES))
  })

  it('una comida con hora elegida se respeta tal cual, y ancla la siguiente', () => {
    const result = resolveMealTimes(['breakfast', 'lunch', 'dinner'], { breakfast: '08:00' }, null)
    expect(result.breakfast).toBe('08:00')
    expect(result.lunch).toBe(formatMinutesToTime(8 * 60 + DEFAULT_MEAL_GAP_MINUTES))
  })

  it('todas las comidas con hora elegida: se usan tal cual, sin encadenar nada', () => {
    const explicit = { breakfast: '07:00', lunch: '12:30', dinner: '20:00' }
    expect(resolveMealTimes(['breakfast', 'lunch', 'dinner'], explicit, null)).toEqual(explicit)
  })

  it('una hora elegida en medio de la cadena ancla lo que sigue, sin importar lo tentativo de antes', () => {
    // El desayuno queda tentativo (07:30); el almuerzo se fijó a mano a las 13:00; la cena se encadena desde ahí
    const result = resolveMealTimes(['breakfast', 'lunch', 'dinner'], { lunch: '13:00' }, null)
    expect(result.breakfast).toBe(DEFAULT_FIRST_MEAL_TIME)
    expect(result.lunch).toBe('13:00')
    expect(result.dinner).toBe(formatMinutesToTime(13 * 60 + DEFAULT_MEAL_GAP_MINUTES))
  })

  it('si el entreno cae en el hueco entre dos comidas, la siguiente se corre a después de entrenar', () => {
    // Desayuno a las 08:00, entreno a las 09:00: el almuerzo (por defecto a las 10:30) caería a media rutina
    const result = resolveMealTimes(['breakfast', 'lunch'], { breakfast: '08:00' }, '09:00')
    expect(result.lunch).toBe(formatMinutesToTime(9 * 60 + POST_WORKOUT_MINUTES))
  })

  it('si el entreno ya pasó antes de la comida anterior, no afecta el margen normal', () => {
    // Desayuno a las 08:00, entreno a las 06:00 (ya pasó): el almuerzo sigue con el margen de siempre
    const result = resolveMealTimes(['breakfast', 'lunch'], { breakfast: '08:00' }, '06:00')
    expect(result.lunch).toBe(formatMinutesToTime(8 * 60 + DEFAULT_MEAL_GAP_MINUTES))
  })

  it('si el entreno cae después del hueco normal, tampoco afecta (ya es la siguiente comida la que decide)', () => {
    const result = resolveMealTimes(['breakfast', 'lunch'], { breakfast: '08:00' }, '13:00')
    expect(result.lunch).toBe(formatMinutesToTime(8 * 60 + DEFAULT_MEAL_GAP_MINUTES))
  })

  it('sin ninguna comida visible, no da nada', () => {
    expect(resolveMealTimes([], {}, null)).toEqual({})
  })
})
