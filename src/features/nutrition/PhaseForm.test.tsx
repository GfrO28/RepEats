import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Phase } from '@/repositories/PhaseRepository'
import type { Profile } from '@/repositories/ProfileRepository'
import { PhaseForm } from './PhaseForm'

const addPhase = vi.fn()
const updatePhase = vi.fn()

vi.mock('@/data/firestore/phaseRepository', () => ({
  firebasePhaseRepository: {
    generatePhaseId: () => 'nueva',
    addPhase: (phase: Phase) => addPhase(phase),
    updatePhase: (phase: Phase) => updatePhase(phase),
  },
}))

// TMB de un hombre de 72 kg, 164 cm y 34 años = 1580; × 1.55 (moderado) = 2449 kcal de mantenimiento
const profile: Profile = {
  sex: 'male',
  weightKg: 72,
  heightCm: 164,
  ageYears: 34,
  activityLevel: 'moderate',
  optionalMeals: [],
  adaptiveTdee: null,
}

const deficit: Phase = {
  id: 'deficit',
  type: 'deficit',
  startDate: '2026-03-02',
  endDate: null,
  weeklyRatePercent: -0.5,
  targetCalories: 1900,
  macros: { proteinG: 130, fatG: 58, carbsG: 219 },
  transition: null,
}

beforeEach(() => {
  addPhase.mockClear()
  updatePhase.mockClear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 2, 4, 12, 0)) // miércoles, dentro de la primera semana de la fase de déficit
})
afterEach(() => vi.useRealTimers())

describe('PhaseForm: transición', () => {
  it('sin una fase en curso, la transición no se puede elegir', () => {
    render(<PhaseForm profile={profile} activePhase={null} onDone={() => {}} />)
    expect(screen.getByRole('button', { name: 'Transición' })).toBeDisabled()
    expect(screen.getByText(/La transición aparece cuando ya tienes una fase en curso/)).toBeInTheDocument()
  })

  it('con una fase en curso muestra el calendario semana a semana hacia mantenimiento', async () => {
    render(<PhaseForm profile={profile} activePhase={deficit} onDone={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Transición' }))

    expect(screen.getByText('Calendario de la transición')).toBeInTheDocument()
    // 1900 → 2449 en 4 semanas (por defecto)
    expect(screen.getByText('2037 kcal')).toBeInTheDocument()
    expect(screen.getByText('2175 kcal')).toBeInTheDocument()
    expect(screen.getByText('2312 kcal')).toBeInTheDocument()
    expect(screen.getByText('2449 kcal')).toBeInTheDocument()
    expect(screen.getByText(/Empieza en 1900 kcal/)).toBeInTheDocument()
  })

  it('cambiar la duración cambia el calendario', async () => {
    render(<PhaseForm profile={profile} activePhase={deficit} onDone={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Transición' }))
    const weeks = screen.getByLabelText('Duración (semanas)')
    await userEvent.clear(weeks)
    await userEvent.type(weeks, '2')

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('2175 kcal')).toBeInTheDocument() // 1900 + 549/2 = 2174.5
  })

  it('una duración fuera de 2 a 12 semanas no deja guardar', async () => {
    render(<PhaseForm profile={profile} activePhase={deficit} onDone={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Transición' }))
    const weeks = screen.getByLabelText('Duración (semanas)')
    const save = screen.getByRole('button', { name: 'Guardar fase' })

    await userEvent.clear(weeks)
    await userEvent.type(weeks, '1')
    expect(save).toBeDisabled()
    await userEvent.clear(weeks)
    await userEvent.type(weeks, '13')
    expect(save).toBeDisabled()
    await userEvent.clear(weeks)
    await userEvent.type(weeks, '6')
    expect(save).toBeEnabled()
  })

  it('al guardar cierra la fase anterior y crea la transición con su calendario', async () => {
    const onDone = vi.fn()
    render(<PhaseForm profile={profile} activePhase={deficit} onDone={onDone} />)
    await userEvent.click(screen.getByRole('button', { name: 'Transición' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar fase' }))

    expect(updatePhase).toHaveBeenCalledWith({ ...deficit, endDate: '2026-03-04' })
    const saved = addPhase.mock.calls[0]?.[0] as Phase
    expect(saved).toMatchObject({
      id: 'nueva',
      type: 'transition',
      startDate: '2026-03-04',
      endDate: null,
      weeklyRatePercent: 0,
      targetCalories: 2037, // la semana 1
      transition: { startCalories: 1900, endCalories: 2449, weeks: 4 },
    })
    expect(onDone).toHaveBeenCalled()
  })

  it('usa el gasto ajustado del perfil como meta, si lo hay', async () => {
    render(
      <PhaseForm
        profile={{ ...profile, adaptiveTdee: { kcal: 2300, updatedAt: '2026-03-01' } }}
        activePhase={deficit}
        onDone={() => {}}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Transición' }))
    expect(screen.getByText(/termina en 2300 kcal/)).toBeInTheDocument()
  })

  it('las fases normales siguen mostrando su vista previa de siempre', () => {
    render(<PhaseForm profile={profile} activePhase={null} onDone={() => {}} />)
    expect(screen.getByText('Vista previa')).toBeInTheDocument()
    expect(screen.queryByText('Calendario de la transición')).not.toBeInTheDocument()
  })
})
