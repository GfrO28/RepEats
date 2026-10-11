import { daysBetweenLocalDates } from './localDate'

export interface WeighIn {
  date: string // 'YYYY-MM-DD' en hora local
  weightKg: number
}

export interface TrendPoint extends WeighIn {
  trendKg: number
}

export const MIN_WEIGHT_KG = 20
export const MAX_WEIGHT_KG = 400
// Un cambio mayor que esto respecto a la tendencia en un solo día casi seguro es un error al teclear (o un pesaje raro)
export const SUSPICIOUS_JUMP_KG = 3

// Rango en el que un peso tiene sentido; fuera de él se rechaza (p. ej. 720 en vez de 72.0)
export function isPlausibleWeightKg(weightKg: number): boolean {
  return Number.isFinite(weightKg) && weightKg >= MIN_WEIGHT_KG && weightKg <= MAX_WEIGHT_KG
}

// ¿Se aleja demasiado de la tendencia actual? Sirve para preguntar "¿es correcto?" sin bloquear el guardado
export function isSuspiciousJump(trendKg: number, weightKg: number): boolean {
  return Math.abs(weightKg - trendKg) > SUSPICIOUS_JUMP_KG
}

// Cuánto pesa cada día nuevo en el peso de tendencia (0.1 = el clásico "Hacker's Diet": la tendencia
// se mueve un 10 % hacia el peso de cada día). Más bajo = más suave pero más lento en reaccionar.
export const TREND_SMOOTHING = 0.1

// Media móvil exponencial de los pesajes. El peso diario sube y baja por agua, sal y digestión; la
// tendencia deja ver el cambio real. Si faltan días entre dos pesajes, el nuevo pesa más (el equivalente
// a haber "repetido" la suavización una vez por día que pasó).
export function calculateWeightTrend(weighIns: readonly WeighIn[], smoothing: number = TREND_SMOOTHING): TrendPoint[] {
  // Un pesaje por día: si se repite la fecha, gana el último. Se ordena sin tocar la lista original.
  const byDate = new Map<string, WeighIn>()
  for (const weighIn of weighIns) byDate.set(weighIn.date, weighIn)
  const sorted = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))

  const points: TrendPoint[] = []
  for (const weighIn of sorted) {
    const previous = points[points.length - 1]
    if (!previous) {
      points.push({ ...weighIn, trendKg: weighIn.weightKg }) // el primer pesaje arranca la tendencia
      continue
    }
    const gapDays = daysBetweenLocalDates(previous.date, weighIn.date)
    const effectiveWeight = 1 - (1 - smoothing) ** gapDays
    points.push({ ...weighIn, trendKg: previous.trendKg + effectiveWeight * (weighIn.weightKg - previous.trendKg) })
  }
  return points
}

// Cambio del peso de tendencia en kg por semana, según los últimos "days" días antes del último punto.
// null si no hay dos puntos distintos en esa ventana (no se puede hablar de un ritmo).
export function calculateTrendRateKgPerWeek(points: readonly TrendPoint[], days: number = 14): number | null {
  const last = points[points.length - 1]
  if (!last) return null

  const first = points.find((point) => daysBetweenLocalDates(point.date, last.date) <= days)
  if (!first) return null

  const spanDays = daysBetweenLocalDates(first.date, last.date)
  if (spanDays < 1) return null
  return ((last.trendKg - first.trendKg) / spanDays) * 7
}
