import { describe, it, expect } from 'vitest'
import { isValidNumberText, parseNumberText, formatNumberText } from './numberInput'

describe('isValidNumberText', () => {
  it('acepta textos que son o pueden llegar a ser un número', () => {
    for (const text of ['', '5', '52', '5.', '.5', '2.5', '2,5']) {
      expect(isValidNumberText(text, true)).toBe(true)
    }
  })

  it('rechaza letras, signos y más de un separador', () => {
    for (const text of ['a', '5a', '-5', '1.2.3', '1,2,3', ' 5', '5 ']) {
      expect(isValidNumberText(text, true)).toBe(false)
    }
  })

  it('sin decimales solo acepta dígitos', () => {
    expect(isValidNumberText('12', false)).toBe(true)
    expect(isValidNumberText('', false)).toBe(true)
    expect(isValidNumberText('1.5', false)).toBe(false)
    expect(isValidNumberText('1,5', false)).toBe(false)
  })
})

describe('parseNumberText', () => {
  it('lee enteros y decimales con punto o coma', () => {
    expect(parseNumberText('12')).toBe(12)
    expect(parseNumberText('2.5')).toBe(2.5)
    expect(parseNumberText('2,5')).toBe(2.5)
  })

  it('un número a medio escribir vale lo que ya se ve', () => {
    expect(parseNumberText('5.')).toBe(5)
    expect(parseNumberText('.5')).toBe(0.5)
  })

  it('vacío o un punto suelto valen 0', () => {
    expect(parseNumberText('')).toBe(0)
    expect(parseNumberText('.')).toBe(0)
    expect(parseNumberText(',')).toBe(0)
  })

  it('un cero delante no cambia el valor', () => {
    expect(parseNumberText('05')).toBe(5)
  })
})

describe('formatNumberText', () => {
  it('el 0 se muestra vacío y el resto como número', () => {
    expect(formatNumberText(0)).toBe('')
    expect(formatNumberText(60)).toBe('60')
    expect(formatNumberText(2.5)).toBe('2.5')
  })
})
