import { describe, expect, it } from 'vitest'
import { buildIntensityBodyData, getSetIntensity, INTENSITY_LEVELS } from './bodyHighlighterMapping'

describe('getSetIntensity', () => {
  it('sin series no hay intensidad', () => {
    expect(getSetIntensity(0)).toBe(0)
  })

  it('sube por tramos: 1-4, 5-9, 10-15, 16 o más', () => {
    expect(getSetIntensity(1)).toBe(1)
    expect(getSetIntensity(4)).toBe(1)
    expect(getSetIntensity(5)).toBe(2)
    expect(getSetIntensity(9)).toBe(2)
    expect(getSetIntensity(10)).toBe(3)
    expect(getSetIntensity(15)).toBe(3)
    expect(getSetIntensity(16)).toBe(4)
    expect(getSetIntensity(60)).toBe(4)
  })

  it('nunca supera el máximo de niveles', () => {
    expect(getSetIntensity(1000)).toBe(INTENSITY_LEVELS)
  })
})

describe('buildIntensityBodyData', () => {
  it('sin series no ilumina nada', () => {
    expect(buildIntensityBodyData({})).toEqual([])
    expect(buildIntensityBodyData({ Pectorales: 0 })).toEqual([])
  })

  it('un grupo ilumina su región con su intensidad', () => {
    expect(buildIntensityBodyData({ Pectorales: 12 })).toEqual([{ name: 'chest', muscles: ['chest'], frequency: 3 }])
  })

  it('un grupo con varias regiones (Hombros) las ilumina todas', () => {
    const data = buildIntensityBodyData({ Hombros: 6 })
    expect(data.map((entry) => entry.name).sort()).toEqual(['back-deltoids', 'front-deltoids'])
    expect(data.every((entry) => entry.frequency === 2)).toBe(true)
  })

  it('dos grupos en la misma región (Dorsales y Espalda alta) usan el de más series, sin duplicar la región', () => {
    const data = buildIntensityBodyData({ Dorsales: 3, 'Espalda alta': 17 })
    expect(data).toEqual([{ name: 'upper-back', muscles: ['upper-back'], frequency: 4 }])
  })

  it('un grupo sin dibujo propio y no mapeado no rompe nada', () => {
    expect(() => buildIntensityBodyData({ 'Flexores de cadera': 5 })).not.toThrow()
  })
})
