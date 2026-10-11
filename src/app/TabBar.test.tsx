import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TabBar } from './TabBar'

const TABS = [
  { id: 'uno', label: 'Uno' },
  { id: 'dos', label: 'Dos' },
] as const

describe('TabBar', () => {
  it('muestra todas las pestañas y marca la activa', () => {
    render(<TabBar label="Secciones" tabs={TABS} value="dos" onChange={() => {}} />)
    expect(screen.getByRole('group', { name: 'Secciones' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Uno' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Dos' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('al tocar una pestaña avisa con su id', async () => {
    const onChange = vi.fn()
    render(<TabBar label="Secciones" tabs={TABS} value="uno" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Dos' }))
    expect(onChange).toHaveBeenCalledWith('dos')
  })
})
