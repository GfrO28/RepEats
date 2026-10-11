// Tema de la app: el usuario elige Automático (sigue al teléfono), Claro u Oscuro.
export const THEME_PREFERENCES = ['auto', 'light', 'dark'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]

// El tema que realmente se aplica
export type Theme = 'light' | 'dark'

export const THEME_PREFERENCE_LABELS: Record<ThemePreference, string> = {
  auto: 'Automático',
  light: 'Claro',
  dark: 'Oscuro',
}

// Color de la barra del navegador / de estado (coincide con el fondo de cada tema)
export const THEME_BAR_COLORS: Record<Theme, string> = {
  dark: '#0f1115',
  light: '#f1f3f6',
}

// Lo guardado puede venir vacío, de una versión anterior o alterado: cualquier cosa inválida es "Automático"
export function parseThemePreference(raw: unknown): ThemePreference {
  return THEME_PREFERENCES.find((preference) => preference === raw) ?? 'auto'
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): Theme {
  if (preference === 'auto') return systemPrefersDark ? 'dark' : 'light'
  return preference
}
