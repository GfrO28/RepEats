import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DiaryItem } from '@/repositories/DiaryRepository'
import type { SavedMeal } from '@/repositories/SavedMealRepository'
import { SaveMealForm } from './SaveMealForm'

const oats: DiaryItem = { foodId: 'f1', name: 'Avena', grams: 100, nutrition: { kcal: 150, proteinG: 5, fatG: 3, carbsG: 20 } }
const egg: DiaryItem = { foodId: 'f2', name: 'Huevo', grams: 50, nutrition: { kcal: 70, proteinG: 6, fatG: 5, carbsG: 0 } }

// Simula el gesto completo de deslizar sobre un elemento
function drag(element: Element, deltaX: number, pointerId = 1) {
  fireEvent.pointerDown(element, { pointerId, clientX: 0, clientY: 0 })
  fireEvent.pointerMove(element, { pointerId, clientX: deltaX, clientY: 0 })
  fireEvent.pointerUp(element, { pointerId, clientX: deltaX, clientY: 0 })
}

describe('SaveMealForm: crear', () => {
  it('el botón dice "Guardar comida"', () => {
    render(<SaveMealForm items={[oats]} onSave={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Guardar comida' })).toBeInTheDocument()
  })

  it('sin nombre, no se puede guardar', () => {
    render(<SaveMealForm items={[oats]} onSave={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Guardar comida' })).toBeDisabled()
  })

  it('guarda con el nombre y los ítems (tal cual, si no se quitó ninguno)', async () => {
    const onSave = vi.fn()
    render(<SaveMealForm items={[oats, egg]} onSave={onSave} />)
    await userEvent.type(screen.getByLabelText('Nombre de la comida'), 'Mi desayuno')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar comida' }))
    expect(onSave).toHaveBeenCalledWith('Mi desayuno', [oats, egg])
  })

  it('deslizar un alimento lo quita antes de guardar', async () => {
    const onSave = vi.fn()
    render(<SaveMealForm items={[oats, egg]} onSave={onSave} />)
    drag(screen.getByText('Huevo'), -80)
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Huevo' }))

    expect(screen.queryByText('Huevo')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Nombre de la comida'), 'Mi desayuno')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar comida' }))
    expect(onSave).toHaveBeenCalledWith('Mi desayuno', [oats])
  })

  it('sin ningún alimento, no se puede guardar', async () => {
    render(<SaveMealForm items={[oats]} onSave={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Nombre de la comida'), 'Mi desayuno')
    drag(screen.getByText('Avena'), -80)
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Avena' }))
    expect(screen.getByRole('button', { name: 'Guardar comida' })).toBeDisabled()
  })
})

describe('SaveMealForm: cambiar la cantidad de un alimento', () => {
  it('tocar un alimento revela un campo de cantidad', async () => {
    render(<SaveMealForm items={[oats]} onSave={vi.fn()} />)
    await userEvent.click(screen.getByText('Avena'))
    expect(screen.getByLabelText('Cantidad (g) de Avena')).toHaveValue(100)
  })

  it('confirmar la nueva cantidad escala kcal y macros, y lo refleja al guardar', async () => {
    const onSave = vi.fn()
    render(<SaveMealForm items={[oats]} onSave={onSave} />)

    await userEvent.click(screen.getByText('Avena'))
    const amountInput = screen.getByLabelText('Cantidad (g) de Avena')
    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '200')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar cantidad de Avena' }))

    expect(screen.getByText('200 g · 300 kcal')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Nombre de la comida'), 'Mi desayuno')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar comida' }))
    expect(onSave).toHaveBeenCalledWith('Mi desayuno', [
      { foodId: 'f1', name: 'Avena', grams: 200, nutrition: { kcal: 300, proteinG: 10, fatG: 6, carbsG: 40 } },
    ])
  })

  it('cancelar la edición no cambia nada', async () => {
    render(<SaveMealForm items={[oats]} onSave={vi.fn()} />)
    await userEvent.click(screen.getByText('Avena'))
    await userEvent.clear(screen.getByLabelText('Cantidad (g) de Avena'))
    await userEvent.type(screen.getByLabelText('Cantidad (g) de Avena'), '200')
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar edición de Avena' }))

    expect(screen.getByText('100 g · 150 kcal')).toBeInTheDocument()
  })

  it('un registro rápido sin gramos no se puede tocar para editar', () => {
    const quick: DiaryItem = { foodId: null, name: 'Menú del día', grams: null, nutrition: { kcal: 600, proteinG: 25, fatG: 20, carbsG: 70 } }
    render(<SaveMealForm items={[quick]} onSave={vi.fn()} />)
    expect(screen.getByText('Menú del día').closest('button')).toBeNull()
  })
})

describe('SaveMealForm: editar', () => {
  const mealToEdit: SavedMeal = { id: 'm1', name: 'Mi desayuno', items: [oats] }

  it('precarga el nombre y el botón dice "Guardar cambios"', () => {
    render(<SaveMealForm items={mealToEdit.items} mealToEdit={mealToEdit} onSave={vi.fn()} />)
    expect(screen.getByLabelText('Nombre de la comida')).toHaveValue('Mi desayuno')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
  })

  it('guardar cambios llama a onSave con el nombre y los ítems editados', async () => {
    const onSave = vi.fn()
    render(<SaveMealForm items={mealToEdit.items} mealToEdit={mealToEdit} onSave={onSave} />)

    const nameInput = screen.getByLabelText('Nombre de la comida')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Desayuno fuerte')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    expect(onSave).toHaveBeenCalledWith('Desayuno fuerte', [oats])
  })
})
