import { useEffect, useState } from 'react'
import { firebaseRoutineRepository } from '@/data/firestore/routineRepository'
import { firebaseWorkoutRepository } from '@/data/firestore/workoutRepository'
import { firebaseSessionRepository } from '@/data/firestore/sessionRepository'
import type { Routine } from '@/repositories/RoutineRepository'
import type { Exercise } from '@/repositories/WorkoutRepository'
import type { Session } from '@/repositories/SessionRepository'
import { getRoutineMuscleGroups } from '@/domain/routineMuscleGroups'
import { getNextRoutineOrder, reindexRoutines, sortRoutinesByOrder } from '@/domain/routineOrder'
import { getDayOfWeek, getRoutinesForDay } from '@/domain/routineSchedule'
import { DAYS_OF_WEEK, DAY_ABBREVIATIONS, type DayOfWeek } from '@/domain/daysOfWeek'
import { RoutineForm } from './RoutineForm'
import { Modal } from '@/app/Modal'
import { SwipeToDeleteRow } from '@/app/SwipeToDeleteRow'
import { PlayIcon } from '@/app/icons'
import { fabButton, primaryButton } from '@/app/buttonStyles'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function startSessionFromRoutine(routine: Routine) {
  const session: Session = {
    id: firebaseSessionRepository.generateSessionId(),
    routineId: routine.id,
    startedAt: new Date(),
    endedAt: null,
    status: 'in_progress',
    manualExerciseKcal: null,
    exercises: routine.exercises.map((routineExercise) => ({
      exerciseId: routineExercise.exerciseId,
      notes: '',
      sets: [],
      // Se copia a la sesión para que no dependa de cambios posteriores a la rutina (y sin undefined: Firestore lo rechaza)
      ...(routineExercise.supersetGroup !== undefined && { supersetGroup: routineExercise.supersetGroup }),
    })),
  }

  firebaseSessionRepository.addSession(session)
}

function startEmptySession() {
  const session: Session = {
    id: firebaseSessionRepository.generateSessionId(),
    routineId: null,
    startedAt: new Date(),
    endedAt: null,
    status: 'in_progress',
    manualExerciseKcal: null,
    exercises: [],
  }

  firebaseSessionRepository.addSession(session)
}

interface SortableRoutineRowProps {
  routine: Routine
  muscleGroups: string[]
  isSwipeOpen: boolean
  onSwipeOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
}

function SortableRoutineRow({ routine, muscleGroups, isSwipeOpen, onSwipeOpenChange, onEdit, onDelete }: SortableRoutineRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: routine.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style}>
      <SwipeToDeleteRow
        isOpen={isSwipeOpen}
        onOpenChange={onSwipeOpenChange}
        onDelete={onDelete}
        deleteLabel={`Eliminar ${routine.name}`}
      >
        <div className="flex items-center gap-2 py-4">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Mover ${routine.name}`}
            className="flex h-10 w-10 shrink-0 touch-none flex-col items-center justify-center rounded-full bg-slate-800 text-[10px] leading-none text-slate-400 active:cursor-grabbing"
          >
            <span>▲</span>
            <span>▼</span>
          </button>

          <button type="button" onClick={onEdit} aria-label={`Editar ${routine.name}`} className="min-w-0 flex-1 text-left">
            <p className="font-bold">{routine.name}</p>
            <p className="text-sm text-slate-500">{routine.suggestedDay}</p>

            <div className="mt-2 flex flex-wrap gap-2">
              {muscleGroups.map((group) => (
                <span key={group} className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                  {group}
                </span>
              ))}
            </div>
          </button>

          <button
            type="button"
            onClick={() => startSessionFromRoutine(routine)}
            aria-label={`Iniciar sesión: ${routine.name}`}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-slate-950"
          >
            <PlayIcon className="ml-0.5 h-6 w-6" />
          </button>
        </div>
      </SwipeToDeleteRow>
    </div>
  )
}

export function RoutineLibraryPage() {
  const today = getDayOfWeek(new Date())
  const [routines, setRoutines] = useState<Routine[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null) // solo una fila deslizada a la vez
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(today) // para consultar otro día en la franja; no agenda nada

  useEffect(() => {
    const unsubscribe = firebaseRoutineRepository.subscribeRoutines(setRoutines)
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = firebaseWorkoutRepository.subscribeExercises(setExercises)
    return unsubscribe
  }, [])

  const isFormOpen = isCreating || editingRoutine !== null
  const orderedRoutines = sortRoutinesByOrder(routines)
  const routinesForSelectedDay = getRoutinesForDay(orderedRoutines, selectedDay)

  function closeForm() {
    setIsCreating(false)
    setEditingRoutine(null)
  }

  function handleDelete(routine: Routine) {
    if (window.confirm(`¿Eliminar la rutina "${routine.name}"?`)) {
      firebaseRoutineRepository.deleteRoutine(routine.id)
    }
  }

  // Arrastrar a gusto: al soltar se renumeran todas 0, 1, 2... según la posición final y se guardan (sin await:
  // la lista ya se ve reordenada al instante desde la caché local, como el resto de la app).
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 5 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = routinesForSelectedDay.findIndex((routine) => routine.id === active.id)
    const newIndex = routinesForSelectedDay.findIndex((routine) => routine.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    // La lista visible es solo la del día elegido: se reordenan entre sí y se reinsertan en los mismos lugares
    // que ocupaban dentro de la lista completa, sin tocar la posición relativa de las rutinas de otros días.
    const reorderedDay = arrayMove(routinesForSelectedDay, oldIndex, newIndex)
    const dayIds = new Set(reorderedDay.map((routine) => routine.id))
    let cursor = 0
    const merged = orderedRoutines.map((routine) => {
      if (!dayIds.has(routine.id)) return routine
      const next = reorderedDay[cursor]
      cursor += 1
      return next ?? routine
    })

    const reindexed = reindexRoutines(merged)
    setRoutines(reindexed)
    for (const routine of reindexed) firebaseRoutineRepository.updateRoutine(routine)
  }

  return (
    <section className="px-4 py-6">
      <h1 className="text-xl font-semibold">Rutinas</h1>

      {/* Solo para consultar qué rutina toca cada día (según "Día sugerido" de cada rutina); tocar un día no
          agenda ni guarda nada, es una vista, no un calendario con fechas. */}
      <ul role="radiogroup" aria-label="Consultar la rutina de un día" className="mt-3 flex justify-between">
        {DAYS_OF_WEEK.map((day) => {
          const hasRoutine = getRoutinesForDay(orderedRoutines, day).length > 0
          const isSelected = day === selectedDay
          return (
            <li key={day} className="flex flex-col items-center gap-1">
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelectedDay(day)}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xs ${
                  isSelected
                    ? 'bg-primary font-semibold text-slate-950'
                    : hasRoutine
                      ? 'bg-slate-800 text-slate-200'
                      : 'bg-slate-800 text-slate-600'
                } ${day === today && !isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-slate-950' : ''}`}
              >
                <span aria-hidden="true">{DAY_ABBREVIATIONS[day]}</span>
                <span className="sr-only">
                  {day}
                  {day === today ? ' (hoy)' : ''}
                  {hasRoutine ? '' : ', descanso'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        onClick={startEmptySession}
        className={`${primaryButton} mt-3 w-full`}
      >
        Iniciar sesión vacía
      </button>

      {orderedRoutines.length === 0 && <p className="mt-4">Aún no tienes rutinas</p>}

      {orderedRoutines.length > 0 && routinesForSelectedDay.length === 0 && (
        <p className="mt-4 text-sm text-slate-400">Descanso 😌</p>
      )}

      {/* La lista solo muestra las rutinas del día elegido en la franja de arriba (no todas): el "día sugerido"
          decide qué rutinas aparecen juntas para reordenarlas entre sí. */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={routinesForSelectedDay.map((routine) => routine.id)} strategy={verticalListSortingStrategy}>
          {routinesForSelectedDay.map((routine) => (
            <SortableRoutineRow
              key={routine.id}
              routine={routine}
              muscleGroups={getRoutineMuscleGroups(routine, exercises)}
              isSwipeOpen={openSwipeId === routine.id}
              onSwipeOpenChange={(open) => setOpenSwipeId(open ? routine.id : null)}
              onEdit={() => setEditingRoutine(routine)}
              onDelete={() => {
                handleDelete(routine)
                setOpenSwipeId(null)
              }}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={() => setIsCreating(true)}
        aria-label="Nueva rutina"
        className={fabButton}
      >
        +
      </button>

      <Modal isOpen={isFormOpen} onClose={closeForm} title={editingRoutine ? 'Editar rutina' : 'Nueva rutina'}>
        <RoutineForm
          key={editingRoutine?.id ?? 'new'}
          routineToEdit={editingRoutine}
          nextOrder={getNextRoutineOrder(routines)}
          onDone={closeForm}
        />
      </Modal>
    </section>
  )
}
