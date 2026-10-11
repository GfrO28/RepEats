interface IconProps {
  className?: string
}

// Triángulo de "reproducir"/iniciar. Un solo trazo relleno: más minimalista que el emoji ▶️, que trae su propio
// color y sombra fijos y no se adapta al tema.
export function PlayIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

// Ícono de línea, minimalista (a diferencia del resto de la app, que usa emoji): pensado para el botón que
// revela el gesto de deslizar, donde un emoji se ve tosco sobre un fondo de color sólido.
export function TrashIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

// Los 4 íconos del menú principal: de línea/relleno simple (no emoji), en currentColor para que tomen el color de
// texto que ya distingue la pestaña activa (azul) de las demás (gris), en vez de un color fijo propio.

export function TrainingIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="1" y="9" width="3" height="6" rx="1" />
      <rect x="20" y="9" width="3" height="6" rx="1" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <rect x="6" y="6" width="3" height="12" rx="1" />
      <rect x="15" y="6" width="3" height="12" rx="1" />
    </svg>
  )
}

export function NutritionIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <line x1="9" y1="2" x2="9" y2="9" />
      <line x1="12" y1="2" x2="12" y2="9" />
      <line x1="15" y1="2" x2="15" y2="9" />
      <path d="M9 9a3 3 0 0 0 6 0" />
      <line x1="12" y1="12" x2="12" y2="22" />
    </svg>
  )
}

export function ProgressIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <line x1="3" y1="21" x2="21" y2="21" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <rect x="5" y="14" width="3" height="6" rx="0.5" fill="currentColor" />
      <rect x="10.5" y="9" width="3" height="11" rx="0.5" fill="currentColor" />
      <rect x="16" y="4" width="3" height="16" rx="0.5" fill="currentColor" />
    </svg>
  )
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <line x1="4" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <circle cx="15" cy="6" r="2.5" fill="currentColor" />
      <circle cx="9" cy="12" r="2.5" fill="currentColor" />
      <circle cx="17" cy="18" r="2.5" fill="currentColor" />
    </svg>
  )
}
