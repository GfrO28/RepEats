// Estilos de botón de toda la app. Se usan como clases de Tailwind: className={primaryButton}.
// Reglas: el área para tocar mide al menos 44 px de alto (uso con una mano, pulgar), un solo color de acción
// (azul) y el rojo solo para borrar. Márgenes y anchos (mt-4, w-full, flex-1) se agregan aparte donde se usa.

// La acción principal de una pantalla o formulario
export const primaryButton =
  'inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40'

// Acción secundaria sobre el fondo de la página
export const secondaryButton =
  'inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 disabled:opacity-40'

// Acción secundaria dentro de una tarjeta que ya es bg-slate-800: un tono más claro para que se distinga
export const secondaryButtonOnCard =
  'inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 disabled:opacity-40'

// Píldora de selección (filtros, tipos, pestañas): activa = azul, inactiva = gris.
// activeClass permite otro color de selección (p. ej. verde para "primario" en el mapa muscular).
export function chip(isActive: boolean, activeClass: string = 'bg-primary'): string {
  return `inline-flex min-h-10 items-center rounded-full px-4 py-1 text-sm ${
    isActive ? `${activeClass} font-semibold text-slate-950` : 'bg-slate-800 text-slate-300'
  }`
}

// Igual, pero para píldoras dentro de una tarjeta que ya es bg-slate-800
export function chipOnCard(isActive: boolean): string {
  return `inline-flex min-h-10 items-center rounded-full px-4 py-1 text-sm ${
    isActive ? 'bg-primary font-semibold text-slate-950' : 'bg-slate-700 text-slate-300'
  }`
}

// Acción destructiva con texto (eliminar una sesión, por ejemplo). Se usa dentro de una tarjeta y siempre pide confirmar.
export const dangerButton =
  'inline-flex min-h-11 items-center justify-center rounded-xl bg-red-950 px-4 py-2 text-sm font-medium text-red-400'

// Botón que es solo un icono (✏️, ✕, ★): 44 × 44 px de área táctil. Siempre lleva aria-label.
export const iconButton = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-slate-400'
export const dangerIconButton = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-red-500'

// Enlace de texto dentro de un bloque
export const linkButton = 'inline-flex min-h-11 items-center text-sm text-primary'

// "+ Agregar ..." al pie de una lista: ancho completo, gris con texto de acción
export const addButton =
  'inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-800 px-4 py-2 text-sm text-primary'

// Botón redondo flotante de "agregar" (esquina inferior derecha, sobre la barra de navegación).
// z-20: por encima del contenido de la página (las filas deslizables usan z-10 para taparse su propio botón de
// eliminar), pero por debajo del fondo de una ventana modal (z-50).
export const fabButton =
  'fixed z-20 bottom-20 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl font-bold text-slate-950 shadow-lg'
