import { describe, it, expect } from 'vitest'
import {
  calculateWeightTrend,
  calculateTrendRateKgPerWeek,
  isPlausibleWeightKg,
  isSuspiciousJump,
  type WeighIn,
} from './weightTrend'

const w = (date: string, weightKg: number): WeighIn => ({ date, weightKg })

describe('calculateWeightTrend', () => {
  it('sin pesajes devuelve una lista vacía', () => {
    expect(calculateWeightTrend([])).toEqual([])
  })

  it('el primer pesaje es su propia tendencia', () => {
    expect(calculateWeightTrend([w('2026-03-01', 72)])).toEqual([{ date: '2026-03-01', weightKg: 72, trendKg: 72 }])
  })

  it('un peso constante mantiene la tendencia constante', () => {
    const points = calculateWeightTrend([w('2026-03-01', 72), w('2026-03-02', 72), w('2026-03-03', 72)])
    expect(points.map((p) => p.trendKg)).toEqual([72, 72, 72])
  })

  it('un salto de un día mueve la tendencia solo el 10 % hacia el nuevo peso', () => {
    const points = calculateWeightTrend([w('2026-03-01', 72), w('2026-03-02', 73)])
    expect(points[1]?.trendKg).toBeCloseTo(72.1, 10)
  })

  it('con días sin pesar, el nuevo pesaje pesa más', () => {
    const consecutive = calculateWeightTrend([w('2026-03-01', 72), w('2026-03-02', 73)])
    const afterGap = calculateWeightTrend([w('2026-03-01', 72), w('2026-03-08', 73)])
    expect(afterGap[1]?.trendKg).toBeGreaterThan(consecutive[1]?.trendKg ?? 0)
    // 1 - 0.9^7 = 0.5217
    expect(afterGap[1]?.trendKg).toBeCloseTo(72.5217, 3)
  })

  it('una pérdida sostenida hace bajar la tendencia, siempre por detrás del peso real', () => {
    const weighIns = Array.from({ length: 10 }, (_, i) => w(`2026-03-${String(i + 1).padStart(2, '0')}`, 72 - i * 0.1))
    const points = calculateWeightTrend(weighIns)
    const last = points[points.length - 1]
    expect(last?.trendKg).toBeLessThan(72)
    expect(last?.trendKg).toBeGreaterThan(last?.weightKg ?? 0)
  })

  it('ordena por fecha aunque lleguen desordenados y no modifica la lista original', () => {
    const input = [w('2026-03-03', 72), w('2026-03-01', 72), w('2026-03-02', 72)]
    const copy = [...input]
    expect(calculateWeightTrend(input).map((p) => p.date)).toEqual(['2026-03-01', '2026-03-02', '2026-03-03'])
    expect(input).toEqual(copy)
  })

  it('si una fecha se repite, gana el último pesaje', () => {
    const points = calculateWeightTrend([w('2026-03-01', 72), w('2026-03-01', 75)])
    expect(points).toHaveLength(1)
    expect(points[0]?.weightKg).toBe(75)
  })

  it('cruza el fin de mes sin perder días', () => {
    const points = calculateWeightTrend([w('2026-02-28', 72), w('2026-03-01', 73)])
    // 1 día entre ambos (2026 no es bisiesto)
    expect(points[1]?.trendKg).toBeCloseTo(72.1, 10)
  })
})

describe('calculateTrendRateKgPerWeek', () => {
  it('con menos de dos puntos no hay ritmo', () => {
    expect(calculateTrendRateKgPerWeek([])).toBeNull()
    expect(calculateTrendRateKgPerWeek(calculateWeightTrend([w('2026-03-01', 72)]))).toBeNull()
  })

  it('calcula kg por semana a partir de la tendencia', () => {
    const points = [
      { date: '2026-03-01', weightKg: 72, trendKg: 72 },
      { date: '2026-03-15', weightKg: 71, trendKg: 71 },
    ]
    expect(calculateTrendRateKgPerWeek(points)).toBeCloseTo(-0.5, 10)
  })

  it('solo mira la ventana pedida (los últimos 14 días por defecto)', () => {
    const points = [
      { date: '2026-01-01', weightKg: 80, trendKg: 80 },
      { date: '2026-03-01', weightKg: 72, trendKg: 72 },
      { date: '2026-03-15', weightKg: 72, trendKg: 72 },
    ]
    expect(calculateTrendRateKgPerWeek(points)).toBeCloseTo(0, 10)
  })

  it('un peso estable da ritmo 0', () => {
    const points = calculateWeightTrend([w('2026-03-01', 72), w('2026-03-08', 72)])
    expect(calculateTrendRateKgPerWeek(points)).toBeCloseTo(0, 10)
  })
})

describe('isPlausibleWeightKg', () => {
  it('acepta pesos normales, incluidos los bordes del rango', () => {
    expect(isPlausibleWeightKg(72.4)).toBe(true)
    expect(isPlausibleWeightKg(20)).toBe(true)
    expect(isPlausibleWeightKg(400)).toBe(true)
  })

  it('rechaza pesos fuera de rango, cero y valores no numéricos', () => {
    expect(isPlausibleWeightKg(0)).toBe(false)
    expect(isPlausibleWeightKg(19.9)).toBe(false)
    expect(isPlausibleWeightKg(720)).toBe(false)
    expect(isPlausibleWeightKg(-70)).toBe(false)
    expect(isPlausibleWeightKg(Number.NaN)).toBe(false)
    expect(isPlausibleWeightKg(Number.POSITIVE_INFINITY)).toBe(false)
  })
})

describe('isSuspiciousJump', () => {
  it('un cambio de hasta 3 kg respecto a la tendencia es normal (agua, comida)', () => {
    expect(isSuspiciousJump(72, 74.5)).toBe(false)
    expect(isSuspiciousJump(72, 69)).toBe(false)
  })

  it('más de 3 kg, hacia arriba o hacia abajo, es sospechoso', () => {
    expect(isSuspiciousJump(72, 75.1)).toBe(true)
    expect(isSuspiciousJump(72, 68.9)).toBe(true)
    expect(isSuspiciousJump(72, 172)).toBe(true)
  })
})
