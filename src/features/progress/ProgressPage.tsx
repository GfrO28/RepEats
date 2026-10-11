import { useState } from 'react'
import { SessionHistoryPage } from './SessionHistoryPage'
import { ExerciseProgressPage } from './ExerciseProgressPage'
import { WeeklyVolumePage } from './WeeklyVolumePage'
import { ProgressSummaryPage } from './ProgressSummaryPage'
import { TabBar } from '@/app/TabBar'

type ProgressTab = 'resumen' | 'historial' | 'ejercicio' | 'volumen'

const TABS: { id: ProgressTab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'historial', label: 'Historial' },
  { id: 'ejercicio', label: 'Ejercicios' },
  { id: 'volumen', label: 'Volumen' },
]

export function ProgressPage() {
  const [tab, setTab] = useState<ProgressTab>('resumen')

  return (
    <div>
      <TabBar label="Secciones de Progreso" tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'resumen' && <ProgressSummaryPage />}
      {tab === 'historial' && <SessionHistoryPage />}
      {tab === 'ejercicio' && <ExerciseProgressPage />}
      {tab === 'volumen' && <WeeklyVolumePage />}
    </div>
  )
}
