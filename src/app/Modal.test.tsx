import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from './Modal'

describe('Modal', () => {
  it('cerrado no muestra nada', () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Título">
        contenido
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('abierto es un diálogo modal con nombre (su título)', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Editar perfil">
        <button type="button">Dentro</button>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Editar perfil' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'Dentro' })).toBeInTheDocument()
  })

  it('al abrir, el foco pasa al diálogo', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Título">
        <button type="button">Dentro</button>
      </Modal>,
    )
    expect(screen.getByRole('dialog')).toHaveFocus()
  })

  it('Escape lo cierra', async () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} title="Título">
        contenido
      </Modal>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('el botón Cerrar y el fondo lo cierran, pero un clic dentro no', async () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen onClose={onClose} title="Título">
        <p>texto</p>
      </Modal>,
    )
    await userEvent.click(screen.getByText('texto'))
    expect(onClose).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Tab no se sale del diálogo: del último elemento vuelve al primero', async () => {
    render(
      <>
        <button type="button">Afuera</button>
        <Modal isOpen onClose={() => {}} title="Título">
          <button type="button">Uno</button>
          <button type="button">Dos</button>
        </Modal>
      </>,
    )
    // Orden dentro del diálogo: Cerrar, Uno, Dos
    await userEvent.tab() // diálogo -> Cerrar
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus()
    await userEvent.tab()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Dos' })).toHaveFocus()
    await userEvent.tab() // del último vuelve al primero, no a "Afuera"
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus()
  })

  it('Shift+Tab en el primero pasa al último', async () => {
    render(
      <Modal isOpen onClose={() => {}} title="Título">
        <button type="button">Uno</button>
      </Modal>,
    )
    await userEvent.tab() // Cerrar
    await userEvent.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Uno' })).toHaveFocus()
  })

  it('al cerrar, el foco vuelve al botón que lo abrió', async () => {
    function Host() {
      const [isOpen, setIsOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setIsOpen(true)}>
            Abrir
          </button>
          <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Título">
            contenido
          </Modal>
        </>
      )
    }
    render(<Host />)
    const opener = screen.getByRole('button', { name: 'Abrir' })
    await userEvent.click(opener)
    expect(screen.getByRole('dialog')).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })

  it('mientras está abierto el fondo no se desplaza, y al cerrar se libera', async () => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    function Host() {
      const [isOpen, setIsOpen] = useState(true)
      return (
        <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Título">
          contenido
        </Modal>
      )
    }
    render(<Host />)
    expect(document.body.style.position).toBe('fixed')

    await userEvent.keyboard('{Escape}')
    expect(document.body.style.position).toBe('')
    vi.restoreAllMocks()
  })

  it('con un diálogo dentro de otro, Escape cierra solo el de encima', async () => {
    const onCloseOuter = vi.fn()
    function Host() {
      const [isInnerOpen, setIsInnerOpen] = useState(false)
      return (
        <Modal isOpen onClose={onCloseOuter} title="Exterior">
          <button type="button" onClick={() => setIsInnerOpen(true)}>
            Abrir interior
          </button>
          <Modal isOpen={isInnerOpen} onClose={() => setIsInnerOpen(false)} title="Interior">
            contenido
          </Modal>
        </Modal>
      )
    }
    render(<Host />)
    await userEvent.click(screen.getByRole('button', { name: 'Abrir interior' }))
    expect(screen.getByRole('dialog', { name: 'Interior' })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Interior' })).not.toBeInTheDocument()
    expect(onCloseOuter).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Exterior' })).toBeInTheDocument()
  })
})
