// Superset: dos ejercicios consecutivos de una rutina que se hacen alternados, sin descanso entre ellos.
// Se marca con el mismo "supersetGroup" en ambos; un ejercicio sin el campo va suelto. Solo se permiten parejas.

export interface SupersetMember {
  supersetGroup?: string
}

// Una copia del ejercicio sin el campo (Firestore no acepta undefined, así que se quita en vez de poner undefined)
function withoutGroup<T extends SupersetMember>(exercise: T): T {
  const { supersetGroup: _removed, ...rest } = exercise
  return rest as T
}

// Posición del compañero de superset del ejercicio en "index", o null si va suelto
export function getSupersetPartnerIndex(exercises: readonly SupersetMember[], index: number): number | null {
  const group = exercises[index]?.supersetGroup
  if (group === undefined) return null
  if (exercises[index + 1]?.supersetGroup === group) return index + 1
  if (exercises[index - 1]?.supersetGroup === group) return index - 1
  return null
}

// ¿Se puede unir el ejercicio "index" con el siguiente? Ambos deben existir y ninguno estar ya en un superset.
export function canJoinWithNext(exercises: readonly SupersetMember[], index: number): boolean {
  const current = exercises[index]
  const next = exercises[index + 1]
  return current !== undefined && next !== undefined && current.supersetGroup === undefined && next.supersetGroup === undefined
}

// Une el ejercicio "index" con el siguiente en un superset. Si no se puede (ver canJoinWithNext), devuelve la lista igual.
export function joinWithNext<T extends SupersetMember>(exercises: readonly T[], index: number): T[] {
  if (!canJoinWithNext(exercises, index)) return [...exercises]
  const used = new Set(exercises.map((exercise) => exercise.supersetGroup))
  let number = 1
  while (used.has(`ss${number}`)) number += 1
  const group = `ss${number}`
  return exercises.map((exercise, i) => (i === index || i === index + 1 ? { ...exercise, supersetGroup: group } : exercise))
}

// Deshace el superset del ejercicio "index": los dos quedan sueltos
export function separate<T extends SupersetMember>(exercises: readonly T[], index: number): T[] {
  const group = exercises[index]?.supersetGroup
  if (group === undefined) return [...exercises]
  return exercises.map((exercise) => (exercise.supersetGroup === group ? withoutGroup(exercise) : exercise))
}

// Deja solo los supersets válidos: parejas exactamente de dos ejercicios consecutivos. Se usa después de quitar o
// reordenar ejercicios, que pueden dejar un grupo con un solo miembro o con miembros separados.
export function normalizeSupersets<T extends SupersetMember>(exercises: readonly T[]): T[] {
  return exercises.map((exercise, index) => {
    if (exercise.supersetGroup === undefined) return exercise
    const partner = getSupersetPartnerIndex(exercises, index)
    if (partner === null) return withoutGroup(exercise)
    // Tres seguidos con el mismo grupo no es una pareja: ninguno es válido
    const members = exercises.filter((other) => other.supersetGroup === exercise.supersetGroup).length
    return members === 2 ? exercise : withoutGroup(exercise)
  })
}

export interface SupersetStep {
  member: 0 | 1 // 0 = el primer ejercicio de la pareja, 1 = el segundo
  setIndex: number
}

// El orden en que se hacen las series de una pareja: ronda 1 (A, B), ronda 2 (A, B)...
// Si uno tiene más series que el otro, las últimas rondas solo tienen a ese ejercicio.
export function buildSupersetSequence(setCountA: number, setCountB: number): SupersetStep[] {
  const steps: SupersetStep[] = []
  const rounds = Math.max(setCountA, setCountB, 0)
  for (let round = 0; round < rounds; round += 1) {
    if (round < setCountA) steps.push({ member: 0, setIndex: round })
    if (round < setCountB) steps.push({ member: 1, setIndex: round })
  }
  return steps
}

// Después de esta serie se descansa: es la última de su ronda (la B, o la A si B ya no tiene serie en esa ronda)
export function isRoundEnd(step: SupersetStep, setCountB: number): boolean {
  return step.member === 1 || step.setIndex >= setCountB
}
