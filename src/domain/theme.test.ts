import { describe, it, expect } from 'vitest'
import { parseThemePreference, resolveTheme, THEME_PREFERENCES, THEME_PREFERENCE_LABELS } from './theme'

describe('parseThemePreference', () => {
  it('reconoce las tres opciones', () => {
    expect(parseThemePreference('auto')).toBe('auto')
    expect(parseThemePreference('light')).toBe('light')
    expect(parseThemePreference('dark')).toBe('dark')
  })

  it('cualquier otro valor es Automático', () => {
    for (const raw of [null, undefined, '', 'Dark', 'night', 'oscuro', 3, {}, []]) {
      expect(parseThemePreference(raw)).toBe('auto')
    }
  })
})

describe('resolveTheme', () => {
  it('Automático sigue al teléfono', () => {
    expect(resolveTheme('auto', true)).toBe('dark')
    expect(resolveTheme('auto', false)).toBe('light')
  })

  it('Claro y Oscuro ignoran al teléfono', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('THEME_PREFERENCE_LABELS', () => {
  it('cada opción tiene su etiqueta en español', () => {
    expect(THEME_PREFERENCES.map((preference) => THEME_PREFERENCE_LABELS[preference])).toEqual([
      'Automático',
      'Claro',
      'Oscuro',
    ])
  })
})
