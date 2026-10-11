import { describe, expect, it } from 'vitest'
import type { Routine } from '@/repositories/RoutineRepository'
import { getNextRoutineOrder, reindexRoutines, sortRoutinesByOrder } from './routineOrder'

const routine = (id: string, name: string, order: number): Routine => ({
  id,
  name,
  suggestedDay: 'Lunes',
  suggestedTime: null,
  exercises: [],
  order,
})

describe('sortRoutinesByOrder', () => {
  it('ordena por "order" ascendente', () => {
    const routines = [routine('c', 'Pull', 2), routine('a', 'Piernas', 0), routine('b', 'Push', 1)]
    expect(sortRoutinesByOrder(routines).map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('no modifica la lista original', () => {
    const routines = [routine('b', 'Push', 1), routine('a', 'Piernas', 0)]
    const copy = [...routines]
    sortRoutinesByOrder(routines)
    expect(routines).toEqual(copy)
  })

  it('las rutinas sin "order" quedan al final, ordenadas entre sí por nombre', () => {
    const withOrder = routine('a', 'Piernas', 0)
    const sinOrden1 = { ...routine('b', 'Pull', 0), order: undefined as unknown as number }
    const sinOrden2 = { ...routine('c', 'Empuje', 0), order: undefined as unknown as number }
    const result = sortRoutinesByOrder([sinOrden1, withOrder, sinOrden2])
    expect(result.map((r) => r.id)).toEqual(['a', 'c', 'b']) // Piernas (order 0), luego Empuje y Pull por nombre
  })

  it('una lista vacía devuelve una lista vacía', () => {
    expect(sortRoutinesByOrder([])).toEqual([])
  })
})

describe('getNextRoutineOrder', () => {
  it('sin rutinas, la primera va en 0', () => {
    expect(getNextRoutineOrder([])).toBe(0)
  })

  it('la siguiente rutina va después de la de mayor "order"', () => {
    const routines = [routine('a', 'Piernas', 0), routine('b', 'Push', 3), routine('c', 'Pull', 1)]
    expect(getNextRoutineOrder(routines)).toBe(4)
  })

  it('si alguna rutina no tiene "order", se ignora para este cálculo (no rompe con NaN)', () => {
    const sinOrden = { ...routine('x', 'Vieja', 0), order: undefined as unknown as number }
    expect(getNextRoutineOrder([sinOrden, routine('a', 'Piernas', 2)])).toBe(3)
  })
})

describe('reindexRoutines', () => {
  it('renumera 0, 1, 2... según el orden del array recibido', () => {
    const routines = [routine('c', 'Pull', 99), routine('a', 'Piernas', 5), routine('b', 'Push', 0)]
    const result = reindexRoutines(routines)
    expect(result.map((r) => r.order)).toEqual([0, 1, 2])
    expect(result.map((r) => r.id)).toEqual(['c', 'a', 'b']) // conserva el orden del array, no lo reordena
  })

  it('devuelve objetos nuevos, sin mutar los originales', () => {
    const original = routine('a', 'Piernas', 5)
    const [result] = reindexRoutines([original])
    expect(result).not.toBe(original)
    expect(original.order).toBe(5)
    expect(result?.order).toBe(0)
  })
})
