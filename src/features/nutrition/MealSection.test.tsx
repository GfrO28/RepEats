import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DiaryItem } from '@/repositories/DiaryRepository'
import type { DayTarget } from '@/domain/nutritionGoals'
import { MealSection } from './MealSection'

const item = (name: string, kcal: number, macros: { proteinG?: number; fatG?: number; carbsG?: number } = {}): DiaryItem => ({
  foodId: name,
  name,
  grams: 100,
  nutrition: { kcal, proteinG: macros.proteinG ?? 0, fatG: macros.fatG ?? 0, carbsG: macros.carbsG ?? 0 },
})

function renderSection(items: DiaryItem[] = [], target: DayTarget | null = null, time: string | null = null) {
  const onEditItem = vi.fn()
  const onRemoveItem = vi.fn()
  const onRemoveMeal = vi.fn()
  render(
    <MealSection
      type="breakfast"
      items={items}
      target={target}
      time={time}
      onAddItem={vi.fn()}
      onEditItem={onEditItem}
      onRemoveItem={onRemoveItem}
      onRemoveMeal={onRemoveMeal}
      onCopyFromDay={vi.fn()}
      onSaveAsMeal={vi.fn()}
    />,
  )
  return { onEditItem, onRemoveItem, onRemoveMeal }
}

// El texto de kcal/macros ahora se arma con <span> de colores en vez de un solo string: se compara por el
// textContent completo del párrafo que los agrupa, no por un fragmento de texto suelto
function findByFullText(text: string) {
  return screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === text)
}

// Simula el gesto completo de deslizar sobre un elemento
function drag(element: Element, deltaX: number, pointerId = 1) {
  fireEvent.pointerDown(element, { pointerId, clientX: 0, clientY: 0 })
  fireEvent.pointerMove(element, { pointerId, clientX: deltaX, clientY: 0 })
  fireEvent.pointerUp(element, { pointerId, clientX: deltaX, clientY: 0 })
}

afterEach(() => vi.restoreAllMocks())

describe('MealSection: quitar la comida deslizando', () => {
  it('una comida vacía se quita sin confirmar', async () => {
    const { onRemoveMeal } = renderSection([])
    const confirmSpy = vi.spyOn(window, 'confirm')
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Desayuno de este día' }))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(onRemoveMeal).toHaveBeenCalledTimes(1)
  })

  it('con alimentos, pide confirmar antes de quitarla', async () => {
    const { onRemoveMeal } = renderSection([item('Avena', 150)])
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Desayuno de este día' }))
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('1 alimento(s)'))
    expect(onRemoveMeal).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Desayuno de este día' }))
    expect(onRemoveMeal).toHaveBeenCalledTimes(1)
  })
})

describe('MealSection: tocar un alimento para editarlo', () => {
  it('tocar el alimento abre su edición, con su posición', async () => {
    const { onEditItem } = renderSection([item('Avena', 150), item('Leche', 90)])
    await userEvent.click(screen.getByText('Leche'))
    expect(onEditItem).toHaveBeenCalledWith(1)
  })

  it('deslizar un alimento no también abre su edición', () => {
    const { onEditItem } = renderSection([item('Avena', 150)])
    drag(screen.getByText('Avena'), -60)
    expect(onEditItem).not.toHaveBeenCalled()
  })
})

describe('MealSection: quitar un alimento deslizando', () => {
  it('el botón que revela el deslizar quita ese alimento, sin confirmar', async () => {
    const { onRemoveItem } = renderSection([item('Avena', 150), item('Leche', 90)])
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Leche' }))
    expect(onRemoveItem).toHaveBeenCalledWith(1)
  })

  it('deslizar un alimento no también desliza (ni activa) la fila de toda la comida', () => {
    const { onRemoveMeal } = renderSection([item('Avena', 150)])
    drag(screen.getByText('Avena'), -60) // arrastra bastante, solo sobre el alimento
    expect(onRemoveMeal).not.toHaveBeenCalled()
    // "Quitar Desayuno de este día" sigue siendo alcanzable con normalidad (no quedó abierta por accidente)
    expect(screen.getByRole('button', { name: 'Quitar Desayuno de este día' })).toBeInTheDocument()
  })
})

describe('MealSection: objetivo de la comida', () => {
  it('sin objetivo (sin fase activa), solo muestra las kcal consumidas', () => {
    renderSection([item('Avena', 150)], null)
    expect(findByFullText('150 kcal')).toBeInTheDocument()
  })

  it('con objetivo, muestra consumido/objetivo de kcal y cada macro', () => {
    const target: DayTarget = { kcal: 500, macros: { proteinG: 30, fatG: 15, carbsG: 60 } }
    renderSection([item('Avena', 150, { proteinG: 5, fatG: 3, carbsG: 20 })], target)
    expect(findByFullText('150 / 500 kcal · P 5/30 · G 3/15 · C 20/60')).toBeInTheDocument()
  })

  it('cada dato lleva su color: proteína roja, grasa amarilla, carbohidratos celestes, kcal en negrita', () => {
    const target: DayTarget = { kcal: 500, macros: { proteinG: 30, fatG: 15, carbsG: 60 } }
    renderSection([item('Avena', 150, { proteinG: 5, fatG: 3, carbsG: 20 })], target)
    expect(screen.getByText('150 / 500 kcal')).toHaveClass('font-bold')
    expect(screen.getByText('P 5/30')).toHaveClass('text-red-400')
    expect(screen.getByText('G 3/15')).toHaveClass('text-amber-400')
    expect(screen.getByText('C 20/60')).toHaveClass('text-cyan-400')
  })

  it('con hora sugerida, la muestra junto al nombre', () => {
    renderSection([], null, '07:30')
    expect(screen.getByText('07:30')).toBeInTheDocument()
  })

  it('sin hora sugerida, no muestra ninguna', () => {
    renderSection([], null, null)
    expect(screen.queryByText(/^\d{2}:\d{2}$/)).not.toBeInTheDocument()
  })
})

describe('MealSection: macros por alimento, de forma resumida', () => {
  it('cada alimento muestra sus propios P/G/C junto a las kcal', () => {
    renderSection([item('Avena', 150, { proteinG: 5.4, fatG: 3.1, carbsG: 20 })])
    expect(findByFullText('100 g · 150 kcal · P 5.4 · G 3.1 · C 20')).toBeInTheDocument()
    expect(screen.getByText('P 5.4')).toHaveClass('text-red-400')
    expect(screen.getByText('G 3.1')).toHaveClass('text-amber-400')
    expect(screen.getByText('C 20')).toHaveClass('text-cyan-400')
  })
})
