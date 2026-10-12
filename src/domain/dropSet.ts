import type { CompletedSet, DropSet } from '@/repositories/SessionRepository'

// Cuántas bajadas se proponen al completar la serie madre de un Drop Set
export const DEFAULT_DROP_COUNT = 2
// Cada bajada se propone un 20 % más liviana que la anterior de la cadena (en cascada, no siempre sobre la madre)
export const DROP_WEIGHT_FACTOR = 0.8
// Los discos y las máquinas avanzan de 2.5 en 2.5 kg
export const DROP_WEIGHT_STEP_KG = 2.5

// Peso sugerido para la siguiente bajada: 80 % del anterior, redondeado al múltiplo de 2.5 kg más cercano.
// Sin peso (peso corporal) no hay nada que bajar. Nunca sugiere más que el peso anterior.
export function suggestDropWeight(previousWeight: number): number {
  if (previousWeight <= 0) return 0
  const rounded = Math.round((previousWeight * DROP_WEIGHT_FACTOR) / DROP_WEIGHT_STEP_KG) * DROP_WEIGHT_STEP_KG
  return Math.min(previousWeight, Math.max(rounded, DROP_WEIGHT_STEP_KG))
}

// Valores por defecto de la bajada número "index" (0 = la primera) de un Drop Set. Las ya completadas devuelven lo
// que se registró; las pendientes continúan la cascada desde la última conocida (la madre si no hay bajadas).
export function suggestDrop(parent: CompletedSet, index: number): { weight: number; reps: number } {
  const completed = parent.drops ?? []
  const done = completed[index]
  if (done) return { weight: done.weight, reps: done.reps }

  const last = completed[completed.length - 1] ?? parent
  let weight = last.weight
  for (let step = completed.length; step <= index; step += 1) weight = suggestDropWeight(weight)
  return { weight, reps: last.reps }
}

// Bajadas del bloque que faltan por hacer. "plannedCount" es lo que el usuario decidió en esta sesión
// (null si no decidió nada: se usan las 2 por defecto). Nunca es menos de las que ya se completaron.
export function countPendingDrops(parent: CompletedSet, plannedCount: number | null): number {
  const done = parent.drops?.length ?? 0
  return Math.max((plannedCount ?? DEFAULT_DROP_COUNT) - done, 0)
}

// Volumen de una serie: la madre más todas sus bajadas
export function getSetVolume(set: CompletedSet): number {
  const dropsVolume = (set.drops ?? []).reduce((total, drop) => total + drop.weight * drop.reps, 0)
  return set.weight * set.reps + dropsVolume
}

// "60×8 → 47.5×6 → 37.5×5": el bloque completo en una línea. "toDisplay" convierte el peso (p. ej. kg → lb).
export function formatDropChain(set: CompletedSet, toDisplay: (kg: number) => number = (kg) => kg): string {
  const steps: readonly Pick<DropSet, 'weight' | 'reps'>[] = [set, ...(set.drops ?? [])]
  return steps.map((step) => `${toDisplay(step.weight)}×${step.reps}`).join(' → ')
}
