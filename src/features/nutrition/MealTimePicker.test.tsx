import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MealTimePicker } from './MealTimePicker'

describe('MealTimePicker', () => {
  it('muestra solo la comida que se está editando, con su hora precargada', () => {
    render(<MealTimePicker mealType="breakfast" resolvedTime="07:30" onAccept={vi.fn()} />)
    expect(screen.getByLabelText('Desayuno: hora')).toHaveTextContent('07')
    expect(screen.getByLabelText('Desayuno: minutos')).toHaveTextContent('30')
    expect(screen.queryByText('Almuerzo')).not.toBeInTheDocument()
  })

  it('"Aceptar" sin tocar nada devuelve la misma hora que ya tenía', async () => {
    const onAccept = vi.fn()
    render(<MealTimePicker mealType="lunch" resolvedTime="13:00" onAccept={onAccept} />)
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(onAccept).toHaveBeenCalledWith('13:00')
  })

  it('mover la rueda de hora y aceptar guarda el nuevo valor', async () => {
    vi.useFakeTimers()
    const onAccept = vi.fn()
    render(<MealTimePicker mealType="breakfast" resolvedTime="07:30" onAccept={onAccept} />)

    const hourWheel = screen.getByLabelText('Desayuno: hora')
    hourWheel.scrollTop = 9 * 32 // ITEM_HEIGHT = 32px; desplaza la rueda hasta "09"
    fireEvent.scroll(hourWheel)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(onAccept).toHaveBeenCalledWith('09:30')
    vi.useRealTimers()
  })

  it('los botones ▲/▼ mueven exactamente un número (más preciso que la rueda del mouse)', async () => {
    const onAccept = vi.fn()
    render(<MealTimePicker mealType="breakfast" resolvedTime="07:30" onAccept={onAccept} />)

    fireEvent.click(screen.getByRole('button', { name: 'Desayuno: minutos: uno más' }))
    fireEvent.click(screen.getByRole('button', { name: 'Desayuno: minutos: uno más' }))
    fireEvent.click(screen.getByRole('button', { name: 'Desayuno: hora: uno menos' }))

    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }))
    expect(onAccept).toHaveBeenCalledWith('06:32')
  })

  it('el botón ▲ en 00 da la vuelta a 23 (y ▼ en 23 vuelve a 00)', () => {
    render(<MealTimePicker mealType="breakfast" resolvedTime="00:00" onAccept={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Desayuno: hora: uno menos' }))
    expect(screen.getByLabelText('Desayuno: hora')).toHaveTextContent('23')
  })
})
