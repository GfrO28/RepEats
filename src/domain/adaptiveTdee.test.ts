import { describe, it, expect } from 'vitest'
import { addDaysToLocalDate } from './localDate'
import {
  calculateObservedTdee,
  blendTdee,
  resolveTdee,
  canUpdateTdee,
  getNextTdeeUpdateDate,
  proposeTdeeUpdate,
  INSUFFICIENT_REASON_MESSAGES,
  MAX_TDEE_CHANGE_KCAL,
  type DailyIntake,
} from './adaptiveTdee'
import type { WeighIn } from './weightTrend'

const START = '2026-03-01'
const day = (offset: number) => addDaysToLocalDate(START, offset)

// Un pesaje y una ingesta cada día, de START a START + days − 1
function makeData(days: number, weightAt: (i: number) => number, kcalAt: (i: number) => number) {
  const weighIns: WeighIn[] = []
  const intakes: DailyIntake[] = []
  for (let i = 0; i < days; i++) {
    weighIns.push({ date: day(i), weightKg: weightAt(i) })
    intakes.push({ date: day(i), kcal: kcalAt(i) })
  }
  return { weighIns, intakes, endDate: day(days - 1) }
}

describe('calculateObservedTdee', () => {
  it('con peso estable, el gasto observado es lo que comes', () => {
    const data = makeData(21, () => 72, () => 2400)
    const result = calculateObservedTdee(data)
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.observedTdee).toBeCloseTo(2400, 5)
      expect(result.trendChangeKg).toBeCloseTo(0, 10)
      expect(result.loggedDays).toBe(21)
    }
  })

  it('si bajas de peso comiendo 2000, tu gasto es mayor que 2000', () => {
    // 0.05 kg por día menos: 0.05 × 7700 = 385 kcal/día de déficit real (la tendencia lo sigue con retraso)
    const data = makeData(21, (i) => 72 - i * 0.05, () => 2000)
    const result = calculateObservedTdee(data)
    expect(result.status === 'ok' && result.observedTdee).toBeGreaterThan(2000)
    expect(result.status === 'ok' && result.trendChangeKg).toBeLessThan(0)
  })

  it('si subes de peso comiendo 2500, tu gasto es menor que 2500', () => {
    const data = makeData(21, (i) => 72 + i * 0.05, () => 2500)
    const result = calculateObservedTdee(data)
    expect(result.status === 'ok' && result.observedTdee).toBeLessThan(2500)
  })

  it('un salto de un solo día en la balanza casi no mueve el resultado', () => {
    const steady = calculateObservedTdee(makeData(21, () => 72, () => 2400))
    const noisy = calculateObservedTdee(makeData(21, (i) => (i === 20 ? 74 : 72), () => 2400))
    if (steady.status !== 'ok' || noisy.status !== 'ok') throw new Error('se esperaba un resultado')
    // Con el peso crudo serían 2 kg × 7700 / 20 días ≈ 770 kcal de diferencia; con la tendencia, mucho menos
    expect(Math.abs(noisy.observedTdee - steady.observedTdee)).toBeLessThan(200)
  })

  it('con pocos pesajes no calcula', () => {
    const data = makeData(21, () => 72, () => 2400)
    const fewWeighIns = data.weighIns.filter((_, i) => i % 6 === 0) // 4 pesajes: días 0, 6, 12, 18
    expect(calculateObservedTdee({ ...data, weighIns: fewWeighIns })).toEqual({
      status: 'insufficient',
      reason: 'fewWeighIns',
    })
  })

  it('con pesajes muy juntos no calcula (periodo corto)', () => {
    const data = makeData(21, () => 72, () => 2400)
    const closeTogether = data.weighIns.slice(8, 15) // 7 pesajes en 7 días
    expect(calculateObservedTdee({ ...data, weighIns: closeTogether })).toEqual({
      status: 'insufficient',
      reason: 'shortSpan',
    })
  })

  it('con pocos días de diario no calcula', () => {
    const data = makeData(21, () => 72, () => 2400)
    const fewIntakes = data.intakes.filter((_, i) => i % 3 === 0) // 7 días
    expect(calculateObservedTdee({ ...data, intakes: fewIntakes })).toEqual({
      status: 'insufficient',
      reason: 'fewLoggedDays',
    })
  })

  it('un día anotado a medias (menos de 800 kcal) no cuenta como registrado', () => {
    const data = makeData(21, () => 72, (i) => (i % 2 === 0 ? 2400 : 300)) // 11 completos, 10 a medias
    const result = calculateObservedTdee(data)
    expect(result.status === 'ok' && result.loggedDays).toBe(11)
    expect(result.status === 'ok' && result.averageIntakeKcal).toBe(2400) // los días a medias no bajan el promedio

    const tooManyPartial = makeData(21, () => 72, (i) => (i < 9 ? 2400 : 300))
    expect(calculateObservedTdee(tooManyPartial)).toEqual({ status: 'insufficient', reason: 'fewLoggedDays' })
  })

  it('un resultado imposible se descarta como dato erróneo', () => {
    // Bajar 3 kg en 3 semanas comiendo 1200 daría un gasto de ~2300; con 20 kg da un valor absurdo
    const data = makeData(21, (i) => 90 - i * 1.5, () => 1500)
    expect(calculateObservedTdee(data)).toEqual({ status: 'insufficient', reason: 'implausible' })
  })

  it('ignora los datos fuera de la ventana de 21 días', () => {
    const recent = makeData(21, () => 72, () => 2400)
    // 30 días antes: un peso y una ingesta muy distintos que no deben influir
    const oldWeighIns: WeighIn[] = [{ date: day(-30), weightKg: 95 }]
    const oldIntakes: DailyIntake[] = [{ date: day(-30), kcal: 5000 }]
    const withOld = calculateObservedTdee({
      ...recent,
      weighIns: [...oldWeighIns, ...recent.weighIns],
      intakes: [...oldIntakes, ...recent.intakes],
    })
    const withoutOld = calculateObservedTdee(recent)
    if (withOld.status !== 'ok' || withoutOld.status !== 'ok') throw new Error('se esperaba un resultado')
    expect(withOld.averageIntakeKcal).toBe(withoutOld.averageIntakeKcal)
    expect(withOld.spanDays).toBe(20)
  })

  it('sin datos no calcula', () => {
    expect(calculateObservedTdee({ endDate: '2026-03-21', weighIns: [], intakes: [] })).toEqual({
      status: 'insufficient',
      reason: 'fewWeighIns',
    })
  })
})

describe('blendTdee', () => {
  it('mueve el estimado un 30 % hacia el observado', () => {
    expect(blendTdee(2400, 2500)).toBe(2430)
    expect(blendTdee(2400, 2300)).toBe(2370)
  })

  it('no cambia si estimado y observado coinciden', () => {
    expect(blendTdee(2400, 2400)).toBe(2400)
  })

  it('limita el cambio por actualización', () => {
    expect(blendTdee(2400, 3400)).toBe(2400 + MAX_TDEE_CHANGE_KCAL)
    expect(blendTdee(2400, 1400)).toBe(2400 - MAX_TDEE_CHANGE_KCAL)
  })

  it('devuelve un entero', () => {
    expect(Number.isInteger(blendTdee(2401, 2450))).toBe(true)
  })
})

describe('resolveTdee', () => {
  it('sin gasto ajustado usa la fórmula con el nivel de actividad', () => {
    expect(resolveTdee(1580, 'moderate', null)).toBeCloseTo(1580 * 1.55, 5)
  })

  it('con gasto ajustado usa ese, sin importar el nivel de actividad', () => {
    expect(resolveTdee(1580, 'moderate', { kcal: 2300, updatedAt: '2026-03-01' })).toBe(2300)
  })
})

describe('canUpdateTdee / getNextTdeeUpdateDate', () => {
  const adjusted = { kcal: 2300, updatedAt: '2026-03-01' }

  it('si nunca se ajustó, se puede ya', () => {
    expect(getNextTdeeUpdateDate(null)).toBeNull()
    expect(canUpdateTdee(null, '2026-03-01')).toBe(true)
  })

  it('el mismo día del ajuste y hasta 6 días después no se puede', () => {
    expect(canUpdateTdee(adjusted, '2026-03-01')).toBe(false)
    expect(canUpdateTdee(adjusted, '2026-03-07')).toBe(false)
  })

  it('a los 7 días ya se puede, y el primer día disponible es ese', () => {
    expect(getNextTdeeUpdateDate(adjusted)).toBe('2026-03-08')
    expect(canUpdateTdee(adjusted, '2026-03-08')).toBe(true)
    expect(canUpdateTdee(adjusted, '2026-04-01')).toBe(true)
  })

  it('cruza el fin de mes al calcular el próximo día', () => {
    expect(getNextTdeeUpdateDate({ kcal: 2300, updatedAt: '2026-02-25' })).toBe('2026-03-04')
  })
})

describe('proposeTdeeUpdate', () => {
  it('propone la mezcla y calcula el cambio', () => {
    expect(proposeTdeeUpdate(2400, 2600)).toEqual({ proposedTdee: 2460, changeKcal: 60, isMeaningful: true })
  })

  it('un cambio menor a 25 kcal no se considera relevante', () => {
    const proposal = proposeTdeeUpdate(2400, 2440) // mezcla: +12
    expect(proposal.changeKcal).toBe(12)
    expect(proposal.isMeaningful).toBe(false)
  })

  it('una baja también cuenta', () => {
    expect(proposeTdeeUpdate(2400, 2200)).toEqual({ proposedTdee: 2340, changeKcal: -60, isMeaningful: true })
  })

  it('con el gasto actual fraccionario compara contra el redondeado', () => {
    // 2401.4 → 2401; mezcla de 2500: 2401.4 + 29.58 = 2431 → cambio 30
    expect(proposeTdeeUpdate(2401.4, 2500).changeKcal).toBe(30)
  })
})

describe('INSUFFICIENT_REASON_MESSAGES', () => {
  it('hay un mensaje para cada motivo, con los mínimos reales', () => {
    expect(INSUFFICIENT_REASON_MESSAGES.fewWeighIns).toContain('5')
    expect(INSUFFICIENT_REASON_MESSAGES.fewLoggedDays).toContain('10')
    expect(INSUFFICIENT_REASON_MESSAGES.shortSpan).toContain('14')
    expect(INSUFFICIENT_REASON_MESSAGES.implausible).not.toBe('')
  })
})
