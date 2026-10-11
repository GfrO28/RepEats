import { describe, it, expect, beforeEach, vi } from 'vitest'
import { applyTheme, readThemePreference, saveThemePreference, THEME_STORAGE_KEY } from './theme'

// jsdom no trae matchMedia: se simula si el teléfono está en modo oscuro o claro
function mockSystemDark(isDark: boolean) {
  vi.stubGlobal('matchMedia', () => ({ matches: isDark, addEventListener: () => {} }))
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  document.head.innerHTML = '<meta name="theme-color" content="#000000" />'
})

describe('preferencia guardada', () => {
  it('sin nada guardado es Automático', () => {
    expect(readThemePreference()).toBe('auto')
  })

  it('guarda y lee la preferencia', () => {
    saveThemePreference('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(readThemePreference()).toBe('light')
  })

  it('un valor inválido guardado se trata como Automático', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'noche')
    expect(readThemePreference()).toBe('auto')
  })
})

describe('applyTheme', () => {
  it('Automático toma el modo del teléfono', () => {
    mockSystemDark(false)
    applyTheme('auto')
    expect(document.documentElement.dataset['theme']).toBe('light')

    mockSystemDark(true)
    applyTheme('auto')
    expect(document.documentElement.dataset['theme']).toBe('dark')
  })

  it('Claro y Oscuro mandan sobre el teléfono', () => {
    mockSystemDark(true)
    applyTheme('light')
    expect(document.documentElement.dataset['theme']).toBe('light')

    mockSystemDark(false)
    applyTheme('dark')
    expect(document.documentElement.dataset['theme']).toBe('dark')
  })

  it('tiñe la barra del navegador con el color del tema', () => {
    mockSystemDark(true)
    applyTheme('dark')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0f1115')
    applyTheme('light')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#f1f3f6')
  })
})
