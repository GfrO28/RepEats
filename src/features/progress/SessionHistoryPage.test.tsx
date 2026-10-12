import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Profile } from '@/repositories/ProfileRepository'
import type { Routine } from '@/repositories/RoutineRepository'
import type { Session } from '@/repositories/SessionRepository'
import type { Exercise } from '@/repositories/WorkoutRepository'
import { SessionHistoryPage } from './SessionHistoryPage'

let sessions: Session[] = []
let profile: Profile | null = null
const deleteSession = vi.fn()

const exercises: Exercise[] = [
  { id: 'press', name: 'Press de banca', primaryMuscles: ['pectoral_medio'], secondaryMuscles: [], equipment: 'Barra', notes: '' },
  { id: 'dominadas', name: 'Dominadas', primaryMuscles: ['dorsal_ancho'], secondaryMuscles: [], equipment: 'Peso corporal', notes: '' },
]
const routines: Routine[] = [{ id: 'r1', name: 'Empuje', suggestedDay: 'Lunes', suggestedTime: null, exercises: [], order: 0 }]

vi.mock('@/data/firestore/sessionRepository', () => ({
  firebaseSessionRepository: {
    subscribeSessions: (onChange: (data: Session[]) => void) => {
      onChange(sessions)
      return () => {}
    },
    deleteSession: (id: string) => deleteSession(id),
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
vi.mock('@/data/firestore/profileRepository', () => ({
  firebaseProfileRepository: {
    subscribeProfile: (onChange: (data: Profile | null) => void) => {
      onChange(profile)
      return () => {}
    },
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

function makeSession(id: string, endedAt: Date, weight: number, extra: Partial<Session> = {}): Session {
  return {
    id,
    routineId: 'r1',
    startedAt: new Date(endedAt.getTime() - 65 * 60_000),
    endedAt,
    status: 'completed',
    exercises: [
      {
        exerciseId: 'press',
        notes: 'Con pausa',
        sets: [
          { type: 'Calentamiento', weight: 20, reps: 12, completedAt: endedAt },
          { type: 'Normal', weight, reps: 8, completedAt: endedAt },
          { type: 'Normal', weight, reps: 8, completedAt: endedAt },
          { type: 'Normal', weight, reps: 6, completedAt: endedAt },
        ],
      },
      { exerciseId: 'dominadas', notes: '', sets: [] }, // saltado
    ],
    manualExerciseKcal: null,
    ...extra,
  }
}

beforeEach(() => deleteSession.mockClear())
afterEach(() => {
  sessions = []
  profile = null
  vi.restoreAllMocks()
})

describe('SessionHistoryPage', () => {
  it('sin sesiones completadas explica qué aparecerá aquí', () => {
    render(<SessionHistoryPage />)
    expect(screen.getByText(/Aún no tienes sesiones completadas/)).toBeInTheDocument()
  })

  it('agrupa por mes, con la más reciente primero, y resume cada sesión', () => {
    sessions = [makeSession('feb', new Date(2026, 1, 10, 19), 60), makeSession('mar', new Date(2026, 2, 4, 19), 60)]
    render(<SessionHistoryPage />)

    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    expect(headings).toEqual(['Marzo 2026 · 1 sesión', 'Febrero 2026 · 1 sesión'])

    const first = screen.getAllByRole('article')[0] as HTMLElement
    expect(within(first).getByText('mié 4 mar')).toBeInTheDocument()
    expect(within(first).getByText('Empuje')).toBeInTheDocument()
    expect(within(first).getByText('1 h 5 min')).toBeInTheDocument()
    // 1 ejercicio hecho (el otro quedó sin series) y 3 series efectivas (el calentamiento no cuenta)
    expect(within(first).getByText('1 ejercicio · 3 series')).toBeInTheDocument()
    // 60 × 8 + 60 × 8 + 60 × 6 = 1320 kg
    expect(within(first).getByText(/1\D?320 kg/)).toBeInTheDocument()
  })

  it('las sesiones vienen cerradas y al tocarlas muestran las series agrupadas', async () => {
    sessions = [makeSession('a', new Date(2026, 2, 4, 19), 60)]
    render(<SessionHistoryPage />)
    expect(screen.queryByText('2 × 8 @ 60 kg')).not.toBeInTheDocument()

    const toggle = screen.getByRole('button', { expanded: false })
    await userEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Press de banca')).toBeInTheDocument()
    expect(screen.getByText('Calentamiento: 1 × 12 @ 20 kg')).toBeInTheDocument()
    expect(screen.getByText('2 × 8 @ 60 kg')).toBeInTheDocument() // dos series iguales se juntan
    expect(screen.getByText('1 × 6 @ 60 kg')).toBeInTheDocument()
    expect(screen.getByText('Nota: Con pausa')).toBeInTheDocument()
    expect(screen.queryByText('Dominadas')).not.toBeInTheDocument() // el ejercicio sin series no se lista
  })

  it('indica con qué ejercicio se hizo en superset, y no marca a los sueltos', async () => {
    const endedAt = new Date(2026, 2, 4, 19)
    const set = { type: 'Normal', weight: 60, reps: 8, completedAt: endedAt } as const
    sessions = [
      makeSession('ss', endedAt, 60, {
        exercises: [
          { exerciseId: 'press', notes: '', sets: [set], supersetGroup: 'ss1' },
          { exerciseId: 'dominadas', notes: '', sets: [set], supersetGroup: 'ss1' },
        ],
      }),
    ]
    render(<SessionHistoryPage />)
    await userEvent.click(screen.getByRole('button', { expanded: false }))

    expect(screen.getByText('Superset con Dominadas')).toBeInTheDocument()
    expect(screen.getByText('Superset con Press de banca')).toBeInTheDocument()
  })

  it('un superset cuya pareja quedó sin series igual se indica', async () => {
    const endedAt = new Date(2026, 2, 4, 19)
    sessions = [
      makeSession('ss', endedAt, 60, {
        exercises: [
          { exerciseId: 'press', notes: '', sets: [{ type: 'Normal', weight: 60, reps: 8, completedAt: endedAt }], supersetGroup: 'ss1' },
          { exerciseId: 'dominadas', notes: '', sets: [], supersetGroup: 'ss1' },
        ],
      }),
    ]
    render(<SessionHistoryPage />)
    await userEvent.click(screen.getByRole('button', { expanded: false }))

    expect(screen.getByText('Superset con Dominadas')).toBeInTheDocument()
    expect(screen.queryByText('Superset con Press de banca')).not.toBeInTheDocument() // Dominadas no se lista: sin series
  })

  it('sin superset no aparece ninguna marca', async () => {
    sessions = [makeSession('a', new Date(2026, 2, 4, 19), 60)]
    render(<SessionHistoryPage />)
    await userEvent.click(screen.getByRole('button', { expanded: false }))
    expect(screen.queryByText(/Superset con/)).not.toBeInTheDocument()
  })

  it('marca la sesión donde se logró un récord', async () => {
    sessions = [makeSession('vieja', new Date(2026, 2, 2, 19), 60), makeSession('nueva', new Date(2026, 2, 4, 19), 70)]
    render(<SessionHistoryPage />)

    const [newest, oldest] = screen.getAllByRole('article') as [HTMLElement, HTMLElement]
    expect(within(newest).getByText('🏆 1 récord')).toBeInTheDocument()
    expect(within(oldest).queryByText(/récord/)).not.toBeInTheDocument() // la primera vez no cuenta

    await userEvent.click(within(newest).getByRole('button', { expanded: false }))
    expect(within(newest).getByText(/Récord: 1RM estimado/)).toBeInTheDocument()
  })

  it('una sesión libre o de una rutina eliminada lo indica', () => {
    sessions = [
      makeSession('libre', new Date(2026, 2, 4, 19), 60, { routineId: null }),
      makeSession('borrada', new Date(2026, 2, 3, 19), 60, { routineId: 'ya-no-existe' }),
    ]
    render(<SessionHistoryPage />)
    expect(screen.getByText('Sesión libre')).toBeInTheDocument()
    expect(screen.getByText('Rutina eliminada')).toBeInTheDocument()
  })

  it('el botón que revela el deslizar pide confirmación y solo borra si se acepta (sin necesidad de expandir)', async () => {
    sessions = [makeSession('a', new Date(2026, 2, 4, 19), 60)]
    render(<SessionHistoryPage />)

    const deleteButton = screen.getByRole('button', { name: 'Eliminar la sesión del mié 4 mar' })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await userEvent.click(deleteButton)
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('mié 4 mar'))
    expect(deleteSession).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    await userEvent.click(deleteButton)
    expect(deleteSession).toHaveBeenCalledWith('a')
  })

  it('con perfil, el detalle estima el gasto de la sesión; sin perfil no muestra nada', async () => {
    sessions = [makeSession('a', new Date(2026, 2, 4, 19), 60)] // 65 minutos

    const { unmount } = render(<SessionHistoryPage />)
    await userEvent.click(screen.getByRole('button', { expanded: false }))
    expect(screen.queryByText(/Gasto estimado/)).not.toBeInTheDocument()
    unmount()

    profile = {
      sex: 'male',
      weightKg: 72,
      heightCm: 164,
      ageYears: 34,
      activityLevel: 'moderate',
      optionalMeals: [],
      adaptiveTdee: null,
    }
    render(<SessionHistoryPage />)
    await userEvent.click(screen.getByRole('button', { expanded: false }))
    // 3.5 × 72 kg × (65 / 60) h = 273 kcal
    expect(screen.getByText('Gasto estimado: unas 273 kcal (solo informativo).')).toBeInTheDocument()
  })
})
