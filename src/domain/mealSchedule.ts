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

// ── Reparto de horas de comida ──
//
// El "día" para repartir comidas arranca en la primera comida (elegida a mano, o esta hora por defecto si
// todavía no se eligió ninguna) y dura un bloque fijo de horas (ver ASSUMED_DAY_SPAN_MINUTES): no se pide
// hora de dormir, se asume un día activo típico. Dentro de ese tramo, las comidas sin hora elegida se reparten
// PAREJO — no encadenadas con un margen fijo desde la anterior — para que la última caiga cerca del final del
// bloque en vez de apelmazarse todas temprano. Cualquier comida que SÍ se elija a mano se vuelve una "ancla"
// que parte el día en tramos: las comidas tentativas entre dos anclas se reparten parejo solo en ESE tramo.

export const DEFAULT_FIRST_MEAL_TIME = '07:30'

// Bloque de horas, desde la primera comida, en el que se reparten el resto. 14 h deja, por ejemplo, la última
// comida a las 9pm si desayunas a las 7am, o a las 10pm si desayunas a las 8am — ajustado con el dueño de la app.
export const ASSUMED_DAY_SPAN_MINUTES = 14 * 60

// Cuánto antes cae la comida pre-entreno: rango típico recomendado, 1.5-2.5 h antes para digerir sin pesadez.
export const PRE_WORKOUT_MINUTES = 120

// Cuánto después de que EMPIEZA el entreno (no de que termina) cae la comida post-entreno: no es solo lo que dura
// la rutina en sí, también hay que sumarle vestirse/estirar y volver a casa antes de poder comer.
export const SESSION_DURATION_MINUTES = 60 // lo que dura la rutina en el gym
export const POST_SESSION_MOBILITY_MINUTES = 60 // vestirse, estirar, volver a casa, etc.
export const POST_WORKOUT_MINUTES = SESSION_DURATION_MINUTES + POST_SESSION_MOBILITY_MINUTES

// Ambos números (pre y post) son una heurística propia, no una regla científica estricta. Se recortan si el
// tramo no deja tanto margen, sin dejar de reservar una comida a cada lado mientras haya un antes y un después
// reales dentro de ese tramo (ver `distributeSpan`).

// Reparto parejo de `count` comidas DESPUÉS de `start` (nunca coincide con él: ahí ya hay una comida real, la
// que abre el tramo) hasta `end` — coincidiendo exactamente con `end` si `includeEnd` es true (el final
// asumido del día, no una comida real con la que se podría chocar), o quedando antes si no (el final del tramo
// sí es una comida real elegida a mano).
function spaceEvenly(count: number, start: number, end: number, includeEnd: boolean): number[] {
  if (count <= 0) return []
  const divisions = includeEnd ? count : count + 1
  return Array.from({ length: count }, (_, index) => start + ((end - start) * (index + 1)) / divisions)
}

// Comidas antes del entreno: la última SIEMPRE cae justo en `preWorkout` (la comida pre-entreno); las demás se
// reparten entre `start` (sin tocarlo) y ahí.
function spaceBeforeWorkout(count: number, start: number, preWorkout: number): number[] {
  if (count <= 0) return []
  if (count === 1) return [preWorkout]
  return Array.from({ length: count }, (_, index) => start + ((preWorkout - start) * (index + 1)) / count)
}

// Comidas después del entreno: la primera SIEMPRE cae justo en `postWorkout`; la última toca `end` solo si
// `includeEnd` (ver `spaceEvenly`).
function spaceAfterWorkout(count: number, postWorkout: number, end: number, includeEnd: boolean): number[] {
  if (count <= 0) return []
  if (count === 1) return [postWorkout]
  const divisions = includeEnd ? count - 1 : count
  return Array.from({ length: count }, (_, index) => postWorkout + ((end - postWorkout) * index) / divisions)
}

// Reparte `count` comidas dentro de un tramo (start, end). Sin hora de entreno adentro, parejo. Con hora de
// entreno adentro, reserva una justo ~2 h antes y otra después de rutina + volver a casa — siempre que de
// verdad haya una comida antes y otra después dentro de ESTE tramo — y reparte el resto según cuánto espacio
// libre quede de cada lado.
function distributeSpan(
  count: number,
  start: number,
  end: number,
  trainingInWindow: number | null,
  includeEnd: boolean,
): number[] {
  if (count <= 0) return []
  if (trainingInWindow === null || trainingInWindow < start || trainingInWindow > end) {
    return spaceEvenly(count, start, end, includeEnd)
  }

  const preWorkout = Math.max(start, trainingInWindow - PRE_WORKOUT_MINUTES)
  const postWorkout = Math.min(end, trainingInWindow + POST_WORKOUT_MINUTES)
  // "Antes" solo cuenta si de verdad hay hueco después del inicio del tramo: si `preWorkout` queda pegado a
  // `start`, es porque ahí ya hay una comida real (la que abre el tramo), así que no hace falta otra encima.
  // Análogo para "después" contra el final del tramo (solo si ese final también es una comida real).
  const hasBeforeWindow = preWorkout > start && preWorkout < trainingInWindow
  const hasAfterWindow = (includeEnd || postWorkout < end) && postWorkout > trainingInWindow

  if (!hasBeforeWindow && !hasAfterWindow) return spaceEvenly(count, start, end, includeEnd)
  if (!hasBeforeWindow) return spaceAfterWorkout(count, postWorkout, end, includeEnd)
  if (!hasAfterWindow) return spaceBeforeWorkout(count, start, preWorkout)

  const beforeSpan = preWorkout - start
  const afterSpan = end - postWorkout
  const usableSpan = beforeSpan + afterSpan
  const remaining = count - 2
  const extraBefore =
    usableSpan > 0 ? Math.min(remaining, Math.max(0, Math.round((remaining * beforeSpan) / usableSpan))) : 0
  const beforeCount = 1 + extraBefore
  const afterCount = count - beforeCount

  return [
    ...spaceBeforeWorkout(beforeCount, start, preWorkout),
    ...spaceAfterWorkout(afterCount, postWorkout, end, includeEnd),
  ]
}

// Pone en la misma recta "sin vueltas" una hora que puede caer del otro lado de la medianoche respecto a
// `start` (p. ej. tu primera comida fue a las 23:00 y entrenas a la 01:00: el entreno es "del día siguiente"
// en el reloj, pero sigue siendo parte de este mismo día activo)
function toWindowMinutes(raw: number, start: number): number {
  return raw < start ? raw + 1440 : raw
}

// Resuelve la hora de cada comida visible ese día. El punto de partida es la primera comida (elegida a mano,
// o DEFAULT_FIRST_MEAL_TIME si todavía no se eligió ninguna); el final asumido es ese punto + 14 h. Cualquier
// otra comida con hora elegida a mano es también una ancla: parte el día en tramos, y las comidas tentativas
// entre dos anclas se reparten parejo (considerando el entreno, si cae en ese tramo) solo ahí, no en todo el
// día. `mealTypes` debe venir en orden cronológico (como ya lo entrega `getVisibleMealTypes`).
export function resolveMealTimes(
  mealTypes: readonly MealType[],
  explicitTimes: Partial<Record<MealType, string>>,
  trainingTime: string | null,
): Partial<Record<MealType, string>> {
  const n = mealTypes.length
  if (n === 0) return {}

  const firstType = mealTypes[0] as MealType
  const explicitFirst =
    explicitTimes[firstType] !== undefined ? parseTimeToMinutes(explicitTimes[firstType] as string) : null
  const start = explicitFirst ?? (parseTimeToMinutes(DEFAULT_FIRST_MEAL_TIME) as number)
  const end = start + ASSUMED_DAY_SPAN_MINUTES

  const rawTraining = trainingTime === null ? null : parseTimeToMinutes(trainingTime)
  const trainingInWindow = rawTraining === null ? null : toWindowMinutes(rawTraining, start)

  // Anclas en orden: el inicio del día (índice 0, siempre), cualquier comida elegida a mano, y el final asumido
  const anchors: { index: number; time: number }[] = [{ index: 0, time: start }]
  for (let index = 1; index < n; index++) {
    const type = mealTypes[index] as MealType
    const explicit = explicitTimes[type] !== undefined ? parseTimeToMinutes(explicitTimes[type] as string) : null
    if (explicit !== null) anchors.push({ index, time: toWindowMinutes(explicit, start) })
  }
  anchors.push({ index: n, time: end })

  const resolvedMinutes: number[] = new Array(n)
  for (let i = 0; i < anchors.length - 1; i++) {
    const from = anchors[i] as { index: number; time: number }
    const to = anchors[i + 1] as { index: number; time: number }
    resolvedMinutes[from.index] = from.time

    const between = to.index - from.index - 1
    if (between <= 0) continue

    const spanEnd = Math.max(to.time, from.time) // una ancla mal ordenada (hora elegida a mano, al revés) no revienta el reparto
    const includeEnd = to.index === n // el final asumido del día (no una comida real): sí se puede tocar exacto
    const times = distributeSpan(between, from.time, spanEnd, trainingInWindow, includeEnd)
    for (let offset = 0; offset < between; offset++) {
      resolvedMinutes[from.index + 1 + offset] = times[offset] as number
    }
  }

  const result: Partial<Record<MealType, string>> = {}
  for (let index = 0; index < n; index++) {
    result[mealTypes[index] as MealType] = formatMinutesToTime(resolvedMinutes[index] as number)
  }
  return result
}
