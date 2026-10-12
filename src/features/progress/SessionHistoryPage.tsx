import { useEffect, useId, useState } from 'react'
import { firebaseProfileRepository } from '@/data/firestore/profileRepository'
import { firebaseRoutineRepository } from '@/data/firestore/routineRepository'
import { firebaseSessionRepository } from '@/data/firestore/sessionRepository'
import { firebaseWorkoutRepository } from '@/data/firestore/workoutRepository'
import type { Profile } from '@/repositories/ProfileRepository'
import type { Routine } from '@/repositories/RoutineRepository'
import type { Session } from '@/repositories/SessionRepository'
import type { Exercise } from '@/repositories/WorkoutRepository'
import { SwipeToDeleteRow } from '@/app/SwipeToDeleteRow'
import { iconButton } from '@/app/buttonStyles'
import { formatHoursMinutes } from '@/domain/duration'
import { estimateSessionKcal } from '@/domain/exerciseCalories'
import { formatKg } from '@/domain/formatting'
import { collectRecords, getSessionDate, type RecordEvent } from '@/domain/progressSummary'
import {
  countEffectiveSets,
  countPerformedExercises,
  formatSessionDate,
  formatSetGroup,
  getSessionDurationSeconds,
  groupSessionsByMonth,
  summarizeSets,
} from '@/domain/sessionHistory'
import { getSupersetPartnerIndex } from '@/domain/superset'
import { calculateSessionVolume } from '@/domain/volume'

interface SessionCardProps {
  session: Session
  routineName: string
  exerciseName: (exerciseId: string) => string
  records: RecordEvent[] // los récords logrados en esta sesión
  bodyWeightKg: number | null // para estimar las kcal; null si aún no hay perfil
  isSwipeOpen: boolean // deslizada para mostrar "Eliminar"; controlado por la página (una sola fila a la vez)
  onSwipeOpenChange: (open: boolean) => void
}

function SessionCard({
  session,
  routineName,
  exerciseName,
  records,
  bodyWeightKg,
  isSwipeOpen,
  onSwipeOpenChange,
}: SessionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditingKcal, setIsEditingKcal] = useState(false)
  const [kcalText, setKcalText] = useState('')
  const detailsId = useId()
  const kcalFieldId = useId()
  const dateText = formatSessionDate(getSessionDate(session))
  const performedExercises = session.exercises.filter((exercise) => exercise.sets.length > 0)
  const exerciseCount = countPerformedExercises(session)
  const setCount = countEffectiveSets(session)
  const estimatedKcal = bodyWeightKg === null ? 0 : estimateSessionKcal(session, bodyWeightKg)
  const resolvedKcal = session.manualExerciseKcal ?? estimatedKcal

  function startEditingKcal() {
    setKcalText(resolvedKcal > 0 ? String(resolvedKcal) : '')
    setIsEditingKcal(true)
  }

  function confirmKcal() {
    const parsed = Number(kcalText)
    // igual a la estimación o vacío: vuelve a lo automático, para que recalcule solo si cambia el peso del perfil
    const manualExerciseKcal =
      kcalText.trim() !== '' && Number.isFinite(parsed) && Math.round(parsed) !== estimatedKcal ? Math.round(parsed) : null
    firebaseSessionRepository.updateSession({ ...session, manualExerciseKcal })
    setIsEditingKcal(false)
  }

  function handleDelete() {
    if (
      window.confirm(
        `¿Eliminar la sesión del ${dateText}? También desaparece de tus estadísticas y récords. No se puede deshacer.`,
      )
    ) {
      firebaseSessionRepository.deleteSession(session.id)
    }
  }

  return (
    <SwipeToDeleteRow
      isOpen={isSwipeOpen}
      onOpenChange={onSwipeOpenChange}
      onDelete={handleDelete}
      deleteLabel={`Eliminar la sesión del ${dateText}`}
      showBorder={false}
      className="mt-3 rounded-xl"
    >
      <article className="rounded-xl bg-slate-800">
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={detailsId}
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex min-h-11 w-full items-start justify-between gap-3 p-3 text-left"
        >
          <div>
            <p className="font-semibold">{dateText}</p>
            <p className="text-sm text-slate-400">{routineName}</p>
            <p className="mt-1 text-xs text-slate-500">
              {exerciseCount} {exerciseCount === 1 ? 'ejercicio' : 'ejercicios'} · {setCount} {setCount === 1 ? 'serie' : 'series'}
            </p>
            {records.length > 0 && (
              <p className="mt-1 text-xs font-medium text-primary">
                🏆 {records.length} {records.length === 1 ? 'récord' : 'récords'}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{formatHoursMinutes(getSessionDurationSeconds(session))}</p>
            <p className="text-xs text-slate-400">{formatKg(calculateSessionVolume(session))}</p>
            <span aria-hidden="true" className="text-xs text-slate-500">
              {isExpanded ? '▲' : '▼'}
            </span>
          </div>
        </button>

        {isExpanded && (
          <div id={detailsId} className="border-t border-slate-700 p-3">
            {performedExercises.length === 0 && <p className="text-sm text-slate-400">Esta sesión no tiene series registradas.</p>}
            {performedExercises.map((sessionExercise) => {
              const record = records.find((event) => event.exerciseId === sessionExercise.exerciseId)
              // Se busca en toda la lista de la sesión (no solo en los realizados): la pareja pudo quedar sin series
              const partnerIndex = getSupersetPartnerIndex(session.exercises, session.exercises.indexOf(sessionExercise))
              const partner = partnerIndex === null ? undefined : session.exercises[partnerIndex]
              return (
                <div key={sessionExercise.exerciseId} className="py-2">
                  <p className="text-sm font-medium">{exerciseName(sessionExercise.exerciseId)}</p>
                  {partner && <p className="text-xs text-violet-400">Superset con {exerciseName(partner.exerciseId)}</p>}
                  <ul className="mt-1 text-sm text-slate-400">
                    {summarizeSets(sessionExercise.sets).map((group, index) => (
                      <li key={index}>{formatSetGroup(group)}</li>
                    ))}
                  </ul>
                  {record && (
                    <p className="mt-1 text-xs font-medium text-primary">
                      🏆 Récord: 1RM estimado {record.previousBest.toFixed(1)} → {record.newBest.toFixed(1)} kg
                    </p>
                  )}
                  {sessionExercise.notes.trim() !== '' && (
                    <p className="mt-1 text-xs text-slate-500">Nota: {sessionExercise.notes}</p>
                  )}
                </div>
              )
            })}
            {isEditingKcal ? (
              <div className="mt-2 flex items-center gap-2">
                <label htmlFor={kcalFieldId} className="text-xs text-slate-400">Kcal quemadas</label>
                <input
                  id={kcalFieldId}
                  type="number"
                  inputMode="numeric"
                  value={kcalText}
                  onChange={(e) => setKcalText(e.target.value)}
                  className="w-20 rounded bg-slate-700 px-2 py-1 text-center text-sm"
                  autoFocus
                />
                <button type="button" onClick={confirmKcal} aria-label="Confirmar kcal quemadas" className={iconButton}>
                  ✓
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingKcal(false)}
                  aria-label="Cancelar edición de kcal quemadas"
                  className={iconButton}
                >
                  ✕
                </button>
              </div>
            ) : (
              <p className="mt-1 flex items-center justify-between text-xs text-slate-400">
                <span>
                  {resolvedKcal > 0
                    ? `${session.manualExerciseKcal !== null ? 'Kcal quemadas' : 'Gasto estimado'}: unas ${resolvedKcal} kcal (solo informativo).`
                    : 'Sin dato de kcal quemadas.'}
                </span>
                <button type="button" onClick={startEditingKcal} aria-label="Corregir kcal quemadas" className={iconButton}>
                  ✏️
                </button>
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">El volumen y las series no incluyen el calentamiento.</p>
            <p className="mt-2 text-xs text-slate-500">Desliza la sesión hacia la izquierda para eliminarla.</p>
          </div>
        )}
      </article>
    </SwipeToDeleteRow>
  )
}

export function SessionHistoryPage() {
  const [sessions, setSessions] = useState<Session[] | null>(null) // null = cargando
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null) // solo una sesión deslizada a la vez

  useEffect(() => {
    const unsubscribe = firebaseSessionRepository.subscribeSessions(setSessions)
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = firebaseWorkoutRepository.subscribeExercises(setExercises)
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = firebaseRoutineRepository.subscribeRoutines(setRoutines)
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = firebaseProfileRepository.subscribeProfile(setProfile)
    return unsubscribe
  }, [])

  if (sessions === null) return <p className="px-4 py-6 text-sm text-slate-400">Cargando…</p>

  const months = groupSessionsByMonth(sessions)
  const sessionCount = months.reduce((total, month) => total + month.sessions.length, 0)

  // Los récords se calculan con todo el historial y se reparten por sesión
  const recordsBySession = new Map<string, RecordEvent[]>()
  for (const record of collectRecords(sessions)) {
    recordsBySession.set(record.sessionId, [...(recordsBySession.get(record.sessionId) ?? []), record])
  }

  const exerciseName = (exerciseId: string) => exercises.find((e) => e.id === exerciseId)?.name ?? 'Ejercicio eliminado'
  const routineName = (session: Session) => {
    if (session.routineId === null) return 'Sesión libre'
    return routines.find((r) => r.id === session.routineId)?.name ?? 'Rutina eliminada'
  }

  return (
    <section className="px-4 py-6">
      <h1 className="text-xl font-semibold">
        Historial
        {sessionCount > 0 && <span className="ml-2 text-sm font-normal text-slate-500">({sessionCount})</span>}
      </h1>

      {sessionCount === 0 && (
        <p className="mt-3 text-sm text-slate-400">
          Aún no tienes sesiones completadas. Cuando termines una, aparecerá aquí con sus series y sus récords.
        </p>
      )}

      {months.map((month) => (
        <div key={month.monthKey} className="mt-5">
          <h2 className="text-xs uppercase text-slate-500">
            {month.label} · {month.sessions.length} {month.sessions.length === 1 ? 'sesión' : 'sesiones'}
          </h2>
          {month.sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              routineName={routineName(session)}
              exerciseName={exerciseName}
              records={recordsBySession.get(session.id) ?? []}
              bodyWeightKg={profile?.weightKg ?? null}
              isSwipeOpen={openSwipeId === session.id}
              onSwipeOpenChange={(open) => setOpenSwipeId(open ? session.id : null)}
            />
          ))}
        </div>
      ))}
    </section>
  )
}
