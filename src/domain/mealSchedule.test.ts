import { describe, it, expect } from 'vitest'
import {
  parseTimeToMinutes,
  formatMinutesToTime,
  resolveMealTimes,
  DEFAULT_FIRST_MEAL_TIME,
  ASSUMED_DAY_SPAN_MINUTES,
  PRE_WORKOUT_MINUTES,
  POST_WORKOUT_MINUTES,
} from './mealSchedule'
import type { MealType } from './mealTypes'

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

describe('resolveMealTimes: reparto parejo a lo largo del día', () => {
  it('sin ninguna hora elegida, la primera comida cae en la hora por defecto', () => {
    const result = resolveMealTimes(['breakfast', 'lunch', 'dinner'], {}, null)
    expect(result.breakfast).toBe(DEFAULT_FIRST_MEAL_TIME)
  })

  it('reparte las demás comidas parejo entre la primera y "primera + 14 h" (sin entreno)', () => {
    // 07:30 a 21:30 (14 h), 3 comidas ancladas en ambos extremos: la del medio cae justo a la mitad
    const result = resolveMealTimes(['breakfast', 'lunch', 'dinner'], {}, null)
    expect(result).toEqual({ breakfast: '07:30', lunch: '14:30', dinner: '21:30' })
  })

  it('si eliges a mano la hora de la primera comida, todo el día se recalcula desde ahí', () => {
    // Desayuno a las 08:00: el día activo va de 08:00 a 22:00 (8+14=22)
    const result = resolveMealTimes(['breakfast', 'lunch', 'dinner'], { breakfast: '08:00' }, null)
    expect(result).toEqual({ breakfast: '08:00', lunch: '15:00', dinner: '22:00' })
  })

  it('una comida elegida a mano en el medio del día es también un ancla: solo reacomoda lo que la rodea', () => {
    // Desayuno sigue tentativo (07:30 por defecto); almuerzo se fija a mano a las 13:00; la cena es la única
    // comida que queda hasta el final del día asumido (21:30), así que cae justo ahí
    const result = resolveMealTimes(['breakfast', 'lunch', 'dinner'], { lunch: '13:00' }, null)
    expect(result.breakfast).toBe(DEFAULT_FIRST_MEAL_TIME)
    expect(result.lunch).toBe('13:00')
    expect(result.dinner).toBe('21:30')
  })

  it('con dos comidas entre dos anclas elegidas a mano, se reparten parejo en ese tramo (ninguna toca las anclas)', () => {
    const result = resolveMealTimes(
      ['breakfast', 'midMorning', 'lunch', 'midAfternoon', 'dinner'],
      { breakfast: '07:00', dinner: '20:00' },
      null,
    )
    // Entre las 07:00 (ancla) y las 20:00 (ancla, 780 min de distancia) hay 3 comidas: se reparten en cuartos
    expect(result.breakfast).toBe('07:00')
    expect(result.midMorning).toBe('10:15') // 07:00 + 780/4 min
    expect(result.lunch).toBe('13:30') // punto medio
    expect(result.midAfternoon).toBe('16:45')
    expect(result.dinner).toBe('20:00')
  })

  it('todas las comidas con hora elegida a mano: se usan tal cual, sin recalcular nada', () => {
    const explicit = { breakfast: '07:00', lunch: '12:30', dinner: '20:00' }
    expect(resolveMealTimes(['breakfast', 'lunch', 'dinner'], explicit, null)).toEqual(explicit)
  })

  it('sin ninguna comida visible, no da nada', () => {
    expect(resolveMealTimes([], {}, null)).toEqual({})
  })

  it('una sola comida visible: cae en la hora elegida o la de por defecto, sin más cálculo', () => {
    expect(resolveMealTimes(['breakfast'], {}, null)).toEqual({ breakfast: DEFAULT_FIRST_MEAL_TIME })
    expect(resolveMealTimes(['breakfast'], { breakfast: '09:00' }, null)).toEqual({ breakfast: '09:00' })
  })

  it('el bloque asumido es de 14 h, como se acordó con el dueño de la app', () => {
    expect(ASSUMED_DAY_SPAN_MINUTES).toBe(14 * 60)
  })
})

describe('resolveMealTimes: entreno', () => {
  const ALL_MEALS: MealType[] = ['breakfast', 'midMorning', 'lunch', 'midAfternoon', 'dinner', 'snack']

  it('con hora de entreno, dedica una comida ~2 h antes y otra después de rutina + volver a casa', () => {
    const result = resolveMealTimes(ALL_MEALS, {}, '18:00')
    const preWorkoutTime = formatMinutesToTime(18 * 60 - PRE_WORKOUT_MINUTES)
    const postWorkoutTime = formatMinutesToTime(18 * 60 + POST_WORKOUT_MINUTES)
    expect(Object.values(result)).toContain(preWorkoutTime)
    expect(Object.values(result)).toContain(postWorkoutTime)
  })

  it('todas las horas quedan dentro del bloque de 14 h, en orden', () => {
    const result = resolveMealTimes(ALL_MEALS, {}, '18:00')
    const start = parseTimeToMinutes(DEFAULT_FIRST_MEAL_TIME) as number
    const end = start + ASSUMED_DAY_SPAN_MINUTES
    const times = ALL_MEALS.map((type) => parseTimeToMinutes(result[type] as string) as number)
    for (const minutes of times) {
      expect(minutes).toBeGreaterThanOrEqual(start)
      expect(minutes).toBeLessThanOrEqual(end)
    }
    for (let index = 1; index < times.length; index++) {
      expect(times[index]).toBeGreaterThan(times[index - 1] as number)
    }
  })

  it('una hora de entreno fuera del bloque de 14 h se ignora (reparte parejo)', () => {
    const withTraining = resolveMealTimes(['breakfast', 'lunch', 'dinner'], {}, '23:30')
    const withoutTraining = resolveMealTimes(['breakfast', 'lunch', 'dinner'], {}, null)
    expect(withTraining).toEqual(withoutTraining)
  })

  it('entrenar poco después de la primera comida igual deja comidas después, sin pisar la primera (regresión)', () => {
    // Desayuno a las 07:30 (por defecto), entrenas a las 09:00 (90 min después, menos que el margen pre-entreno
    // de 120 min): no hay hueco para una comida "antes" aparte del desayuno mismo, así que todo se corre después
    const result = resolveMealTimes(['breakfast', 'lunch', 'dinner'], {}, '09:00')
    expect(result.breakfast).toBe('07:30')
    expect(parseTimeToMinutes(result.lunch as string) as number).toBeGreaterThan(parseTimeToMinutes('09:00') as number)
  })

  it('la comida post-entreno cuenta la rutina + volver a casa, no solo el inicio del entreno (regresión)', () => {
    // Entrenas a las 09:00: ~1 h de rutina + ~1 h de vuelta a casa -> libre para comer recién a las 11:00
    const result = resolveMealTimes(['breakfast', 'midMorning', 'lunch', 'dinner'], {}, '09:00')
    expect(result.midMorning).toBe('11:00')
  })

  it('con una comida fijada a mano antes del entreno, el tramo siguiente reserva su propio "antes" y "después"', () => {
    // Almuerzo fijado a mano a las 13:00; entrenas a las 18:00 (sub-tramo: 13:00 a 21:30, un bloque propio)
    const result = resolveMealTimes(['breakfast', 'lunch', 'dinner', 'snack'], { lunch: '13:00' }, '18:00')
    const preWorkoutTime = formatMinutesToTime(18 * 60 - PRE_WORKOUT_MINUTES)
    const postWorkoutTime = formatMinutesToTime(18 * 60 + POST_WORKOUT_MINUTES)
    expect(result.dinner).toBe(preWorkoutTime) // la primera comida del tramo: la que queda antes del entreno
    expect(result.snack).toBe(postWorkoutTime) // la segunda: después de rutina + volver a casa
  })

  it('el entreno puede caer del otro lado de la medianoche respecto a la primera comida', () => {
    // Primera comida a las 22:00 (turno noche); entrenas a la 01:00 (del "día siguiente" en el reloj, pero
    // dentro del mismo bloque de 14 h: 22:00 + 14h = 12:00 del día siguiente)
    const result = resolveMealTimes(['breakfast', 'lunch', 'dinner'], { breakfast: '22:00' }, '01:00')
    expect(result.lunch).toBe('23:00') // 01:00 "extendido" (25:00) menos 2 h
    expect(result.dinner).toBe('03:00') // 01:00 "extendido" más rutina + volver a casa
  })
})
