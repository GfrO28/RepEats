import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Routine } from '@/repositories/RoutineRepository'
import type { Exercise } from '@/repositories/WorkoutRepository'
import type { Session } from '@/repositories/SessionRepository'
import { RoutineLibraryPage } from './RoutineLibraryPage'

let routines: Routine[] = []
const exercises: Exercise[] = []
const deleteRoutine = vi.fn()
const addRoutine = vi.fn()
const addSession = vi.fn()

vi.mock('@/data/firestore/routineRepository', () => ({
  firebaseRoutineRepository: {
    subscribeRoutines: (onChange: (data: Routine[]) => void) => {
      onChange(routines)
      return () => {}
    },
    generateRoutineId: () => 'nueva-rutina',
    deleteRoutine: (id: string) => deleteRoutine(id),
    addRoutine: (routine: Routine) => addRoutine(routine),
  },
}))
vi.mock('@/data/firestore/workoutRepository', () => ({
  firebaseWorkoutRepository: {
    subscribeExercises: (onChange: (data: Exercise[]) => void) => {
      onChange(exercises)
      return () => {}
    },
  },
}))
vi.mock('@/data/firestore/sessionRepository', () => ({
  firebaseSessionRepository: {
    generateSessionId: () => 'nueva-sesion',
    addSession: (session: Session) => addSession(session),
  },
}))

const routine = (id: string, name: string, order = 0, suggestedDay: Routine['suggestedDay'] = 'Lunes'): Routine => ({
  id,
  name,
  suggestedDay,
  suggestedTime: null,
  exercises: [],
  order,
})

beforeEach(() => {
  deleteRoutine.mockClear()
  addRoutine.mockClear()
  addSession.mockClear()
})
afterEach(() => {
  routines = []
  vi.restoreAllMocks()
})

// Las rutinas de prueba usan "Lunes" por defecto; como la lista solo muestra las del día elegido en la franja
// (que arranca en "hoy", una fecha real e impredecible en la prueba), primero hay que elegir Lunes a propósito.
async function selectMonday() {
  await userEvent.click(screen.getByRole('radio', { name: /Lunes/ }))
}

describe('RoutineLibraryPage', () => {
  it('tocar la rutina abre su edición', async () => {
    routines = [routine('a', 'Empuje')]
    render(<RoutineLibraryPage />)
    await selectMonday()

    await userEvent.click(screen.getByRole('button', { name: 'Editar Empuje' }))
    expect(screen.getByRole('heading', { name: 'Editar rutina' })).toBeInTheDocument()
  })

  it('el botón de iniciar sesión crea una sesión en curso a partir de la rutina, sin abrir la edición', async () => {
    routines = [routine('a', 'Empuje')]
    render(<RoutineLibraryPage />)
    await selectMonday()

    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión: Empuje' }))
    expect(addSession).toHaveBeenCalledWith(expect.objectContaining({ routineId: 'a', status: 'in_progress' }))
    expect(screen.queryByRole('heading', { name: 'Editar rutina' })).not.toBeInTheDocument()
  })

  it('al iniciar la sesión copia la marca de superset de la rutina, y solo a los ejercicios que la tienen', async () => {
    const set = { type: 'Normal', repsMin: 8, repsMax: 10, weight: 20, restSeconds: 60 } as const
    routines = [
      {
        ...routine('a', 'Brazos'),
        exercises: [
          { exerciseId: 'curl', targetSets: [set], supersetGroup: 'ss1' },
          { exerciseId: 'triceps', targetSets: [set], supersetGroup: 'ss1' },
          { exerciseId: 'press', targetSets: [set] },
        ],
      },
    ]
    render(<RoutineLibraryPage />)
    await selectMonday()

    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión: Brazos' }))
    const started = addSession.mock.calls[0]?.[0] as Session
    expect(started.exercises.map((e) => e.supersetGroup)).toEqual(['ss1', 'ss1', undefined])
    expect('supersetGroup' in started.exercises[2]!).toBe(false) // Firestore rechaza undefined
  })

  it('eliminar (el botón que revela el deslizar) pide confirmar y borra al aceptar', async () => {
    routines = [routine('a', 'Empuje')]
    render(<RoutineLibraryPage />)
    await selectMonday()

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Empuje' }))
    expect(confirmSpy).toHaveBeenCalledWith('¿Eliminar la rutina "Empuje"?')
    expect(deleteRoutine).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Empuje' }))
    expect(deleteRoutine).toHaveBeenCalledWith('a')
  })

  it('"Iniciar sesión vacía" crea una sesión sin rutina', async () => {
    render(<RoutineLibraryPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión vacía' }))
    expect(addSession).toHaveBeenCalledWith(expect.objectContaining({ routineId: null, status: 'in_progress' }))
  })

  it('sin rutinas lo dice', () => {
    render(<RoutineLibraryPage />)
    expect(screen.getByText('Aún no tienes rutinas')).toBeInTheDocument()
  })

  it('se muestran según "order", sin importar en qué orden llegan de Firestore', async () => {
    routines = [routine('c', 'Pull', 2), routine('a', 'Piernas', 0), routine('b', 'Push', 1)]
    render(<RoutineLibraryPage />)
    await selectMonday()
    const names = screen.getAllByRole('button', { name: /^Editar/ }).map((button) => button.getAttribute('aria-label'))
    expect(names).toEqual(['Editar Piernas', 'Editar Push', 'Editar Pull'])
  })

  it('cada rutina tiene su asa para reordenar, alcanzable con teclado', async () => {
    routines = [routine('a', 'Empuje')]
    render(<RoutineLibraryPage />)
    await selectMonday()
    expect(screen.getByRole('button', { name: 'Mover Empuje' })).toBeInTheDocument()
  })

  it('una rutina nueva se crea después de las que ya existen', async () => {
    routines = [routine('a', 'Empuje', 0), routine('b', 'Piernas', 1)]
    render(<RoutineLibraryPage />)

    await userEvent.click(screen.getByRole('button', { name: 'Nueva rutina' }))
    await userEvent.type(screen.getByLabelText('Nombre de la rutina'), 'Pull')
    await userEvent.click(screen.getByRole('button', { name: 'Crear rutina' }))

    // RoutineForm ya se prueba aparte; aquí solo importa que reciba el siguiente lugar de la lista (2, no 0)
    expect(addRoutine).toHaveBeenCalledWith(expect.objectContaining({ name: 'Pull', order: 2 }))
  })

  it('al elegir un día en la franja, la lista solo muestra las rutinas con ese "día sugerido"', async () => {
    routines = [routine('a', 'Piernas', 0, 'Lunes'), routine('b', 'Empuje', 1, 'Martes')]
    render(<RoutineLibraryPage />)

    await userEvent.click(screen.getByRole('radio', { name: /Martes/ }))
    expect(screen.getByText('Empuje')).toBeInTheDocument()
    expect(screen.queryByText('Piernas')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: /^Lunes/ }))
    expect(screen.getByText('Piernas')).toBeInTheDocument()
    expect(screen.queryByText('Empuje')).not.toBeInTheDocument()
  })

  it('un día sin ninguna rutina asignada se muestra como descanso, sin la lista', async () => {
    routines = [routine('a', 'Piernas', 0, 'Lunes')]
    render(<RoutineLibraryPage />)

    await userEvent.click(screen.getByRole('radio', { name: /Martes/ }))
    expect(screen.getByText('Descanso 😌')).toBeInTheDocument()
    expect(screen.queryByText('Piernas')).not.toBeInTheDocument()
  })
})
