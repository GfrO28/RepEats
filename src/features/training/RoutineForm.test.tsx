import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Exercise } from '@/repositories/WorkoutRepository'
import type { Routine } from '@/repositories/RoutineRepository'
import { RoutineForm } from './RoutineForm'

let exercises: Exercise[] = []
const addRoutine = vi.fn()

vi.mock('@/data/firestore/workoutRepository', () => ({
  firebaseWorkoutRepository: {
    subscribeExercises: (onChange: (data: Exercise[]) => void) => {
      onChange(exercises)
      return () => {}
    },
  },
}))
vi.mock('@/data/firestore/routineRepository', () => ({
  firebaseRoutineRepository: {
    generateRoutineId: () => 'nueva-rutina',
    addRoutine: (routine: Routine) => addRoutine(routine),
  },
}))

const pressBanca: Exercise = {
  id: 'e1',
  name: 'Press de banca',
  primaryMuscles: ['pectoral_medio'],
  secondaryMuscles: [],
  equipment: 'Barra',
  notes: '',
}
const remo: Exercise = {
  id: 'e2',
  name: 'Remo con barra',
  primaryMuscles: ['dorsal_ancho'],
  secondaryMuscles: [],
  equipment: 'Barra',
  notes: '',
}
const sentadilla: Exercise = {
  id: 'e3',
  name: 'Sentadilla',
  primaryMuscles: ['recto_femoral'],
  secondaryMuscles: [],
  equipment: 'Barra',
  notes: '',
}

const editingRoutine: Routine = {
  id: 'r1',
  name: 'Empuje',
  suggestedDay: 'Lunes',
  suggestedTime: null,
  order: 0,
  exercises: [
    { exerciseId: 'e1', targetSets: [{ type: 'Normal', repsMin: 8, repsMax: 10, weight: 60, restSeconds: 90 }] },
    { exerciseId: 'e2', targetSets: [{ type: 'Normal', repsMin: 10, repsMax: 12, weight: 40, restSeconds: 60 }] },
  ],
}

afterEach(() => {
  exercises = []
  addRoutine.mockClear()
})

describe('RoutineForm', () => {
  it('ya no muestra el selector de tipo de serie (se elige durante la sesión en vivo)', () => {
    exercises = [pressBanca]
    render(<RoutineForm routineToEdit={editingRoutine} onDone={vi.fn()} />)
    for (const type of ['Normal', 'Calentamiento', 'Al Fallo', 'Drop Set']) {
      expect(screen.queryByRole('button', { name: type })).not.toBeInTheDocument()
    }
    // los campos de la serie sí siguen ahí
    expect(screen.getByLabelText('Series')).toBeInTheDocument()
    expect(screen.getByLabelText('Peso (kg)')).toBeInTheDocument()
  })

  it('sin un botón "−" aparte: deslizar el ejercicio hacia la izquierda lo quita de la rutina', async () => {
    exercises = [pressBanca, remo]
    render(<RoutineForm routineToEdit={editingRoutine} onDone={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /^−$/ })).not.toBeInTheDocument()
    expect(screen.getByText('Remo con barra')).toBeInTheDocument()

    // el botón que revela el deslizar quita el ejercicio sin pedir confirmación (es un borrador sin guardar)
    const confirmSpy = vi.spyOn(window, 'confirm')
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Remo con barra de la rutina' }))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(screen.queryByText('Remo con barra')).not.toBeInTheDocument()
    expect(screen.getByText('Press de banca')).toBeInTheDocument() // el otro ejercicio no se toca
  })

  it('el ejercicio quitado vuelve a estar disponible para agregar', async () => {
    exercises = [pressBanca]
    render(<RoutineForm routineToEdit={editingRoutine} onDone={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Press de banca de la rutina' }))

    await userEvent.click(screen.getByRole('button', { name: '+ Agregar ejercicio' }))
    expect(screen.getByRole('button', { name: 'Press de banca' })).toBeInTheDocument()
  })

  it('un ejercicio nuevo se agrega con tipo "Normal" por defecto (no hay forma de elegir otro aquí)', async () => {
    exercises = [pressBanca]
    render(<RoutineForm routineToEdit={null} onDone={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Nombre de la rutina'), 'Full body')
    await userEvent.click(screen.getByRole('button', { name: '+ Agregar ejercicio' }))
    await userEvent.click(screen.getByRole('button', { name: 'Press de banca' }))
    await userEvent.click(screen.getByRole('button', { name: 'Crear rutina' }))

    const saved = addRoutine.mock.calls[0]?.[0] as Routine
    expect(saved.exercises).toHaveLength(1)
    expect(saved.exercises[0]?.targetSets.every((set) => set.type === 'Normal')).toBe(true)
  })

  it('el menú (⋮) permite reemplazar el ejercicio, conservando series/reps/peso/descanso de ese puesto', async () => {
    exercises = [pressBanca, remo, sentadilla]
    render(<RoutineForm routineToEdit={editingRoutine} onDone={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Más opciones: Press de banca' }))
    await userEvent.click(screen.getByRole('button', { name: 'Reemplazar ejercicio' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sentadilla' }))

    expect(screen.queryByText('Press de banca')).not.toBeInTheDocument()
    expect(screen.getByText('Sentadilla')).toBeInTheDocument()
    expect(screen.getByText('Remo con barra')).toBeInTheDocument() // el otro puesto no se toca
    expect(screen.getAllByLabelText('Peso (kg)')[0]).toHaveValue('60') // el peso configurado para ese puesto no cambió
  })

  it('no ofrece como reemplazo un ejercicio que ya está en la rutina', async () => {
    exercises = [pressBanca, remo]
    render(<RoutineForm routineToEdit={editingRoutine} onDone={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Más opciones: Press de banca' }))
    await userEvent.click(screen.getByRole('button', { name: 'Reemplazar ejercicio' }))

    expect(screen.queryByRole('button', { name: 'Remo con barra' })).not.toBeInTheDocument()
  })
})
