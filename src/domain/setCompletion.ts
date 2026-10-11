// Un doble toque en ✓ (o un toque que rebota) no debe registrar la misma serie dos veces.
export const DOUBLE_TAP_WINDOW_MS = 1500

// completedCount: series ya registradas del ejercicio. La fila activa siempre es la número "completedCount"
// (las filas se bloquean hasta completar la anterior), así que si rowIndex es menor, esa fila ya está registrada.
// lastCompletionAt: cuándo se completó esa misma fila por última vez en esta sesión (null si nunca), por si el
// segundo toque llega antes de que la pantalla se haya actualizado con la serie ya guardada.
export function shouldIgnoreCompletion(
  completedCount: number,
  rowIndex: number,
  lastCompletionAt: number | null,
  now: number,
): boolean {
  if (completedCount > rowIndex) return true
  return lastCompletionAt !== null && now - lastCompletionAt < DOUBLE_TAP_WINDOW_MS
}
