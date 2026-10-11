import { useEffect, useState } from 'react'
import Model from 'react-body-highlighter'
import { CartesianGrid, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { firebaseSessionRepository } from '@/data/firestore/sessionRepository'
import { firebaseWorkoutRepository } from '@/data/firestore/workoutRepository'
import type { Session } from '@/repositories/SessionRepository'
import type { Exercise } from '@/repositories/WorkoutRepository'
import { buildIntensityBodyData, INTENSITY_LEVELS } from '@/domain/bodyHighlighterMapping'
import { formatHoursMinutes } from '@/domain/duration'
import { formatKg } from '@/domain/formatting'
import { DAYS_OF_WEEK, DAY_ABBREVIATIONS } from '@/domain/daysOfWeek'
import { formatShortLocalDate, toLocalDateString } from '@/domain/localDate'
import type { MuscleGroupName } from '@/domain/muscleGroups'
import {
  collectRecords,
  compareWeeks,
  countRecordsInWeek,
  findRecentRecords,
  getWeeklyHistory,
  SUMMARY_WEEKS,
} from '@/domain/progressSummary'
import { calculateWeeklyVolumeByMuscleGroup } from '@/domain/weeklyVolume'
import { getCurrentWeekRange } from '@/domain/weekRange'

const RECENT_RECORDS_LIMIT = 5

// De menos a más series: la región se mezcla con el color del cuerpo en proporciones crecientes del color de acción
const HEAT_COLORS = [30, 50, 75, 100].map((percent) => `color-mix(in srgb, var(--primary) ${percent}%, var(--slate-700))`)

// "+2", "−1,5 kg" ... en tono neutral: subir o bajar no es bueno ni malo por sí solo
function formatDifference(difference: number, format: (absolute: number) => string): string {
  if (difference === 0) return 'Igual que la semana pasada'
  return `${difference > 0 ? '+' : '−'}${format(Math.abs(difference))} vs la semana pasada`
}

function KpiCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl bg-slate-800 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{note}</p>
    </div>
  )
}

const chartAxis = { fill: 'var(--slate-500)', fontSize: 11 }
const tooltipStyle = { background: 'var(--slate-900)', border: '1px solid var(--slate-700)', borderRadius: 8 }

export function ProgressSummaryPage() {
  const [sessions, setSessions] = useState<Session[] | null>(null) // null = cargando
  const [exercises, setExercises] = useState<Exercise[]>([])

  useEffect(() => {
    const unsubscribe = firebaseSessionRepository.subscribeSessions(setSessions)
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = firebaseWorkoutRepository.subscribeExercises(setExercises)
    return unsubscribe
  }, [])

  if (sessions === null) return <p className="px-4 py-6 text-sm text-slate-400">Cargando…</p>

  const now = new Date()
  const hasCompletedSessions = sessions.some((session) => session.status === 'completed')

  if (!hasCompletedSessions) {
    return (
      <section className="px-4 py-6">
        <h1 className="text-xl font-semibold">Resumen</h1>
        <p className="mt-3 text-sm text-slate-400">
          Cuando completes tu primera sesión de entrenamiento verás aquí tu semana, tu constancia, tus récords y qué
          músculos has trabajado.
        </p>
      </section>
    )
  }

  const history = getWeeklyHistory(sessions, now)
  const thisWeek = history[SUMMARY_WEEKS - 1]
  const lastWeek = history[SUMMARY_WEEKS - 2]
  if (!thisWeek || !lastWeek) return null

  const change = compareWeeks(thisWeek, lastWeek)
  const records = collectRecords(sessions)
  const recordsThisWeek = countRecordsInWeek(records, now)
  const recordsLastWeek = countRecordsInWeek(records, lastWeek.weekStart)
  const recentRecords = findRecentRecords(records, RECENT_RECORDS_LIMIT)

  const { start, end } = getCurrentWeekRange(now)
  const setsByGroup = calculateWeeklyVolumeByMuscleGroup(sessions, exercises, start, end)
  const groupRows = (Object.entries(setsByGroup) as [MuscleGroupName, number][]).sort((a, b) => b[1] - a[1])
  const maxSets = groupRows[0]?.[1] ?? 1
  const bodyData = buildIntensityBodyData(setsByGroup)

  const todayIndex = (now.getDay() + 6) % 7
  const chartData = history.map((week) => ({
    label: formatShortLocalDate(toLocalDateString(week.weekStart)),
    sesiones: week.sessionCount,
    volumen: Math.round(week.volumeKg),
  }))
  const exerciseName = (exerciseId: string) => exercises.find((e) => e.id === exerciseId)?.name ?? 'Ejercicio eliminado'

  return (
    <section className="px-4 py-6">
      <h1 className="text-xl font-semibold">Resumen</h1>
      <p className="text-sm text-slate-400">
        Esta semana: {formatShortLocalDate(toLocalDateString(start))} al {formatShortLocalDate(toLocalDateString(end))}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <KpiCard
          label="Sesiones"
          value={String(thisWeek.sessionCount)}
          note={formatDifference(change.sessionCount, (n) => String(n))}
        />
        <KpiCard
          label="Volumen"
          value={formatKg(thisWeek.volumeKg)}
          note={formatDifference(change.volumeKg, formatKg)}
        />
        <KpiCard
          label="Tiempo entrenando"
          value={formatHoursMinutes(thisWeek.durationSeconds)}
          note={formatDifference(change.durationSeconds, formatHoursMinutes)}
        />
        <KpiCard
          label="Récords nuevos"
          value={String(recordsThisWeek)}
          note={formatDifference(recordsThisWeek - recordsLastWeek, (n) => String(n))}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">El volumen no incluye las series de calentamiento.</p>

      <div className="mt-6">
        <h2 className="text-sm font-semibold">Días que entrenaste</h2>
        <ul className="mt-2 flex justify-between" aria-label="Días entrenados esta semana">
          {DAYS_OF_WEEK.map((day, index) => {
            const trained = thisWeek.trainedDays[index]
            return (
              <li key={day} className="flex flex-col items-center gap-1 text-xs text-slate-400">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${
                    trained ? 'bg-primary font-semibold text-slate-950' : 'bg-slate-800 text-slate-500'
                  } ${index === todayIndex ? 'ring-2 ring-primary ring-offset-2 ring-offset-slate-950' : ''}`}
                >
                  <span aria-hidden="true">{trained ? '✓' : ''}</span>
                  <span className="sr-only">
                    {day.toLowerCase()}: {trained ? 'entrenaste' : 'sin entrenar'}
                    {index === todayIndex ? ' (hoy)' : ''}
                  </span>
                </span>
                <span aria-hidden="true">{DAY_ABBREVIATIONS[day]}</span>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold">Sesiones por semana</h2>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="var(--slate-700)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={chartAxis} stroke="var(--slate-700)" />
            <YAxis allowDecimals={false} tick={chartAxis} stroke="var(--slate-700)" />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--slate-400)' }} cursor={{ fill: 'var(--slate-800)' }} />
            <Bar dataKey="sesiones" name="Sesiones" fill="var(--primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold">Volumen por semana (kg)</h2>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--slate-700)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={chartAxis} stroke="var(--slate-700)" />
            <YAxis tick={chartAxis} stroke="var(--slate-700)" />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--slate-400)' }} cursor={{ fill: 'var(--slate-800)' }} />
            <Bar dataKey="volumen" name="Volumen (kg)" fill="var(--primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-slate-500">Cada barra es una semana (de lunes a domingo); el número es el lunes de esa semana.</p>
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold">Músculos trabajados esta semana</h2>
        {groupRows.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Aún no hay series efectivas esta semana.</p>
        ) : (
          <>
            {/* El dibujo es un apoyo visual: la lista de abajo tiene la misma información en texto */}
            <div className="mt-2 grid grid-cols-2 gap-2 rbh-static" aria-hidden="true">
              {(['anterior', 'posterior'] as const).map((view) => (
                <Model
                  key={view}
                  type={view}
                  data={bodyData}
                  highlightedColors={HEAT_COLORS}
                  bodyColor="var(--slate-700)"
                  style={{ width: '100%', maxWidth: 140, aspectRatio: '1 / 2', margin: '0 auto' }}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-500" aria-hidden="true">
              <span>Menos series</span>
              {HEAT_COLORS.slice(0, INTENSITY_LEVELS).map((color) => (
                <span key={color} className="h-3 w-6 rounded" style={{ background: color }} />
              ))}
              <span>Más</span>
            </div>
            <ul className="mt-3">
              {groupRows.map(([group, setCount]) => (
                <li key={group} className="py-1">
                  <div className="flex justify-between text-sm">
                    <span>{group}</span>
                    <span className="text-slate-400">
                      {setCount} {setCount === 1 ? 'serie' : 'series'}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-800" aria-hidden="true">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.round((setCount / maxSets) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              Series efectivas por grupo muscular (sin calentamiento). Como referencia, de 10 a 15 series por semana por
              músculo suele ser una zona de trabajo habitual.
            </p>
          </>
        )}
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold">Récords recientes</h2>
        {recentRecords.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">
            Aún no hay récords. Aparecen cuando superas tu mejor 1RM estimado en un ejercicio que ya habías hecho.
          </p>
        ) : (
          <ul className="mt-1">
            {recentRecords.map((record) => (
              <li key={`${record.exerciseId}-${record.date.getTime()}`} className="flex items-center justify-between border-b border-slate-800 py-2">
                <div>
                  <p className="text-sm font-medium">{exerciseName(record.exerciseId)}</p>
                  <p className="text-xs text-slate-500">{formatShortLocalDate(toLocalDateString(record.date))}</p>
                </div>
                <p className="text-sm text-slate-300">
                  {record.previousBest.toFixed(1)} → {record.newBest.toFixed(1)} kg
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-slate-500">1RM estimado con la fórmula de Epley.</p>
      </div>
    </section>
  )
}
