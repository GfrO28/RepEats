import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { iconButton } from '@/app/buttonStyles'
import { FOCUSABLE_SELECTOR, getNextFocusIndex } from '@/app/focusTrap'
import { lockBodyScroll } from '@/app/scrollLock'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null
  return (
    <ModalDialog onClose={onClose} title={title}>
      {children}
    </ModalDialog>
  )
}

// El diálogo en sí. Vive aparte para que sus efectos (llevar el foco adentro y devolverlo) solo existan mientras
// está abierto.
function ModalDialog({ onClose, title, children }: Omit<ModalProps, 'isOpen'>) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Al abrir, el foco pasa al diálogo (así el lector de pantalla anuncia su título); al cerrar vuelve al botón
    // que lo abrió, para que quien navega con teclado no pierda su lugar
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()
    return () => previouslyFocused?.focus()
  }, [])

  // Mientras el diálogo está abierto, la página de fondo no se puede desplazar
  useEffect(() => lockBodyScroll(), [])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation() // con un diálogo dentro de otro, Escape cierra solo el de encima
      onClose()
      return
    }

    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement)
    const target = getNextFocusIndex(currentIndex, focusable.length, event.shiftKey)

    if (focusable.length === 0) {
      event.preventDefault() // nada que enfocar: el foco se queda en el diálogo
    } else if (target !== null) {
      event.preventDefault()
      focusable[target]?.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80vh] w-full overflow-y-auto overscroll-contain rounded-t-2xl bg-slate-900 p-4 focus:outline-none sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className={iconButton}>
            ✕
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
