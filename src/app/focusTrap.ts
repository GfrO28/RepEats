// Elementos que se pueden alcanzar con Tab (los deshabilitados y los de tabindex="-1" no)
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

// Dentro de un diálogo, Tab no debe salirse hacia la página de atrás: al llegar al último elemento vuelve al primero
// (y con Shift+Tab, del primero al último). Devuelve el índice al que hay que llevar el foco, o null si el
// navegador puede avanzar solo porque aún hay elementos en esa dirección.
// currentIndex: posición del elemento enfocado dentro de la lista, o -1 si el foco está en el propio diálogo o fuera de él.
export function getNextFocusIndex(currentIndex: number, count: number, isShift: boolean): number | null {
  if (count === 0) return null
  if (currentIndex === -1) return isShift ? count - 1 : 0
  if (!isShift && currentIndex === count - 1) return 0
  if (isShift && currentIndex === 0) return count - 1
  return null
}
