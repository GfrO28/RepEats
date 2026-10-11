import { useState } from 'react'

// Preferencias de sí/no que se guardan solo en este dispositivo (no se sincronizan): el sonido y la pantalla
// encendida dependen del teléfono, no de la cuenta.
export const REST_SOUND_KEY = 'repeats-rest-sound'
export const KEEP_AWAKE_KEY = 'repeats-keep-awake'

// localStorage puede no estar disponible (navegación privada, datos bloqueados): se usa el valor por defecto
export function readBooleanPreference(key: string, defaultValue: boolean): boolean {
  try {
    const stored = localStorage.getItem(key)
    if (stored === 'on') return true
    if (stored === 'off') return false
    return defaultValue
  } catch {
    return defaultValue
  }
}

export function saveBooleanPreference(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? 'on' : 'off')
  } catch {
    // sin almacenamiento: el cambio vale hasta cerrar la app
  }
}

export function useBooleanPreference(key: string, defaultValue: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => readBooleanPreference(key, defaultValue))

  function change(next: boolean) {
    setValue(next)
    saveBooleanPreference(key, next)
  }

  return [value, change]
}
