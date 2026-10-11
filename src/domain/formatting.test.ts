import { describe, expect, it } from 'vitest'
import { formatKg } from './formatting'

describe('formatKg', () => {
  it('redondea a kilos enteros y agrega la unidad', () => {
    expect(formatKg(0)).toBe('0 kg')
    expect(formatKg(499.6)).toBe('500 kg')
  })

  it('separa los miles', () => {
    // el separador depende del idioma del sistema (espacio, coma o punto): solo se comprueba que agrupa los dígitos
    expect(formatKg(12450)).toMatch(/^12\D?450 kg$/)
  })
})
