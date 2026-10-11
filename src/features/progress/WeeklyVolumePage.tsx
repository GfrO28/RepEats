import { useEffect, useState } from 'react'
import { firebaseWorkoutRepository } from '@/data/firestore/workoutRepository'
import { firebaseSessionRepository } from '@/data/firestore/sessionRepository'
import type { Exercise } from '@/repositories/WorkoutRepository'
import type { Session } from '@/repositories/SessionRepository'
import { calculateWeeklyVolumeByMuscleGroup } from '@/domain/weeklyVolume'
import { getCurrentWeekRange } from '@/domain/weekRange'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

export function WeeklyVolumePage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => {
    const unsubscribe = firebaseWorkoutRepository.subscribeExercises(setExercises)
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = firebaseSessionRepository.subscribeSessions(setSessions)
    return unsubscribe
  }, [])

  const { start, end } = getCurrentWeekRange()
  const volumeByGroup = calculateWeeklyVolumeByMuscleGroup(sessions, exercises, start, end)

  const chartData = Object.entries(volumeByGroup).map(([group, setCount]) => ({
    group,
    setCount,
  }))

  return (
    <section className="px-4 py-6">
      <h1 className="text-xl font-semibold">Volumen semanal por grupo muscular</h1>
      <p className="text-sm text-slate-400">
        Semana del {start.toLocaleDateString('es-PE')} al {end.toLocaleDateString('es-PE')}
      </p>

      {chartData.length === 0 && <p className="mt-4">Sin series registradas esta semana</p>}

      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="group" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="setCount" fill="#059669" name="Series" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  )
}
