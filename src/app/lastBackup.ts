// Cuándo se exportó por última vez. Se guarda solo en este dispositivo: es un recordatorio, no un dato de la app.
export const LAST_BACKUP_STORAGE_KEY = 'repeats-last-backup'

// localStorage puede no estar disponible (navegación privada, datos bloqueados): en ese caso no hay recordatorio
export function readLastBackup(): Date | null {
  try {
    const stored = localStorage.getItem(LAST_BACKUP_STORAGE_KEY)
    if (!stored) return null
    const date = new Date(stored)
    return Number.isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

export function saveLastBackup(date: Date): void {
  try {
    localStorage.setItem(LAST_BACKUP_STORAGE_KEY, date.toISOString())
  } catch {
    // sin almacenamiento: se pierde solo el recordatorio
  }
}
