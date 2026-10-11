import { useEffect, useState } from 'react'
import { firebaseSessionRepository } from '@/data/firestore/sessionRepository'
import type { Session } from '@/repositories/SessionRepository'
import { ExerciseLibraryPage } from './ExerciseLibraryPage'
import { RoutineLibraryPage } from './RoutineLibraryPage'
import { LiveSessionPage } from './LiveSessionPage'
import { TabBar } from '@/app/TabBar'

type TrainingTab = 'rutinas' | 'ejercicios'

const TABS: { id: TrainingTab; label: string }[] = [
  { id: 'rutinas', label: 'Rutinas' },
  { id: 'ejercicios', label: 'Ejercicios' },
]

export function TrainingPage() {
  const [tab, setTab] = useState<TrainingTab>('rutinas')
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => {
    const unsubscribe = firebaseSessionRepository.subscribeSessions(setSessions)

    return unsubscribe
  }, [])

  const activeSession = sessions.find((session) => session.status === 'in_progress')

  if (activeSession) {
    return <LiveSessionPage session={activeSession} />
  }

  return (
    <div>
      <TabBar label="Secciones de Entrenar" tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'ejercicios' ? <ExerciseLibraryPage /> : <RoutineLibraryPage />}
    </div>
  )
}
