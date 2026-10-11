export type CalorieMarginZone = 'onTrack' | 'close' | 'over'

export interface CalorieMargin {
  remaining: number // objetivo - consumido; negativo si ya se pasó
  ratio: number // consumido / objetivo, sin tope (para ubicar la barra/aguja)
  zone: CalorieMarginZone
}

// El techo real no es "un % más que el objetivo" (un número arbitrario, sin relación con tu cuerpo), sino tu
// TDEE: por debajo de tu TDEE sigues en déficit (o en mantenimiento), aunque te hayas pasado del objetivo de
// la fase; solo por encima de tu TDEE hay un superávit real. En una fase de volumen el objetivo ya está por
// encima del TDEE, así que ahí el techo es directamente el objetivo (no tendría sentido que fuera más bajo).
export function calculateCalorieMargin(consumed: number, target: number, tdee: number): CalorieMargin {
  const remaining = target - consumed
  const ratio = target > 0 ? consumed / target : 0
  const overThreshold = Math.max(target, tdee)
  const zone: CalorieMarginZone = consumed <= target ? 'onTrack' : consumed <= overThreshold ? 'close' : 'over'
  return { remaining, ratio, zone }
}
