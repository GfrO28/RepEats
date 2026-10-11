import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { Session } from '@/repositories/SessionRepository'
import type { Exercise } from '@/repositories/WorkoutRepository'
import { ProgressSummaryPage } from './ProgressSummaryPage'

let sessions: Session[] = []
const exercises: Exercise[] = [
  {
    id: 'press',
    name: 'Press de banca',
    primaryMuscles: ['pectoral_medio'],
    secondaryMuscles: [],
    equipment: 'Barra',
    notes: '',
  },
]

// Los repositorios de Firestore se sustituyen: entregan los datos de la prueba de inmediato
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

// Miércoles 4 de marzo de 2026, 12:00 (la semana empieza el lunes 2)
const NOW = new Date(2026, 2, 4, 12, 0)

function makeSession(id: string, endedAt: Date, weight: number): Session {
  return {
    id,
    routineId: null,
    startedAt: new Date(endedAt.getTime() - 60 * 60_000),
    endedAt,
    status: 'completed',
    manualExerciseKcal: null,
    exercises: [
      {
        exerciseId: 'press',
        notes: '',
        sets: [
          { type: 'Calentamiento', weight: 20, reps: 10, completedAt: endedAt },
          { type: 'Normal', weight, reps: 5, completedAt: endedAt },
          { type: 'Normal', weight, reps: 5, completedAt: endedAt },
        ],
      },
    ],
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
  sessions = []
})

describe('ProgressSummaryPage', () => {
  it('sin sesiones completadas invita a entrenar en lugar de mostrar ceros', () => {
    sessions = []
    render(<ProgressSummaryPage />)
    expect(screen.getByText(/Cuando completes tu primera sesión/)).toBeInTheDocument()
    expect(screen.queryByText('Sesiones')).not.toBeInTheDocument()
  })

  it('una sesión en curso no cuenta como completada', () => {
    sessions = [{ ...makeSession('a', new Date(2026, 2, 3, 18), 100), status: 'in_progress', endedAt: null }]
    render(<ProgressSummaryPage />)
    expect(screen.getByText(/Cuando completes tu primera sesión/)).toBeInTheDocument()
  })

  it('muestra las cifras de la semana con su comparación', () => {
    sessions = [
      makeSession('esta1', new Date(2026, 2, 2, 18), 100), // lunes
      makeSession('esta2', new Date(2026, 2, 3, 18), 100), // martes
      makeSession('pasada', new Date(2026, 1, 25, 18), 90), // miércoles de la semana anterior
    ]
    render(<ProgressSummaryPage />)

    const sessionsCard = screen.getByText('Sesiones').closest('div') as HTMLElement
    expect(within(sessionsCard).getByText('2')).toBeInTheDocument()
    expect(within(sessionsCard).getByText('+1 vs la semana pasada')).toBeInTheDocument()

    // Volumen por sesión: 2 series de 100 × 5 = 1000 (el calentamiento de 20 × 10 no cuenta); dos sesiones = 2000
    const volumeCard = screen.getByText('Volumen').closest('div') as HTMLElement
    expect(within(volumeCard).getByText(/2\D?000 kg/)).toBeInTheDocument()
  })

  it('marca los días entrenados y el de hoy', () => {
    sessions = [makeSession('a', new Date(2026, 2, 2, 18), 100)] // lunes
    render(<ProgressSummaryPage />)
    const days = within(screen.getByRole('list', { name: 'Días entrenados esta semana' })).getAllByRole('listitem')
    expect(days).toHaveLength(7)
    expect(days[0]).toHaveTextContent('lunes: entrenaste')
    expect(days[1]).toHaveTextContent('martes: sin entrenar')
    expect(days[2]).toHaveTextContent('miércoles: sin entrenar (hoy)')
  })

  it('lista los músculos trabajados con sus series efectivas y el nombre correcto', () => {
    sessions = [makeSession('a', new Date(2026, 2, 2, 18), 100)]
    render(<ProgressSummaryPage />)
    expect(screen.getByText('Pectorales')).toBeInTheDocument()
    expect(screen.getByText('2 series')).toBeInTheDocument() // 3 series hechas, una de calentamiento
  })

  it('muestra los récords recientes con el nombre del ejercicio', () => {
    sessions = [makeSession('vieja', new Date(2026, 2, 2, 18), 100), makeSession('nueva', new Date(2026, 2, 3, 18), 110)]
    render(<ProgressSummaryPage />)
    const records = screen.getByText('Récords recientes').parentElement as HTMLElement
    expect(within(records).getByText('Press de banca')).toBeInTheDocument()
    expect(within(records).getByText(/116[.,]7 → 128[.,]3 kg/)).toBeInTheDocument()
  })

  it('sin récords explica cuándo aparecen', () => {
    sessions = [makeSession('a', new Date(2026, 2, 2, 18), 100)]
    render(<ProgressSummaryPage />)
    expect(screen.getByText(/Aún no hay récords/)).toBeInTheDocument()
  })
})
