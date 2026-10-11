import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SwipeToDeleteRow } from './SwipeToDeleteRow'

function renderRow(overrides: Partial<Parameters<typeof SwipeToDeleteRow>[0]> = {}) {
  const onOpenChange = vi.fn()
  const onDelete = vi.fn()
  const onEdit = vi.fn()
  const onPlay = vi.fn()
  const props = {
    isOpen: false,
    onOpenChange,
    onDelete,
    deleteLabel: 'Eliminar Empuje',
    ...overrides,
  }
  const view = render(
    <SwipeToDeleteRow {...props}>
      <button type="button" onClick={onEdit}>
        Empuje
      </button>
      <button type="button" onClick={onPlay} aria-label="Iniciar sesión: Empuje">
        ▶
      </button>
    </SwipeToDeleteRow>,
  )
  // Vuelve a renderizar con isOpen actualizado, como haría el padre real al reaccionar a onOpenChange
  const setOpen = (isOpen: boolean) =>
    view.rerender(
      <SwipeToDeleteRow {...props} isOpen={isOpen}>
        <button type="button" onClick={onEdit}>
          Empuje
        </button>
        <button type="button" onClick={onPlay} aria-label="Iniciar sesión: Empuje">
          ▶
        </button>
      </SwipeToDeleteRow>,
    )
  return { onOpenChange, onDelete, onEdit, onPlay, setOpen }
}

// Simula el gesto completo: bajar el dedo, moverlo y soltarlo, en un solo elemento
function drag(element: Element, deltaX: number, deltaY = 0, pointerId = 1) {
  fireEvent.pointerDown(element, { pointerId, clientX: 0, clientY: 0 })
  fireEvent.pointerMove(element, { pointerId, clientX: deltaX, clientY: deltaY })
  fireEvent.pointerUp(element, { pointerId, clientX: deltaX, clientY: deltaY })
}

describe('SwipeToDeleteRow', () => {
  it('muestra el contenido, con sus propios botones, y el botón de eliminar', () => {
    renderRow()
    expect(screen.getByRole('button', { name: 'Empuje' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar sesión: Empuje' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar Empuje' })).toBeInTheDocument()
  })

  it('cerrada y sin arrastre, cada botón del contenido funciona con normalidad', () => {
    const { onEdit, onPlay } = renderRow()
    fireEvent.click(screen.getByRole('button', { name: 'Empuje' }))
    expect(onEdit).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión: Empuje' }))
    expect(onPlay).toHaveBeenCalledTimes(1)
  })

  it('con la fila abierta, tocar cualquier botón del contenido la cierra en vez de activarlo', () => {
    const { onEdit, onPlay, onOpenChange } = renderRow({ isOpen: true })
    fireEvent.click(screen.getByRole('button', { name: 'Empuje' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onEdit).not.toHaveBeenCalled()

    onOpenChange.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión: Empuje' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onPlay).not.toHaveBeenCalled()
  })

  it('tocar el botón rojo llama a onDelete', () => {
    const { onDelete } = renderRow()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Empuje' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('arrastrar más allá del umbral deja la fila abierta al soltar', () => {
    const { onOpenChange } = renderRow()
    drag(screen.getByRole('button', { name: 'Empuje' }), -60) // más del 40 % de 80 px
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })

  it('arrastrar poco vuelve a cerrar al soltar', () => {
    const { onOpenChange } = renderRow()
    drag(screen.getByRole('button', { name: 'Empuje' }), -10)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('después de arrastrar, el clic que sigue no activa el contenido (se ignora una sola vez)', () => {
    const { onEdit, onOpenChange, setOpen } = renderRow()
    const editButton = screen.getByRole('button', { name: 'Empuje' })
    drag(editButton, -60)
    expect(onOpenChange).toHaveBeenCalledWith(true)
    setOpen(true) // el padre reacciona a onOpenChange, como en la app real

    fireEvent.click(editButton) // el clic sintético que el navegador dispara tras soltar: se ignora una vez
    expect(onEdit).not.toHaveBeenCalled()

    // un toque posterior, ya sin arrastre de por medio, cierra con normalidad (la fila está abierta)
    onOpenChange.mockClear()
    fireEvent.click(editButton)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('un movimiento vertical (scroll de la lista) no cuenta como arrastre y el toque final sí activa', () => {
    const { onEdit, onOpenChange } = renderRow()
    const editButton = screen.getByRole('button', { name: 'Empuje' })
    drag(editButton, -3, 30)
    expect(onOpenChange).not.toHaveBeenCalled()
    fireEvent.click(editButton)
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('un arrastre vertical (p. ej. el asa de reordenar una rutina) no se bloquea: le sigue llegando a quien lo necesite', () => {
    const outerPointerMove = vi.fn()
    const outerPointerUp = vi.fn()
    render(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      <div onPointerMove={outerPointerMove} onPointerUp={outerPointerUp}>
        <SwipeToDeleteRow isOpen={false} onOpenChange={vi.fn()} onDelete={vi.fn()} deleteLabel="Quitar">
          <span>Contenido</span>
        </SwipeToDeleteRow>
      </div>,
    )

    drag(screen.getByText('Contenido'), -3, 60) // sobre todo vertical, como arrastrar un asa de reordenar
    expect(outerPointerMove).toHaveBeenCalled()
    expect(outerPointerUp).toHaveBeenCalled()
  })

  it('una fila dentro de otra: deslizar la interna no también desliza la externa (p. ej. un alimento dentro de una comida)', () => {
    const onOuterOpenChange = vi.fn()
    const onInnerOpenChange = vi.fn()
    render(
      <SwipeToDeleteRow isOpen={false} onOpenChange={onOuterOpenChange} onDelete={vi.fn()} deleteLabel="Quitar Desayuno">
        <SwipeToDeleteRow isOpen={false} onOpenChange={onInnerOpenChange} onDelete={vi.fn()} deleteLabel="Quitar Avena">
          <span>Avena</span>
        </SwipeToDeleteRow>
      </SwipeToDeleteRow>,
    )

    drag(screen.getByText('Avena'), -60)
    expect(onInnerOpenChange).toHaveBeenCalledWith(true)
    expect(onOuterOpenChange).not.toHaveBeenCalled()
  })

  it('con la fila externa abierta, tocar dentro de ella la cierra sin llegar a la interna', () => {
    const onOuterOpenChange = vi.fn()
    const onInnerDelete = vi.fn()
    render(
      <SwipeToDeleteRow isOpen onOpenChange={onOuterOpenChange} onDelete={vi.fn()} deleteLabel="Quitar Desayuno">
        <SwipeToDeleteRow isOpen={false} onOpenChange={vi.fn()} onDelete={onInnerDelete} deleteLabel="Quitar Avena">
          <span>Avena</span>
        </SwipeToDeleteRow>
      </SwipeToDeleteRow>,
    )

    fireEvent.click(screen.getByText('Avena'))
    expect(onOuterOpenChange).toHaveBeenCalledWith(false)
    expect(onInnerDelete).not.toHaveBeenCalled()
  })
})
