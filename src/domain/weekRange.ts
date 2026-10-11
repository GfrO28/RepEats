export function getCurrentWeekRange(referenceDate: Date = new Date()): { start: Date; end: Date } {
  const dayOfWeek = referenceDate.getDay() // 0 = domingo, 1 = lunes, ..., 6 = sábado
  const daysSinceMonday = (dayOfWeek + 6) % 7 // convierte para que lunes sea 0

  const start = new Date(referenceDate)
  start.setDate(referenceDate.getDate() - daysSinceMonday)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}
