// Formatea con los getters locales. No usar toISOString(): convierte a UTC y en Lima (UTC-5) da el día siguiente de noche.
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Inverso de toLocalDateString. No usar new Date('YYYY-MM-DD'): lo interpreta como UTC y en Lima cae en el día anterior.
export function parseLocalDate(dateString: string): Date {
  const [year = 0, month = 1, day = 1] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// Días entre dos fechas 'YYYY-MM-DD' (positivo si "to" es posterior). Se cuenta con las partes del día en UTC:
// así un cambio de hora no da 23 o 25 horas y el resultado es siempre un entero.
export function daysBetweenLocalDates(from: string, to: string): number {
  const toUtcDay = (dateString: string) => {
    const [year = 0, month = 1, day = 1] = dateString.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Math.round((toUtcDay(to) - toUtcDay(from)) / 86_400_000)
}

export function addDaysToLocalDate(dateString: string, days: number): string {
  const date = parseLocalDate(dateString)
  date.setDate(date.getDate() + days)
  return toLocalDateString(date)
}

// '2026-03-05' → '05/03' (día/mes, como se escribe en Perú)
export function formatShortLocalDate(dateString: string): string {
  const [, month = '', day = ''] = dateString.split('-')
  return `${day}/${month}`
}
