import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SavedMeal } from '@/repositories/SavedMealRepository'
import { SavedMealsList } from './SavedMealsList'

const meal: SavedMeal = {
  id: 'm1',
  name: 'Mi desayuno',
  items: [{ foodId: 'f1', name: 'Avena', grams: 100, nutrition: { kcal: 150, proteinG: 5, fatG: 3, carbsG: 20 } }],
}

describe('SavedMealsList', () => {
  it('sin comidas guardadas, lo dice', () => {
    render(<SavedMealsList savedMeals={[]} onUse={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText(/Aún no tienes comidas guardadas/)).toBeInTheDocument()
  })

  it('tocar el nombre la usa', async () => {
    const onUse = vi.fn()
    render(<SavedMealsList savedMeals={[meal]} onUse={onUse} onEdit={vi.fn()} onDelete={vi.fn()} />)
    await userEvent.click(screen.getByText('Mi desayuno'))
    expect(onUse).toHaveBeenCalledWith(meal)
  })

  it('el botón de editar no la usa, solo llama a onEdit', async () => {
    const onUse = vi.fn()
    const onEdit = vi.fn()
    render(<SavedMealsList savedMeals={[meal]} onUse={onUse} onEdit={onEdit} onDelete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Editar Mi desayuno' }))
    expect(onEdit).toHaveBeenCalledWith(meal)
    expect(onUse).not.toHaveBeenCalled()
  })

  it('el botón que revela el deslizar la elimina', async () => {
    const onDelete = vi.fn()
    render(<SavedMealsList savedMeals={[meal]} onUse={vi.fn()} onEdit={vi.fn()} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Mi desayuno' }))
    expect(onDelete).toHaveBeenCalledWith(meal)
  })
})
