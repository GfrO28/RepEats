// Deslizar una fila hacia la izquierda para revelar un botón de eliminar (patrón "swipe to delete").
// Aquí solo hay la geometría (sin nada de React ni del DOM): cuánto se puede arrastrar y si al soltar
// queda abierta o cerrada.

export const SWIPE_ACTION_WIDTH = 80 // px: ancho del botón de eliminar que queda revelado
export const SWIPE_OPEN_THRESHOLD = 0.4 // fracción de SWIPE_ACTION_WIDTH que hay que arrastrar para que quede abierto
// Por debajo de esto el gesto no cuenta como arrastre lateral: es un toque, o un tembleque del dedo al hacer scroll
export const SWIPE_DIRECTION_TOLERANCE = 6

// El desplazamiento nunca pasa de 0 (cerrado) ni de más allá del ancho del botón (abierto del todo)
export function clampSwipeOffset(offset: number, actionWidth: number = SWIPE_ACTION_WIDTH): number {
  return Math.min(0, Math.max(-actionWidth, offset))
}

// Al soltar el dedo: ¿la fila queda abierta o vuelve a cerrarse? Depende de qué tan lejos se llegó a arrastrar,
// no de hacia dónde iba el dedo en ese último instante.
export function resolveSwipeSnap(
  offset: number,
  actionWidth: number = SWIPE_ACTION_WIDTH,
  threshold: number = SWIPE_OPEN_THRESHOLD,
): 'open' | 'closed' {
  return Math.abs(offset) >= actionWidth * threshold ? 'open' : 'closed'
}

// ¿El gesto se movió lo bastante, y más de lado que hacia arriba o abajo, para tratarlo como un arrastre lateral?
// Si no, se dejar pasar como un toque (o como el scroll vertical de la lista, que no debe verse interrumpido).
export function isHorizontalDrag(deltaX: number, deltaY: number, tolerance: number = SWIPE_DIRECTION_TOLERANCE): boolean {
  return Math.abs(deltaX) > tolerance && Math.abs(deltaX) > Math.abs(deltaY)
}
