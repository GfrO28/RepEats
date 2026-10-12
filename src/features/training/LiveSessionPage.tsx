import { useEffect, useId, useRef, useState } from 'react'
import { firebaseWorkoutRepository } from '@/data/firestore/workoutRepository'
import { firebaseSessionRepository } from '@/data/firestore/sessionRepository'
import { firebaseRoutineRepository } from '@/data/firestore/routineRepository'
import { firebaseProfileRepository } from '@/data/firestore/profileRepository'
import type { Exercise } from '@/repositories/WorkoutRepository'
import type { Profile } from '@/repositories/ProfileRepository'
import type { Session, CompletedSet, DropSet } from '@/repositories/SessionRepository'
import type { Routine, TargetSet } from '@/repositories/RoutineRepository'
import { SET_TYPES, type SetTypes } from '@/domain/setTypes'
import { Modal } from '@/app/Modal'
import { NumberField } from '@/app/NumberField'
import { SetBadge, SetTypeChip } from './SetBadge'
import { DropSetBlock, type DropDraft } from './DropSetBlock'
import { DEFAULT_DROP_COUNT, countPendingDrops, formatDropChain, suggestDrop } from '@/domain/dropSet'
import { useElapsedSeconds } from './useElapsedSeconds'
import { useRemainingSeconds } from './useRemainingSeconds'
import { KEEP_AWAKE_KEY, REST_SOUND_KEY, readBooleanPreference } from '@/app/devicePreferences'
import { playRestEndSound, unlockAudio } from '@/app/restSound'
import { useWakeLock } from '@/app/useWakeLock'
import { getRestBannerHideDelayMs, shouldAlertRestEnd } from '@/domain/restAlert'
import { shouldIgnoreCompletion } from '@/domain/setCompletion'
import { formatDuration } from '@/domain/duration'
import { estimateExerciseKcal } from '@/domain/exerciseCalories'
import { findPreviousSetForType, getExerciseHistory } from '@/domain/exerciseHistory'
import { kgToLb, lbToKg, type WeightUnit } from '@/domain/weightUnit'
import { calculateSessionVolume } from '@/domain/volume'
import { findNewRecords } from '@/domain/personalRecords'
import { calculateRestProgress } from '@/domain/restProgress'
import { dangerButton, linkButton, primaryButton, secondaryButtonOnCard } from '@/app/buttonStyles'

interface RowDraft {
  exerciseId: string
  rowIndex: number
  type: SetTypes
  weight: number
  reps: number
  rir: number | undefined
  restSeconds: number
}

// "8-10" o, si el rango es de un solo valor, "8"
const formatReps = (min: number, max: number) => (min === max ? String(min) : `${min}-${max}`)

const SET_TYPE_DESCRIPTIONS: Record<SetTypes, string> = {
  Normal: 'Serie de trabajo',
  Calentamiento: 'Serie de aproximación, con poco peso',
  'Al Fallo': 'Hasta no poder hacer otra repetición',
  'Drop Set': 'Al llegar al fallo, bajas el peso y sigues sin descansar',
}

// La serie cuyo tipo se está eligiendo en el popup
interface TypePickerTarget {
  exerciseId: string
  rowIndex: number
  target: TargetSet | undefined
  current: SetTypes
}

export function LiveSessionPage({ session }: { session: Session }) {
  // ── 1. ESTADOS ──
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [overrides, setOverrides] = useState<RowDraft[]>([])
  const [extraRows, setExtraRows] = useState<Record<string, number>>({})
  // Bloques Drop Set de esta sesión, por "ejercicio:índice de la serie madre": cuántas bajadas lleva planeadas el usuario
  // (por defecto 2) y el descanso que corre al terminar la última. Si la app se recarga a mitad de un bloque, se pierde
  // y vuelven los valores por defecto.
  const [dropPlans, setDropPlans] = useState<Record<string, { count: number; restSeconds: number }>>({})
  const [dropOverrides, setDropOverrides] = useState<Record<string, Partial<DropDraft>>>({})
  // Unidad en la que se MUESTRA/INGRESA el peso de cada ejercicio (no se guarda, dura solo esta sesión): algunas
  // máquinas del gym marcan en libras y otras en kilos para el mismo ejercicio, así que es por ejercicio, no global.
  // Todo se sigue guardando en kg (ver kgToLb/lbToKg): el resto de la app (volumen, 1RM, récords) no se entera.
  const [weightUnits, setWeightUnits] = useState<Record<string, WeightUnit>>({})
  const [restEndsAt, setRestEndsAt] = useState<Date | null>(null)
  const [restTotalSeconds, setRestTotalSeconds] = useState(0)
  const [restRunId, setRestRunId] = useState(0) // cambia en cada descanso nuevo; reinicia la capa de progreso sin animarla
  const [finishedAt, setFinishedAt] = useState<Date | null>(null)
  const [pastSessions, setPastSessions] = useState<Session[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [typePicker, setTypePicker] = useState<TypePickerTarget | null>(null)
  const [manualKcalText, setManualKcalText] = useState('')
  const manualKcalFieldId = useId()

  // ── 2. HOOKS derivados ──
  const remainingRestSeconds = useRemainingSeconds(restEndsAt)
  const elapsedSeconds = useElapsedSeconds(session.startedAt)
  const restProgress = calculateRestProgress(remainingRestSeconds, restTotalSeconds)
  const estimatedKcal = finishedAt && profile
    ? estimateExerciseKcal(Math.floor((finishedAt.getTime() - session.startedAt.getTime()) / 1000), profile.weightKg)
    : 0
  // Pantalla encendida durante la sesión (si el usuario no lo desactivó en Ajustes); al resumen final ya no hace falta
  useWakeLock(readBooleanPreference(KEEP_AWAKE_KEY, true) && finishedAt === null)
  const previousRemainingRef = useRef<number | null>(null)
  const lastCompletionRef = useRef(new Map<string, number>()) // cuándo se completó cada fila, para ignorar dobles toques

  // ── 3. EFECTOS (suscripciones y el aviso de fin de descanso) ──
  // Al pasar de "queda tiempo" a "terminó" suena el aviso, si el usuario no lo desactivó. Solo suena con la app abierta:
  // iOS suspende la PWA en segundo plano, y por eso también se avisa con el texto verde del recuadro.
  useEffect(() => {
    if (shouldAlertRestEnd(previousRemainingRef.current, remainingRestSeconds, restEndsAt, new Date())) {
      if (readBooleanPreference(REST_SOUND_KEY, true)) playRestEndSound()
    }
    previousRemainingRef.current = restEndsAt ? remainingRestSeconds : null
  }, [remainingRestSeconds, restEndsAt])

  // Terminado el descanso, el recuadro se queda 3 s en verde ("¡Descanso terminado!") y se oculta solo. Si el usuario
  // suma tiempo con +15s antes de que se oculte, el descanso vuelve a correr y este aviso se cancela.
  useEffect(() => {
    if (!restEndsAt || remainingRestSeconds > 0) return
    const timer = setTimeout(() => setRestEndsAt(null), getRestBannerHideDelayMs(restEndsAt, new Date()))
    return () => clearTimeout(timer)
  }, [remainingRestSeconds, restEndsAt])

  useEffect(() => {
    const unsubscribe = firebaseWorkoutRepository.subscribeExercises(setExercises)
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = firebaseSessionRepository.subscribeSessions(setPastSessions)
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

  // ── 4. FUNCIONES ──
  function getPendingRow(exerciseId: string, rowIndex: number, target: TargetSet | undefined): RowDraft {
    const override = overrides.find((o) => o.exerciseId === exerciseId && o.rowIndex === rowIndex)
    if (override) return override

    return {
      exerciseId,
      rowIndex,
      type: target?.type ?? 'Normal',
      weight: target?.weight ?? 0,
      reps: target?.repsMin ?? 0,
      rir: undefined,
      restSeconds: target?.restSeconds ?? 60,
    }
  }

  function updateRow(exerciseId: string, rowIndex: number, target: TargetSet | undefined, changes: Partial<RowDraft>) {
    const current = getPendingRow(exerciseId, rowIndex, target)
    const updated = { ...current, ...changes }

    setOverrides((existing) => [
      ...existing.filter((o) => !(o.exerciseId === exerciseId && o.rowIndex === rowIndex)),
      updated,
    ])
  }

  function getWeightUnit(exerciseId: string): WeightUnit {
    return weightUnits[exerciseId] ?? 'kg'
  }

  function toggleWeightUnit(exerciseId: string) {
    setWeightUnits((current) => ({ ...current, [exerciseId]: getWeightUnit(exerciseId) === 'kg' ? 'lb' : 'kg' }))
  }

  function chooseSetType(type: SetTypes) {
    if (!typePicker) return
    updateRow(typePicker.exerciseId, typePicker.rowIndex, typePicker.target, { type })
    setTypePicker(null)
  }

  function adjustRest(deltaSeconds: number) {
    if (!restEndsAt) return
    setRestEndsAt(new Date(restEndsAt.getTime() + deltaSeconds * 1000))
    setRestTotalSeconds((total) => Math.max(total + deltaSeconds, 1))
  }

  function completeRow(exerciseId: string, rowIndex: number, target: TargetSet | undefined) {
    // Un doble toque en ✓ no debe registrar la misma serie dos veces
    const completedCount = session.exercises.find((exercise) => exercise.exerciseId === exerciseId)?.sets.length ?? 0
    const rowKey = `${exerciseId}:${rowIndex}`
    const now = Date.now()
    if (shouldIgnoreCompletion(completedCount, rowIndex, lastCompletionRef.current.get(rowKey) ?? null, now)) return
    lastCompletionRef.current.set(rowKey, now)

    unlockAudio() // iOS solo permite iniciar el audio dentro de un toque: se prepara aquí para el aviso de fin de descanso
    const draft = getPendingRow(exerciseId, rowIndex, target)

    const isDropSet = draft.type === 'Drop Set'
    const newSet: CompletedSet = {
      type: draft.type,
      reps: draft.reps,
      weight: draft.weight,
      rir: draft.rir,
      completedAt: new Date(),
      ...(isDropSet && { drops: [] }),
    }

    saveExerciseSets(exerciseId, (sets) => [...sets, newSet])
    if (isDropSet) {
      // Las bajadas siguen sin descanso: el temporizador arranca al completar la última (ver completeDrop)
      setDropPlans((existing) => ({
        ...existing,
        [dropKey(exerciseId, rowIndex)]: { count: DEFAULT_DROP_COUNT, restSeconds: draft.restSeconds },
      }))
    } else {
      startRest(draft.restSeconds)
    }
    setOverrides((existing) => existing.filter((o) => !(o.exerciseId === exerciseId && o.rowIndex === rowIndex)))
  }

  function startRest(seconds: number) {
    setRestEndsAt(new Date(Date.now() + seconds * 1000))
    setRestTotalSeconds(seconds)
    setRestRunId((id) => id + 1)
  }

  function saveExerciseSets(exerciseId: string, update: (sets: CompletedSet[]) => CompletedSet[]) {
    firebaseSessionRepository.updateSession({
      ...session,
      exercises: session.exercises.map((exercise) =>
        exercise.exerciseId === exerciseId ? { ...exercise, sets: update(exercise.sets) } : exercise,
      ),
    })
  }

  // ── Drop Set: bajadas anidadas bajo la serie madre ──
  const dropKey = (exerciseId: string, setIndex: number) => `${exerciseId}:${setIndex}`
  const dropDraftKey = (exerciseId: string, setIndex: number, dropIndex: number) => `${exerciseId}:${setIndex}:${dropIndex}`

  function getSets(exerciseId: string): CompletedSet[] {
    return session.exercises.find((exercise) => exercise.exerciseId === exerciseId)?.sets ?? []
  }

  function getDropDraft(exerciseId: string, setIndex: number, madre: CompletedSet, dropIndex: number): DropDraft {
    const suggestion = suggestDrop(madre, dropIndex)
    return { ...suggestion, rir: undefined, ...dropOverrides[dropDraftKey(exerciseId, setIndex, dropIndex)] }
  }

  function updateDropDraft(exerciseId: string, setIndex: number, madre: CompletedSet, dropIndex: number, changes: Partial<DropDraft>) {
    const key = dropDraftKey(exerciseId, setIndex, dropIndex)
    const current = getDropDraft(exerciseId, setIndex, madre, dropIndex)
    setDropOverrides((existing) => ({ ...existing, [key]: { ...existing[key], ...current, ...changes } }))
  }

  // Descanso al terminar el bloque: el que se guardó al completar la madre o, si la app se recargó, el de la rutina
  function getBlockRestSeconds(exerciseId: string, setIndex: number): number {
    const planned = dropPlans[dropKey(exerciseId, setIndex)]?.restSeconds
    if (planned !== undefined) return planned
    const routine = routines.find((r) => r.id === session.routineId)
    const routineExercise = routine?.exercises.find((re) => re.exerciseId === exerciseId)
    return routineExercise?.targetSets[setIndex]?.restSeconds ?? 60
  }

  function setPlannedDrops(exerciseId: string, setIndex: number, count: number) {
    const key = dropKey(exerciseId, setIndex)
    const restSeconds = getBlockRestSeconds(exerciseId, setIndex)
    setDropPlans((existing) => ({ ...existing, [key]: { count, restSeconds } }))
  }

  function clearDropDrafts(exerciseId: string, setIndex: number) {
    const prefix = `${dropKey(exerciseId, setIndex)}:`
    setDropOverrides((existing) => Object.fromEntries(Object.entries(existing).filter(([key]) => !key.startsWith(prefix))))
  }

  function completeDrop(exerciseId: string, setIndex: number, dropIndex: number) {
    const madre = getSets(exerciseId)[setIndex]
    if (!madre?.drops) return
    // Un doble toque en ✓ no debe registrar la misma bajada dos veces
    const rowKey = dropDraftKey(exerciseId, setIndex, dropIndex)
    const now = Date.now()
    if (shouldIgnoreCompletion(madre.drops.length, dropIndex, lastCompletionRef.current.get(rowKey) ?? null, now)) return
    lastCompletionRef.current.set(rowKey, now)

    unlockAudio()
    const draft = getDropDraft(exerciseId, setIndex, madre, dropIndex)
    const drop: DropSet = {
      reps: draft.reps,
      weight: draft.weight,
      ...(draft.rir !== undefined && { rir: draft.rir }),
      completedAt: new Date(),
    }

    saveExerciseSets(exerciseId, (sets) =>
      sets.map((set, index) => (index === setIndex ? { ...set, drops: [...(set.drops ?? []), drop] } : set)),
    )
    if (countPendingDrops(madre, dropPlans[dropKey(exerciseId, setIndex)]?.count ?? null) <= 1) {
      startRest(getBlockRestSeconds(exerciseId, setIndex)) // era la última bajada: ahora sí se descansa
    }
    setDropOverrides((existing) => Object.fromEntries(Object.entries(existing).filter(([key]) => key !== rowKey)))
  }

  function addDrop(exerciseId: string, setIndex: number) {
    const madre = getSets(exerciseId)[setIndex]
    if (!madre?.drops) return
    const planned = Math.max(dropPlans[dropKey(exerciseId, setIndex)]?.count ?? DEFAULT_DROP_COUNT, madre.drops.length)
    setPlannedDrops(exerciseId, setIndex, planned + 1)
  }

  function removeDrop(exerciseId: string, setIndex: number, dropIndex: number) {
    const sets = getSets(exerciseId)
    const madre = sets[setIndex]
    if (!madre?.drops) return
    const done = madre.drops.length
    const planned = Math.max(dropPlans[dropKey(exerciseId, setIndex)]?.count ?? DEFAULT_DROP_COUNT, done)

    if (dropIndex < done) {
      saveExerciseSets(exerciseId, (current) =>
        current.map((set, index) => (index === setIndex ? { ...set, drops: (set.drops ?? []).filter((_, i) => i !== dropIndex) } : set)),
      )
    }
    setPlannedDrops(exerciseId, setIndex, planned - 1)
    clearDropDrafts(exerciseId, setIndex)

    // Quitaste la última bajada que faltaba: el bloque terminó, así que corre el descanso
    const removedPending = dropIndex >= done
    if (removedPending && setIndex === sets.length - 1 && planned - 1 <= done) {
      startRest(getBlockRestSeconds(exerciseId, setIndex))
    }
  }

  function finishSession() {
    const now = new Date()
    const durationSeconds = Math.floor((now.getTime() - session.startedAt.getTime()) / 1000)
    const initialEstimate = profile ? estimateExerciseKcal(durationSeconds, profile.weightKg) : 0
    setFinishedAt(now)
    setManualKcalText(initialEstimate > 0 ? String(initialEstimate) : '')
  }

  function confirmFinish() {
    if (!finishedAt) return
    const enteredKcal = Number(manualKcalText)
    // null si el campo quedó vacío o igual a la estimación: así, si el peso cambia después, la estimación se recalcula sola
    const manualExerciseKcal =
      manualKcalText.trim() !== '' && Number.isFinite(enteredKcal) && Math.round(enteredKcal) !== estimatedKcal
        ? Math.round(enteredKcal)
        : null
    const updated: Session = { ...session, endedAt: finishedAt, status: 'completed', manualExerciseKcal }
    firebaseSessionRepository.updateSession(updated)
  }

  function discardSession() {
    if (window.confirm('¿Descartar esta sesión? Se perderán todas las series registradas. No se puede deshacer.')) {
      firebaseSessionRepository.deleteSession(session.id)
    }
  }

  // ── 5. Resumen (corte condicional) ──
  if (finishedAt) {
    const durationSeconds = Math.floor((finishedAt.getTime() - session.startedAt.getTime()) / 1000)
    const volume = calculateSessionVolume(session)
    const completedPastSessions = pastSessions.filter(
      (pastSession) => pastSession.status === 'completed' && pastSession.id !== session.id,
    )
    const records = findNewRecords(session, completedPastSessions)

    return (
      <section className="px-4 py-6">
        <h1 className="text-xl font-semibold">Resumen de la sesión</h1>
        <p className="mt-4">Duración: {formatDuration(durationSeconds)}</p>
        <p>Volumen total: {volume} kg</p>

        <div className="mt-3 flex flex-col">
          <label htmlFor={manualKcalFieldId} className="text-xs text-slate-500">
            Kcal quemadas{estimatedKcal > 0 ? ` (estimado: ${estimatedKcal})` : ''}
          </label>
          <input
            id={manualKcalFieldId}
            type="number"
            inputMode="numeric"
            value={manualKcalText}
            onChange={(e) => setManualKcalText(e.target.value)}
            placeholder="0"
            className="mt-1 w-24 rounded bg-slate-800 px-2 py-1 text-center text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">
            Corrígelas con tu smartwatch si las mides; es solo informativo, no se suma al objetivo del día.
          </p>
        </div>

        {records.length === 0 && <p className="mt-4 text-slate-400">Sin récords nuevos esta vez.</p>}
        {records.map((record) => {
          const exercise = exercises.find((e) => e.id === record.exerciseId)
          return (
            <p key={record.exerciseId} className="mt-4 text-emerald-400">
              ¡Récord en {exercise?.name}! {record.previousBest.toFixed(1)} → {record.newBest.toFixed(1)} (1RM est.)
            </p>
          )
        })}

        <button
          type="button"
          onClick={confirmFinish}
          className={`${primaryButton} mt-6`}
        >
          Guardar sesión
        </button>
        <button
          type="button"
          onClick={discardSession}
          className={`${dangerButton} mt-3`}
        >
          Descartar sesión
        </button>
      </section>
    )
  }

  // ── 6. Pantalla normal ──
  return (
    <section className="px-4 py-6">
      <h1 className="text-xl font-semibold">Sesión en curso</h1>
      <p className="text-sm text-slate-400">{formatDuration(elapsedSeconds)}</p>

      {restEndsAt && (
        // Fijo arriba mientras corre: queda a la vista aunque te desplaces por un ejercicio largo.
        // No bloquea nada: puedes ajustar o completar la siguiente serie durante el descanso.
      <div
        role="progressbar"
        aria-label="Descanso"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(restProgress * 100)}
        className="sticky top-2 z-10 mt-2 overflow-hidden rounded-xl bg-slate-800 p-3 text-center shadow-lg ring-1 ring-slate-700"
      >
        {/* Capa de progreso: llena todo el fondo y crece de izquierda a derecha */}
        <div
          key={restRunId}
          className={`absolute inset-0 origin-left transition-transform duration-1000 ease-linear motion-reduce:transition-none ${
            remainingRestSeconds > 0 ? 'bg-primary/25' : 'bg-emerald-400/25'
          }`}
          style={{ transform: `scaleX(${restProgress})` }}
        />
        <p className={`relative text-2xl font-bold ${remainingRestSeconds > 0 ? '' : 'text-emerald-400'}`}>
          {remainingRestSeconds > 0 ? formatDuration(remainingRestSeconds) : '¡Descanso terminado!'}
        </p>
        <div className="relative mt-2 flex justify-center gap-2 text-sm">
          <button type="button" onClick={() => adjustRest(-15)} className={secondaryButtonOnCard}>
            -15s
          </button>
          <button type="button" onClick={() => adjustRest(15)} className={secondaryButtonOnCard}>
            +15s
          </button>
          <button type="button" onClick={() => setRestEndsAt(null)} className={secondaryButtonOnCard}>
            Saltar
          </button>
        </div>
      </div>
      )}

      {session.exercises.map((sessionExercise) => {
        const exercise = exercises.find((e) => e.id === sessionExercise.exerciseId)
        if (!exercise) return null

        const routine = routines.find((r) => r.id === session.routineId)
        const routineExercise = routine?.exercises.find((re) => re.exerciseId === sessionExercise.exerciseId)
        // Lo que hiciste la última vez en este ejercicio, serie por serie (solo de referencia; no precarga nada)
        const lastSets = getExerciseHistory(pastSessions, sessionExercise.exerciseId).at(-1)?.sets ?? null
        // Unidad de este ejercicio en esta sesión (kg por defecto); solo cambia cómo se muestra/ingresa el peso
        const unit = getWeightUnit(sessionExercise.exerciseId)
        const displayWeight = (kg: number) => (unit === 'lb' ? kgToLb(kg) : kg)

        const completedCount = sessionExercise.sets.length
        const totalTargets = routineExercise?.targetSets.length ?? 0
        const rowCount = totalTargets + (extraRows[sessionExercise.exerciseId] ?? 0)
        // Bajadas que faltan en el último Drop Set: hasta resolverlas (hacerlas o quitarlas) no se pasa a la siguiente serie
        const lastSetIndex = completedCount - 1
        const lastDropSet = sessionExercise.sets[lastSetIndex]
        const pendingDrops = lastDropSet?.drops
          ? countPendingDrops(lastDropSet, dropPlans[dropKey(sessionExercise.exerciseId, lastSetIndex)]?.count ?? null)
          : 0

        return (
          <div key={sessionExercise.exerciseId} className="mt-4 rounded-xl bg-slate-900 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="font-medium">{exercise.name}</p>
                <button
                  type="button"
                  onClick={() => toggleWeightUnit(sessionExercise.exerciseId)}
                  aria-label={`Unidad de peso: ${unit === 'kg' ? 'kilogramos' : 'libras'}. Toca para cambiar`}
                  className="rounded bg-slate-700/60 px-1.5 text-[11px] font-bold leading-5 text-slate-300"
                >
                  {unit.toUpperCase()}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                {completedCount}/{rowCount}
              </p>
            </div>

            {/* Encabezados de columna: solo lo que se llena en cada serie */}
            <div className="mt-3 flex items-center gap-2 px-1 text-[10px] uppercase text-slate-500">
              <span className="w-16">Serie</span>
              <span className="flex-1 text-center">{unit}</span>
              <span className="flex-1 text-center">Reps</span>
              <span className="w-14 text-center">RIR</span>
              <span className="w-10" />
            </div>

            {Array.from({ length: rowCount }, (_, rowIndex) => {
              const target = routineExercise?.targetSets[rowIndex]
              const completedSet = sessionExercise.sets[rowIndex]
              const isLocked = rowIndex > completedCount || (rowIndex === completedCount && pendingDrops > 0)

              // Fila ya completada: solo lectura, en verde (si es un Drop Set, con sus bajadas anidadas debajo)
              if (completedSet) {
                const previousBlock = completedSet.drops
                  ? findPreviousSetForType(lastSets, sessionExercise.sets.slice(0, rowIndex), 'Drop Set')
                  : null
                return (
                  <div key={rowIndex}>
                    <div className="mt-1 flex items-center gap-2 rounded-lg bg-emerald-950 px-1 py-2 text-sm">
                      <SetBadge number={rowIndex + 1} type={completedSet.type} />
                      <span className="flex-1 text-center">{displayWeight(completedSet.weight)}</span>
                      <span className="flex-1 text-center">{completedSet.reps}</span>
                      <span className="w-14 text-center text-slate-400">{completedSet.rir ?? '—'}</span>
                      <span className="w-10 text-center text-emerald-400">✓</span>
                    </div>
                    {completedSet.drops && (
                      <DropSetBlock
                        exerciseName={exercise.name}
                        madre={completedSet}
                        pendingCount={rowIndex === lastSetIndex ? pendingDrops : 0}
                        previousBlock={previousBlock}
                        canAdd={rowIndex === lastSetIndex}
                        unitLabel={unit === 'kg' ? 'kilogramos' : 'libras'}
                        displayWeight={displayWeight}
                        toKg={(value) => (unit === 'lb' ? lbToKg(value) : value)}
                        getDraft={(dropIndex) => getDropDraft(sessionExercise.exerciseId, rowIndex, completedSet, dropIndex)}
                        onChangeDraft={(dropIndex, changes) =>
                          updateDropDraft(sessionExercise.exerciseId, rowIndex, completedSet, dropIndex, changes)
                        }
                        onCompleteDrop={(dropIndex) => completeDrop(sessionExercise.exerciseId, rowIndex, dropIndex)}
                        onRemoveDrop={(dropIndex) => removeDrop(sessionExercise.exerciseId, rowIndex, dropIndex)}
                        onAddDrop={() => addDrop(sessionExercise.exerciseId, rowIndex)}
                      />
                    )}
                  </div>
                )
              }

              // Fila bloqueada: todavía no le toca, se ve pero no se puede tocar
              if (isLocked) {
                return (
                  <div key={rowIndex} className="mt-1 flex items-center gap-2 rounded-lg px-1 py-2 text-sm text-slate-600">
                    <SetBadge number={rowIndex + 1} type={target?.type ?? 'Normal'} />
                    <span className="flex-1 text-center">{target ? displayWeight(target.weight) : '—'}</span>
                    <span className="flex-1 text-center">{target ? formatReps(target.repsMin, target.repsMax) : '—'}</span>
                    <span className="w-14 text-center">—</span>
                    <span className="w-10 text-center">○</span>
                  </div>
                )
              }

              // Fila activa: la única editable, lista para completar
              const draft = getPendingRow(sessionExercise.exerciseId, rowIndex, target)
              const lastSet = findPreviousSetForType(lastSets, sessionExercise.sets, draft.type)
              const inputClass = 'h-10 min-w-0 rounded bg-slate-700 px-2 text-center text-base'

              return (
                <div key={rowIndex} className="mt-1 rounded-lg bg-slate-800 px-1 py-2">
                  <div className="flex items-center gap-2">
                    <SetBadge
                      number={rowIndex + 1}
                      type={draft.type}
                      onClick={() =>
                        setTypePicker({
                          exerciseId: sessionExercise.exerciseId,
                          rowIndex,
                          target,
                          current: draft.type,
                        })
                      }
                    />
                    <NumberField
                      value={displayWeight(draft.weight)}
                      onChange={(value) =>
                        updateRow(sessionExercise.exerciseId, rowIndex, target, {
                          weight: unit === 'lb' ? lbToKg(value) : value,
                        })
                      }
                      ariaLabel={`${exercise.name}, serie ${rowIndex + 1}: peso en ${unit === 'kg' ? 'kilogramos' : 'libras'}`}
                      className={`${inputClass} flex-1`}
                    />
                    <NumberField
                      value={draft.reps}
                      onChange={(reps) => updateRow(sessionExercise.exerciseId, rowIndex, target, { reps })}
                      allowDecimals={false}
                      ariaLabel={`${exercise.name}, serie ${rowIndex + 1}: repeticiones`}
                      className={`${inputClass} flex-1`}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      value={draft.rir ?? ''}
                      onChange={(e) =>
                        updateRow(sessionExercise.exerciseId, rowIndex, target, {
                          rir: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                      onFocus={(e) => e.target.select()}
                      aria-label={`${exercise.name}, serie ${rowIndex + 1}: RIR (repeticiones en reserva)`}
                      placeholder="—"
                      className={`${inputClass} w-14`}
                    />
                    <button
                      type="button"
                      onClick={() => completeRow(sessionExercise.exerciseId, rowIndex, target)}
                      aria-label={`Completar serie ${rowIndex + 1}`}
                      className="h-11 w-11 rounded-full bg-primary text-sm font-semibold text-slate-950"
                    >
                      ✓
                    </button>
                  </div>
                  {lastSet && (
                    // Lo que cargaste la vez pasada, justo debajo de cada campo (no un texto aparte): es el dato
                    // que de verdad se usa para decidir cuánto subir, por eso va grande y a la vista, no en gris
                    <div className="mt-1 flex items-center gap-2">
                      <span className="w-16 shrink-0" aria-hidden="true" />
                      <p className="flex-1 text-center text-sm font-bold text-primary">Antes {displayWeight(lastSet.weight)}</p>
                      <p className="flex-1 text-center text-sm font-bold text-primary">Antes {lastSet.reps}</p>
                      <span className="w-14 shrink-0" aria-hidden="true" />
                      <span className="w-11 shrink-0" aria-hidden="true" />
                    </div>
                  )}
                  {draft.type === 'Drop Set' && lastSet?.drops && lastSet.drops.length > 0 && (
                    <p className="mt-1 text-center text-xs text-slate-400">
                      Bloque anterior: {formatDropChain(lastSet, displayWeight)}
                    </p>
                  )}
                </div>
              )
            })}

            <button
              type="button"
              onClick={() =>
                setExtraRows((existing) => ({
                  ...existing,
                  [sessionExercise.exerciseId]: (existing[sessionExercise.exerciseId] ?? 0) + 1,
                }))
              }
              className={`${linkButton} mt-2`}
            >
              + Agregar serie
            </button>
          </div>
        )
      })}

      <button
        type="button"
        onClick={finishSession}
        className={`${primaryButton} mt-6`}
      >
        Finalizar sesión
      </button>

      <Modal isOpen={typePicker !== null} onClose={() => setTypePicker(null)} title="Tipo de serie">
        <div className="flex flex-col gap-2">
          {SET_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => chooseSetType(type)}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left ${
                typePicker?.current === type ? 'bg-primary/15 ring-1 ring-primary' : 'bg-slate-800'
              }`}
            >
              <span className="flex w-9 justify-center">
                <SetTypeChip type={type} />
              </span>
              <span>
                <span className="block text-sm font-medium">{type}</span>
                <span className="block text-xs text-slate-500">{SET_TYPE_DESCRIPTIONS[type]}</span>
              </span>
            </button>
          ))}
        </div>
      </Modal>
    </section>
  )
}
