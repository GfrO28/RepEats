import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@/repositories/SessionRepository'
import type { Exercise } from '@/repositories/WorkoutRepository'
import { ExerciseProgressPage } from './ExerciseProgressPage'

let sessions: Session[] = []
let exercises: Exercise[] = []

vi.mock('@/data/firestore/sessionRepository', () => ({
  firebaseSessionRepository: {
    subscribeSessions: (onChange: (data: Session[]) => void) => {
      onChange(sessions)
      return () => {}
    },
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

const exercise = (id: string, name: string): Exercise => ({
  id,
  name,
  primaryMuscles: ['pectoral_medio'],
  secondaryMuscles: [],
  equipment: 'Barra',
  notes: '',
})

function makeSession(id: string, endedAt: Date, exerciseId: string, weight: number, reps: number): Session {
  return {
    id,
    routineId: null,
    startedAt: new Date(endedAt.getTime() - 3_600_000),
    endedAt,
    status: 'completed',
    manualExerciseKcal: null,
    exercises: [
      {
        exerciseId,
        notes: '',
        sets: [
          { type: 'Calentamiento', weight: 20, reps: 10, completedAt: endedAt },
          { type: 'Normal', weight, reps, completedAt: endedAt },
          { type: 'Normal', weight, reps, completedAt: endedAt },
        ],
      },
    ],
  }
}

afterEach(() => {
  sessions = []
  exercises = []
})

describe('ExerciseProgressPage', () => {
  it('sin ejercicios lo dice en el selector', () => {
    render(<ExerciseProgressPage />)
    expect(screen.getByRole('combobox', { name: 'Ejercicio' })).toHaveDisplayValue('Aún no tienes ejercicios')
  })

  it('ofrece primero los ejercicios con registros y propone el último que hizo', () => {
    exercises = [exercise('a', 'Aperturas'), exercise('b', 'Press de banca'), exercise('c', 'Curl')]
    sessions = [makeSession('s1', new Date(2026, 2, 2, 19), 'b', 60, 8), makeSession('s2', new Date(2026, 2, 4, 19), 'c', 20, 10)]
    render(<ExerciseProgressPage />)

    const select = screen.getByRole('combobox', { name: 'Ejercicio' })
    expect(select).toHaveDisplayValue('Curl') // el más reciente
    const groups = within(select).getAllByRole('group')
    expect(groups.map((group) => group.getAttribute('label'))).toEqual(['Con registros', 'Sin registros todavía'])
    expect(within(groups[0] as HTMLElement).getAllByRole('option').map((o) => o.textContent)).toEqual(['Curl', 'Press de banca'])
    expect(within(groups[1] as HTMLElement).getAllByRole('option').map((o) => o.textContent)).toEqual(['Aperturas'])
  })

  it('un ejercicio sin sesiones explica qué pasará cuando lo haga', async () => {
    exercises = [exercise('a', 'Aperturas'), exercise('b', 'Press de banca')]
    sessions = [makeSession('s1', new Date(2026, 2, 2, 19), 'b', 60, 8)]
    render(<ExerciseProgressPage />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Ejercicio' }), 'a')
    expect(screen.getByText(/Aún no hay sesiones completadas con este ejercicio/)).toBeInTheDocument()
  })

  it('con una sesión muestra los mejores valores y avisa que con dos verá el cambio', () => {
    exercises = [exercise('b', 'Press de banca')]
    sessions = [makeSession('s1', new Date(2026, 2, 4, 19), 'b', 60, 8)]
    render(<ExerciseProgressPage />)

    // 1RM = 60 × (1 + 8/30) = 76.0
    expect(screen.getByText('76 kg')).toBeInTheDocument()
    expect(screen.getByText('60 kg')).toBeInTheDocument()
    expect(screen.getByText('Con dos sesiones verás tu cambio.')).toBeInTheDocument()
    expect(screen.getByText('2 × 8 @ 60 kg')).toBeInTheDocument()
  })

  it('con dos sesiones muestra el cambio del 1RM desde la primera', () => {
    exercises = [exercise('b', 'Press de banca')]
    sessions = [
      makeSession('s1', new Date(2026, 2, 2, 19), 'b', 60, 8), // 76.0
      makeSession('s2', new Date(2026, 2, 9, 19), 'b', 70, 8), // 88.7
    ]
    render(<ExerciseProgressPage />)
    expect(screen.getByText('+12.7 kg')).toBeInTheDocument()
    expect(screen.getByText(/en el 1RM estimado \(16\.7 %\)/)).toBeInTheDocument()
  })

  it('las sesiones recientes salen de la más nueva a la más vieja y sin contar el calentamiento en el volumen', () => {
    exercises = [exercise('b', 'Press de banca')]
    sessions = [makeSession('s1', new Date(2026, 2, 2, 19), 'b', 60, 8), makeSession('s2', new Date(2026, 2, 9, 19), 'b', 70, 8)]
    render(<ExerciseProgressPage />)

    const list = screen.getByText('Últimas sesiones').parentElement as HTMLElement
    const dates = within(list)
      .getAllByText(/^(lun|mar|mié|jue|vie|sáb|dom) \d+ \w+$/)
      .map((node) => node.textContent)
    expect(dates).toEqual(['lun 9 mar', 'lun 2 mar'])
    expect(within(list).getByText(/1\D?120 kg/)).toBeInTheDocument() // 70 × 8 × 2; el calentamiento no cuenta
  })

  it('cambiar de métrica marca el botón activo', async () => {
    exercises = [exercise('b', 'Press de banca')]
    sessions = [makeSession('s1', new Date(2026, 2, 4, 19), 'b', 60, 8)]
    render(<ExerciseProgressPage />)
    expect(screen.getByRole('button', { name: '1RM estimado' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Volumen' }))
    expect(screen.getByRole('button', { name: 'Volumen' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '1RM estimado' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(/sin el calentamiento/)).toBeInTheDocument()
  })
})
