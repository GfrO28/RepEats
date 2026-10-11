import { useEffect, useState } from 'react'
import { firebaseWorkoutRepository } from '@/data/firestore/workoutRepository'
import { firebaseSessionRepository } from '@/data/firestore/sessionRepository'
import type { Exercise } from '@/repositories/WorkoutRepository'
import type { Session } from '@/repositories/SessionRepository'
import { chip } from '@/app/buttonStyles'
import { getExerciseHistory, getLastPerformedDates, summarizeExercise } from '@/domain/exerciseHistory'
import { formatKg } from '@/domain/formatting'
import { formatShortLocalDate, toLocalDateString } from '@/domain/localDate'
import { formatSessionDate, formatSetGroup, summarizeSets } from '@/domain/sessionHistory'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type Metric = 'oneRepMax' | 'maxWeight' | 'volume'

const METRICS: { id: Metric; label: string; unit: string }[] = [
  { id: 'oneRepMax', label: '1RM estimado', unit: 'kg' },
  { id: 'maxWeight', label: 'Peso máximo', unit: 'kg' },
  { id: 'volume', label: 'Volumen', unit: 'kg' },
]

const RECENT_SESSIONS_SHOWN = 5

const oneDecimal = (value: number) => `${Math.round(value * 10) / 10}`

export function ExerciseProgressPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [chosenExerciseId, setChosenExerciseId] = useState('') // '' = todavía no eligió: se propone el último que hizo
  const [metric, setMetric] = useState<Metric>('oneRepMax')

  useEffect(() => {
    const unsubscribe = firebaseWorkoutRepository.subscribeExercises(setExercises)
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = firebaseSessionRepository.subscribeSessions(setSessions)
    return unsubscribe
  }, [])

  // Primero los ejercicios que ya hiciste (el más reciente arriba); el resto, por orden alfabético
  const lastDates = getLastPerformedDates(sessions)
  const withHistory = exercises
    .filter((exercise) => lastDates.has(exercise.id))
    .sort((a, b) => (lastDates.get(b.id)?.getTime() ?? 0) - (lastDates.get(a.id)?.getTime() ?? 0))
  const withoutHistory = exercises.filter((exercise) => !lastDates.has(exercise.id)).sort((a, b) => a.name.localeCompare(b.name))

  const selectedExerciseId = chosenExerciseId || withHistory[0]?.id || ''
  const history = selectedExerciseId ? getExerciseHistory(sessions, selectedExerciseId) : []
  const summary = summarizeExercise(history)

  const chartData = history.map((stat) => ({
    label: formatShortLocalDate(toLocalDateString(stat.date)),
    oneRepMax: Math.round(stat.bestOneRepMax * 10) / 10,
    maxWeight: stat.maxWeight,
    volume: Math.round(stat.volume),
  }))
  const activeMetric = METRICS.find((option) => option.id === metric) ?? METRICS[0]
  const recentSessions = [...history].reverse().slice(0, RECENT_SESSIONS_SHOWN)

  return (
    <section className="px-4 py-6">
      <h1 className="text-xl font-semibold">Progreso por ejercicio</h1>

      <select
        value={selectedExerciseId}
        onChange={(e) => setChosenExerciseId(e.target.value)}
        aria-label="Ejercicio"
        className="mt-3 w-full rounded bg-slate-800 px-3 py-2 text-sm text-slate-100"
      >
        {exercises.length === 0 && <option value="">Aún no tienes ejercicios</option>}
        {withHistory.length > 0 && (
          <optgroup label="Con registros">
            {withHistory.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </optgroup>
        )}
        {withoutHistory.length > 0 && (
          <optgroup label="Sin registros todavía">
            {withoutHistory.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {selectedExerciseId !== '' && summary === null && (
        <p className="mt-4 text-sm text-slate-400">
          Aún no hay sesiones completadas con este ejercicio. Cuando lo hagas verás aquí tu evolución.
        </p>
      )}

      {summary && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-xs text-slate-500">Mejor 1RM estimado</p>
              <p className="mt-1 text-xl font-bold">{oneDecimal(summary.bestOneRepMax.value)} kg</p>
              <p className="mt-1 text-xs text-slate-400">{formatSessionDate(summary.bestOneRepMax.date)}</p>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-xs text-slate-500">Peso máximo</p>
              <p className="mt-1 text-xl font-bold">{summary.maxWeight.value} kg</p>
              <p className="mt-1 text-xs text-slate-400">{formatSessionDate(summary.maxWeight.date)}</p>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-xs text-slate-500">Sesiones</p>
              <p className="mt-1 text-xl font-bold">{summary.sessionCount}</p>
              <p className="mt-1 text-xs text-slate-400">Última: {formatSessionDate(summary.last.date)}</p>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-xs text-slate-500">Desde la primera sesión</p>
              {summary.sessionCount < 2 ? (
                <p className="mt-1 text-sm text-slate-400">Con dos sesiones verás tu cambio.</p>
              ) : (
                <>
                  <p className="mt-1 text-xl font-bold">
                    {summary.oneRepMaxChange.kg > 0 ? '+' : summary.oneRepMaxChange.kg < 0 ? '−' : ''}
                    {oneDecimal(Math.abs(summary.oneRepMaxChange.kg))} kg
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    en el 1RM estimado
                    {summary.oneRepMaxChange.percent !== null && ` (${oneDecimal(summary.oneRepMaxChange.percent)} %)`}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Qué mostrar en la gráfica">
              {METRICS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={metric === option.id}
                  onClick={() => setMetric(option.id)}
                  className={chip(metric === option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mt-2">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="var(--slate-700)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--slate-500)', fontSize: 11 }} stroke="var(--slate-700)" minTickGap={24} />
                  <YAxis
                    domain={([min, max]) => [Math.max(Math.floor(min * 0.9), 0), Math.ceil(max * 1.05)]}
                    tick={{ fill: 'var(--slate-500)', fontSize: 11 }}
                    stroke="var(--slate-700)"
                  />
                  <Tooltip
                    contentStyle={{ background: 'var(--slate-900)', border: '1px solid var(--slate-700)', borderRadius: 8 }}
                    labelStyle={{ color: 'var(--slate-400)' }}
                    formatter={(value) => [`${value} ${activeMetric?.unit ?? ''}`, activeMetric?.label ?? '']}
                  />
                  <Line
                    type="monotone"
                    dataKey={metric}
                    name={activeMetric?.label}
                    stroke="var(--primary)"
                    strokeWidth={3}
                    dot={{ r: 3, fill: 'var(--primary)', stroke: 'none' }}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-500">
              {metric === 'oneRepMax' && 'Fuerza estimada con la fórmula de Epley: peso × (1 + repeticiones / 30).'}
              {metric === 'maxWeight' && 'El peso más alto que levantaste en cada sesión.'}
              {metric === 'volume' && 'Peso × repeticiones de todas las series, sin el calentamiento.'}
            </p>
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-semibold">Últimas sesiones</h2>
            {recentSessions.map((stat) => (
              <div key={stat.sessionId} className="border-b border-slate-800 py-2">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium">{formatSessionDate(stat.date)}</p>
                  <p className="text-xs text-slate-500">{formatKg(stat.volume)}</p>
                </div>
                <ul className="mt-1 text-sm text-slate-400">
                  {summarizeSets(stat.sets).map((group, index) => (
                    <li key={index}>{formatSetGroup(group)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
