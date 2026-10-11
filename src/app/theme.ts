import { parseThemePreference, resolveTheme, THEME_BAR_COLORS, type ThemePreference } from '@/domain/theme'

// La preferencia de tema es de este dispositivo (no se sincroniza con Firebase): cada teléfono puede tener la suya.
// index.html repite esta misma regla en un script mínimo para aplicar el tema antes del primer pintado.
export const THEME_STORAGE_KEY = 'repeats-theme'

// localStorage puede no estar disponible (navegación privada, datos bloqueados): en ese caso se usa Automático
export function readThemePreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'auto'
  }
}

export function saveThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // sin almacenamiento: el tema vale solo hasta cerrar la app
  }
}

const systemDarkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)')

// Pone data-theme en <html> (los colores cambian solos, ver index.css) y tiñe la barra del navegador
export function applyTheme(preference: ThemePreference): void {
  const theme = resolveTheme(preference, systemDarkQuery()?.matches ?? true)
  document.documentElement.dataset['theme'] = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BAR_COLORS[theme])
}

// Al arrancar: aplica el tema guardado y, si está en Automático, sigue los cambios del teléfono
export function initTheme(): void {
  applyTheme(readThemePreference())
  systemDarkQuery()?.addEventListener?.('change', () => applyTheme(readThemePreference()))
}
