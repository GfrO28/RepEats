import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BottomNav } from './BottomNav'

describe('BottomNav', () => {
  it('muestra las cuatro secciones principales', () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Entrenar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nutrición' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Progreso' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ajustes' })).toBeInTheDocument()
  })
})
