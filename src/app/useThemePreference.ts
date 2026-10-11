import { useState } from 'react'
import type { ThemePreference } from '@/domain/theme'
import { applyTheme, readThemePreference, saveThemePreference } from './theme'

// La preferencia elegida y una función para cambiarla (se guarda y se aplica al instante)
export function useThemePreference(): [ThemePreference, (preference: ThemePreference) => void] {
  const [preference, setPreference] = useState(readThemePreference)

  function changePreference(next: ThemePreference) {
    setPreference(next)
    saveThemePreference(next)
    applyTheme(next)
  }

  return [preference, changePreference]
}
