import type { MealType } from './mealTypes'

// ── Horas del día como minutos desde medianoche, para poder sumar/restar y comparar ──

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export function parseTimeToMinutes(time: string): number | null {
  const match = TIME_PATTERN.exec(time)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

// Envuelve a 24 h (1450 -> "00:10", como pasar la medianoche)
export function formatMinutesToTime(minutes: number): string {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440
  const hours = Math.floor(wrapped / 60)
  const mins = wrapped % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

// ── Reparto de horas de comida: cada comida se sugiere a partir de la anterior, no de despertar/dormir ──

// Sin ninguna comida con hora todavía ese día, la primera (normalmente el desayuno) empieza en esta hora. Es
// solo un punto de partida tentativo: se corrige tocando la comida, como cualquier otra.
export const DEFAULT_FIRST_MEAL_TIME = '07:30'

// Separación típica entre una comida y la siguiente cuando no hay un entreno de por medio
export const DEFAULT_MEAL_GAP_MINUTES = 150

// Cuánto después de que EMPIEZA el entreno (no de que termina) cae la comida post-entreno: no es solo lo que dura
// la rutina en sí, también hay que sumarle vestirse/estirar y volver a casa antes de poder comer. Es una
// heurística propia, no una regla científica estricta.
export const SESSION_DURATION_MINUTES = 60 // lo que dura la rutina en el gym
export const POST_SESSION_MOBILITY_MINUTES = 60 // vestirse, estirar, volver a casa, etc.
export const POST_WORKOUT_MINUTES = SESSION_DURATION_MINUTES + POST_SESSION_MOBILITY_MINUTES

// Hora tentativa de la siguiente comida, a partir de cuándo fue (o se sugirió) la anterior. Si el entreno cae
// justo en el hueco entre ambas, no tiene sentido sugerir comer a mitad de la rutina: se empuja a después de
// entrenar (rutina + volver a casa), en vez de al hueco parejo de siempre.
function nextTentativeTime(previousMinutes: number, trainingMinutes: number | null): number {
  const naiveNext = previousMinutes + DEFAULT_MEAL_GAP_MINUTES
  if (trainingMinutes !== null && trainingMinutes > previousMinutes && trainingMinutes < naiveNext) {
    return Math.max(naiveNext, trainingMinutes + POST_WORKOUT_MINUTES)
  }
  return naiveNext
}

// Resuelve la hora de cada comida visible ese día: la que el usuario eligió/confirmó (`explicitTimes`) si existe,
// o si no, una tentativa calculada a partir de la comida anterior YA resuelta (explícita o también tentativa).
// La primera comida sin nada antes usa `DEFAULT_FIRST_MEAL_TIME`. `mealTypes` debe venir en orden cronológico
// (como ya lo entrega `getVisibleMealTypes`).
export function resolveMealTimes(
  mealTypes: readonly MealType[],
  explicitTimes: Partial<Record<MealType, string>>,
  trainingTime: string | null,
): Partial<Record<MealType, string>> {
  const training = trainingTime === null ? null : parseTimeToMinutes(trainingTime)
  const result: Partial<Record<MealType, string>> = {}
  let previous: number | null = null

  for (const type of mealTypes) {
    const explicit = explicitTimes[type] !== undefined ? parseTimeToMinutes(explicitTimes[type] as string) : null
    const resolved: number =
      explicit ??
      (previous === null ? (parseTimeToMinutes(DEFAULT_FIRST_MEAL_TIME) as number) : nextTentativeTime(previous, training))
    result[type] = formatMinutesToTime(resolved)
    previous = resolved
  }

  return result
}
