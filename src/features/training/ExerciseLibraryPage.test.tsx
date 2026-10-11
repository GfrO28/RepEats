import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Exercise } from '@/repositories/WorkoutRepository'
import type { Routine } from '@/repositories/RoutineRepository'
import { ExerciseLibraryPage } from './ExerciseLibraryPage'

let exercises: Exercise[] = []
let routines: Routine[] = []
const deleteExercise = vi.fn()

vi.mock('@/data/firestore/workoutRepository', () => ({
  firebaseWorkoutRepository: {
    subscribeExercises: (onChange: (data: Exercise[]) => void) => {
      onChange(exercises)
      return () => {}
    },
    deleteExercise: (id: string) => deleteExercise(id),
  },
}))
vi.mock('@/data/firestore/routineRepository', () => ({
  firebaseRoutineRepository: {
    subscribeRoutines: (onChange: (data: Routine[]) => void) => {
      onChange(routines)
      return () => {}
    },
  },
}))

const exercise = (id: string, name: string): Exercise => ({
  id,
  name,
  primaryMuscles: ['pectoral_medio'],
  secondaryMuscles: [],
  equipment: 'Barra',
  notes: '',
})

beforeEach(() => deleteExercise.mockClear())
afterEach(() => {
  exercises = []
  routines = []
  vi.restoreAllMocks()
})

describe('ExerciseLibraryPage: eliminar', () => {
  it('pide confirmar y borra al aceptar', async () => {
    exercises = [exercise('a', 'Press de banca')]
    render(<ExerciseLibraryPage />)

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Press de banca' }))
    expect(confirmSpy).toHaveBeenCalledWith('¿Eliminar el ejercicio "Press de banca"?')
    expect(deleteExercise).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Press de banca' }))
    expect(deleteExercise).toHaveBeenCalledWith('a')
  })

  it('si el ejercicio está en una rutina, avisa cuál antes de borrar', async () => {
    exercises = [exercise('a', 'Press de banca')]
    routines = [
      { id: 'r1', name: 'Empuje', suggestedDay: 'Lunes', suggestedTime: null, exercises: [{ exerciseId: 'a', targetSets: [] }], order: 0 },
      { id: 'r2', name: 'Piernas', suggestedDay: 'Martes', suggestedTime: null, exercises: [], order: 1 },
    ]
    render(<ExerciseLibraryPage />)

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Press de banca' }))
    expect(confirmSpy).toHaveBeenCalledWith(
      '¿Eliminar el ejercicio "Press de banca"? Se usa en 1 rutina (Empuje): dejará de aparecer en ella.',
    )
  })

  it('en dos rutinas usa el plural', async () => {
    exercises = [exercise('a', 'Press de banca')]
    routines = [
      { id: 'r1', name: 'Empuje', suggestedDay: 'Lunes', suggestedTime: null, exercises: [{ exerciseId: 'a', targetSets: [] }], order: 0 },
      { id: 'r2', name: 'Full body', suggestedDay: 'Miércoles', suggestedTime: null, exercises: [{ exerciseId: 'a', targetSets: [] }], order: 1 },
    ]
    render(<ExerciseLibraryPage />)

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Press de banca' }))
    expect(confirmSpy).toHaveBeenCalledWith(
      '¿Eliminar el ejercicio "Press de banca"? Se usa en 2 rutinas (Empuje, Full body): dejará de aparecer en ellas.',
    )
  })
})

describe('ExerciseLibraryPage: tocar la fila', () => {
  it('sin un botón de editar aparte: tocar la fila abre su edición', async () => {
    exercises = [exercise('a', 'Press de banca')]
    render(<ExerciseLibraryPage />)

    expect(screen.queryByRole('button', { name: 'Editar Press de banca' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('Press de banca'))
    expect(screen.getByRole('heading', { name: 'Editar ejercicio' })).toBeInTheDocument()
  })
})
