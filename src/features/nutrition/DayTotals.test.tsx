import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DayTotals } from './DayTotals'

const totals = { kcal: 1640, proteinG: 98, fatG: 40, carbsG: 150 }
const target = { kcal: 2000, macros: { proteinG: 150, fatG: 60, carbsG: 220 } }

describe('DayTotals: con fase activa', () => {
  it('muestra el margen del día como número grande, en verde si vas dentro del objetivo', () => {
    render(<DayTotals totals={totals} target={target} tdee={2000} />)
    expect(screen.getByText('+360')).toHaveStyle({ color: 'var(--emerald-400)' })
    expect(screen.getByText('Dentro de tu margen de hoy.')).toBeInTheDocument()
  })

  it('pasado el objetivo, el margen se muestra negativo y con el texto de cuánto se excedió', () => {
    render(<DayTotals totals={{ ...totals, kcal: 2300 }} target={target} tdee={2000} />)
    expect(screen.getByText('-300')).toBeInTheDocument()
    expect(screen.getByText('Pasaste tu objetivo por 300 kcal.')).toBeInTheDocument()
  })

  it('muestra el objetivo, el TDEE y lo consumido en sus tarjetas', () => {
    render(<DayTotals totals={totals} target={target} tdee={2000} />)
    expect(screen.getByText('TDEE 2000 kcal')).toBeInTheDocument()
    expect(screen.getByText('de 2000 kcal')).toBeInTheDocument()
    expect(screen.getByText('1640 kcal')).toBeInTheDocument()
  })

  it('muestra las 3 macros como barras horizontales, debajo del velocímetro', () => {
    render(<DayTotals totals={totals} target={target} tdee={2000} />)
    expect(screen.getByText('98 / 150 g')).toBeInTheDocument()
    expect(screen.getByText('40 / 60 g')).toBeInTheDocument()
    expect(screen.getByText('150 / 220 g')).toBeInTheDocument()
  })
})

describe('DayTotals: el rojo empieza en el TDEE, no en un % del objetivo', () => {
  // En déficit, el objetivo (1800) queda por debajo del TDEE (2000): pasarte del objetivo sin llegar al TDEE
  // sigue siendo déficit, solo que menor, así que el margen se ve en ámbar, no en rojo.
  const deficitTarget = { kcal: 1800, macros: { proteinG: 150, fatG: 60, carbsG: 180 } }

  it('pasado el objetivo pero bajo el TDEE: en ámbar', () => {
    render(<DayTotals totals={{ ...totals, kcal: 1900 }} target={deficitTarget} tdee={2000} />)
    expect(screen.getByText('-100')).toHaveStyle({ color: 'var(--amber-400)' })
  })

  it('pasado el TDEE: recién ahí, en rojo', () => {
    render(<DayTotals totals={{ ...totals, kcal: 2100 }} target={deficitTarget} tdee={2000} />)
    expect(screen.getByText('-300')).toHaveStyle({ color: 'var(--red-400)' })
  })
})

describe('DayTotals: sin fase activa', () => {
  it('sin objetivo, muestra los totales en texto plano y el aviso de empezar una fase', () => {
    render(<DayTotals totals={totals} target={null} tdee={2000} />)
    expect(screen.getByText('1640 kcal')).toBeInTheDocument()
    expect(screen.getByText(/Empieza una fase en la pestaña Plan/)).toBeInTheDocument()
  })
})

describe('DayTotals: kcal de ejercicio', () => {
  it('con kcal de ejercicio, se muestra como informativo', () => {
    render(<DayTotals totals={totals} target={target} tdee={2000} exerciseKcal={320} />)
    expect(screen.getByText(/unas 320 kcal/)).toBeInTheDocument()
  })

  it('sin kcal de ejercicio, no se muestra nada', () => {
    render(<DayTotals totals={totals} target={target} tdee={2000} />)
    expect(screen.queryByText(/Entrenamiento de este día/)).not.toBeInTheDocument()
  })
})
