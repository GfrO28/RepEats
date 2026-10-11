import type { Routine } from '@/repositories/RoutineRepository'

// Las rutinas de antes de existir el orden manual (o cualquier dato inesperado) no tienen "order": se les trata
// como si fuera altísimo, así quedan al final en vez de mezcladas al azar entre las que sí lo tienen.
const NO_ORDER = Number.MAX_SAFE_INTEGER

// El orden que ve el usuario: por "order" ascendente; a igualdad (o sin order) se ordena por nombre, para que sea
// estable y no salte de posición en cada carga.
export function sortRoutinesByOrder(routines: readonly Routine[]): Routine[] {
  return [...routines].sort((a, b) => {
    const orderA = a.order ?? NO_ORDER
    const orderB = b.order ?? NO_ORDER
    if (orderA !== orderB) return orderA - orderB
    return a.name.localeCompare(b.name)
  })
}

// Dónde debe caer una rutina nueva: al final de las que ya existen (no en medio, no primero)
export function getNextRoutineOrder(routines: readonly Routine[]): number {
  if (routines.length === 0) return 0
  return Math.max(...routines.map((routine) => routine.order ?? -1)) + 1
}

// Tras soltar una rutina en su nueva posición: renumera todas 0, 1, 2... según el orden ya arrastrado. Evita ir
// dejando huecos o decimales, y "sana" de una vez a cualquier rutina antigua que no tuviera "order".
export function reindexRoutines(routines: readonly Routine[]): Routine[] {
  return routines.map((routine, index) => ({ ...routine, order: index }))
}
