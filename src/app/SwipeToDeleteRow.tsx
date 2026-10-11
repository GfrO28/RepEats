import { useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { clampSwipeOffset, isHorizontalDrag, resolveSwipeSnap, SWIPE_ACTION_WIDTH } from '@/domain/swipeAction'
import { TrashIcon } from './icons'

interface SwipeToDeleteRowProps {
  // Controlado por quien lo usa: así una lista puede cerrar las demás filas al abrir una (solo una a la vez)
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onDelete: () => void // toque sobre el botón revelado
  deleteLabel: string
  // El contenido de la fila: puede traer sus propios botones (editar, iniciar...), cada uno con su onClick normal.
  // Mientras la fila está cerrada y no se arrastra, esos clics llegan tal cual. Si la fila está abierta, o si el
  // clic es el que sigue justo después de un arrastre, se intercepta: en vez de activarse, la fila se cierra.
  children: ReactNode
  // Línea divisoria inferior: la de siempre en una lista plana de filas. Se apaga en tarjetas que ya tienen su
  // propio fondo redondeado (ahí "className" se usa para el margen y el radio, y así también recortan el rojo).
  showBorder?: boolean
  className?: string
}

interface DragState {
  pointerId: number
  startX: number
  startY: number
  baseOffset: number
  isHorizontal: boolean
}

// Fila deslizable: arrastrar hacia la izquierda revela un botón rojo de eliminar (patrón "swipe to delete").
// El botón de eliminar siempre está en el documento (solo tapado por el contenido mientras está cerrado), así que
// el teclado y los lectores de pantalla lo alcanzan igual sin necesidad del gesto.
export function SwipeToDeleteRow({
  isOpen,
  onOpenChange,
  onDelete,
  deleteLabel,
  children,
  showBorder = true,
  className = '',
}: SwipeToDeleteRowProps) {
  // null = no se está arrastrando ahora mismo (se usa la posición controlada por "isOpen")
  const [dragOffset, setDragOffset] = useState<number | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const didDragRef = useRef(false) // evita que el clic que sigue a un arrastre también active algo del contenido

  const offset = dragOffset ?? (isOpen ? -SWIPE_ACTION_WIDTH : 0)

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Sin stopPropagation aquí: todavía no se sabe si esto va a ser un deslizamiento horizontal. Si se detiene el
    // evento ya en este punto, un gesto vertical que en realidad es para otra cosa (arrastrar el asa de reordenar
    // una rutina, o el scroll de la lista) nunca llegaría a quien lo necesita.
    if (event.pointerType === 'mouse' && event.button !== 0) return
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseOffset: isOpen ? -SWIPE_ACTION_WIDTH : 0,
      isHorizontal: false,
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY

    if (!drag.isHorizontal) {
      if (!isHorizontalDrag(deltaX, deltaY)) {
        // Se mueve más vertical que horizontal: es el scroll de la lista (o un asa de reordenar), no un deslizamiento
        // lateral. Se suelta el gesto sin detener el evento, para que le siga llegando a quien sí lo necesita.
        if (Math.abs(deltaY) > Math.abs(deltaX)) dragRef.current = null
        return
      }
      drag.isHorizontal = true
      try {
        event.currentTarget.setPointerCapture(event.pointerId) // sigue recibiendo eventos aunque el dedo salga de la fila
      } catch {
        // no disponible (algunos navegadores viejos, o en las pruebas): el arrastre igual funciona
      }
    }

    // Recién aquí se sabe que el gesto es un deslizamiento horizontal nuestro: a partir de este evento (y los que
    // sigan) se detiene la propagación, para que una fila deslizable de más afuera (p. ej. la comida que envuelve
    // este alimento) no reaccione también al mismo arrastre.
    event.stopPropagation()
    setDragOffset(clampSwipeOffset(drag.baseOffset + deltaX))
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || drag.pointerId !== event.pointerId) return

    if (drag.isHorizontal) {
      event.stopPropagation() // fue nuestro: que no le llegue a nadie más (ni a un ancestro, ni al clic nativo)
      const finalOffset = clampSwipeOffset(drag.baseOffset + (event.clientX - drag.startX))
      onOpenChange(resolveSwipeSnap(finalOffset) === 'open')
      didDragRef.current = true // el clic que el navegador dispare a continuación no debe llegarle al contenido
    }
    setDragOffset(null)
  }

  // En la fase de captura, antes de que el clic llegue al botón concreto que haya adentro (editar, iniciar...)
  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (didDragRef.current) {
      didDragRef.current = false
      event.stopPropagation()
      return
    }
    if (isOpen) {
      event.stopPropagation()
      onOpenChange(false) // un toque en cualquier parte de una fila abierta la cierra, sin activar nada de adentro
    }
  }

  return (
    <div className={`relative overflow-hidden ${showBorder ? 'border-b border-slate-800' : ''} ${className}`}>
      <button
        type="button"
        onClick={onDelete}
        aria-label={deleteLabel}
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-500 text-slate-950"
        style={{ width: SWIPE_ACTION_WIDTH }}
      >
        <TrashIcon className="h-5 w-5" />
      </button>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClickCapture={handleClickCapture}
        style={{ transform: `translateX(${offset}px)`, backgroundColor: 'var(--app-bg)' }}
        className={`relative z-10 touch-pan-y ${dragOffset === null ? 'transition-transform duration-200 ease-out' : ''}`}
      >
        {children}
      </div>
    </div>
  )
}
