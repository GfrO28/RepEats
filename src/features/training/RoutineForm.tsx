import { useEffect, useId, useState, type FormEvent } from 'react'
import { firebaseWorkoutRepository } from '@/data/firestore/workoutRepository'
import { firebaseRoutineRepository } from '@/data/firestore/routineRepository'
import type { Exercise } from '@/repositories/WorkoutRepository'
import type { Routine, RoutineExercise, TargetSet } from '@/repositories/RoutineRepository'
import type { SetTypes } from '@/domain/setTypes'
import { DAYS_OF_WEEK } from '@/domain/daysOfWeek'
import { MUSCLE_GROUPS, getMuscleGroup, type MuscleGroupName } from '@/domain/muscleGroups'
import { EQUIPMENT_TYPES, type EquipmentType } from '@/domain/equipmentTypes'
import { Modal } from '@/app/Modal'
import { NumberField } from '@/app/NumberField'
import { SwipeToDeleteRow } from '@/app/SwipeToDeleteRow'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { iconButton, primaryButton, secondaryButton } from '@/app/buttonStyles'

interface ExerciseConfig {
  exerciseId: string
  type: SetTypes
  repsMin: number
  repsMax: number
  weight: number
  restSeconds: number
  setCount: number
}

interface RoutineFormProps {
  routineToEdit: Routine | null
  nextOrder?: number // dónde va una rutina nueva (al final de las que ya existen); no aplica al editar una existente
  onDone: () => void
}

function createTargetSet(config: ExerciseConfig): TargetSet {
  return {
    type: config.type,
    repsMin: config.repsMin,
    repsMax: config.repsMax,
    weight: config.weight,
    restSeconds: config.restSeconds,
  }
}

interface SortableExerciseRowProps {
  config: ExerciseConfig
  exercise: Exercise
  onRemove: () => void
  onUpdate: (changes: Partial<ExerciseConfig>) => void
  onOpenMenu: () => void
}

function SortableExerciseRow({ config, exercise, onRemove, onUpdate, onOpenMenu }: SortableExerciseRowProps) {
  const fieldId = useId()
  const [isSwipeOpen, setIsSwipeOpen] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: config.exerciseId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      {/* Deslizar quita el ejercicio de la rutina (sin confirmar: es un borrador, no se guarda hasta "Guardar cambios").
          El asa de mover (▲▼) queda fuera del área que se desliza, para no chocar con el arrastre de reordenar. */}
      <SwipeToDeleteRow
        isOpen={isSwipeOpen}
        onOpenChange={setIsSwipeOpen}
        onDelete={onRemove}
        deleteLabel={`Quitar ${exercise.name} de la rutina`}
      >
        <div className="flex items-center gap-2 py-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Mover ${exercise.name}`}
            className="flex h-10 w-10 shrink-0 touch-none flex-col items-center justify-center rounded-full bg-slate-800 text-[10px] leading-none text-slate-400 active:cursor-grabbing"
          >
            <span>▲</span>
            <span>▼</span>
          </button>
          <span className="flex-1">{exercise.name}</span>
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label={`Más opciones: ${exercise.name}`}
            className={iconButton}
          >
            ⋮
          </button>
        </div>

        {/* El tipo de serie (Normal/Calentamiento/Al Fallo/Drop Set) ya no se elige aquí: se decide por cada serie
            durante la sesión en vivo (toca el badge N/C/F/DS), que es más flexible y evita duplicar el control. */}
        <div className="flex flex-nowrap gap-1 overflow-x-auto pb-2">
          <div className="flex flex-col">
            <label htmlFor={`${fieldId}-1`} className="text-xs text-slate-500">Series</label>
            <NumberField id={`${fieldId}-1`} value={config.setCount} onChange={(setCount) => onUpdate({ setCount })} allowDecimals={false} className="w-10 rounded bg-slate-800 px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col">
            <label htmlFor={`${fieldId}-2`} className="text-xs text-slate-500">Reps mín.</label>
            <NumberField id={`${fieldId}-2`} value={config.repsMin} onChange={(repsMin) => onUpdate({ repsMin })} allowDecimals={false} className="w-10 rounded bg-slate-800 px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col">
            <label htmlFor={`${fieldId}-3`} className="text-xs text-slate-500">Reps máx.</label>
            <NumberField id={`${fieldId}-3`} value={config.repsMax} onChange={(repsMax) => onUpdate({ repsMax })} allowDecimals={false} className="w-10 rounded bg-slate-800 px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col">
            <label htmlFor={`${fieldId}-4`} className="text-xs text-slate-500">Peso (kg)</label>
            <NumberField id={`${fieldId}-4`} value={config.weight} onChange={(weight) => onUpdate({ weight })} className="w-16 rounded bg-slate-800 px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col">
            <label htmlFor={`${fieldId}-5`} className="text-xs text-slate-500">Descanso</label>
            <div className="flex items-center gap-0.5">
              <input id={`${fieldId}-5`}
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={Math.floor(config.restSeconds / 60).toString().padStart(2, '0')}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const minutes = Number(e.target.value.replace(/\D/g, '')) || 0
                  const seconds = config.restSeconds % 60
                  onUpdate({ restSeconds: minutes * 60 + seconds })
                }}
                className="w-9 rounded bg-slate-800 px-1 py-1 text-center text-sm"
              />
              <span className="text-slate-500">:</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={2}
                aria-label="Descanso, segundos"
                value={(config.restSeconds % 60).toString().padStart(2, '0')}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const seconds = Number(e.target.value.replace(/\D/g, '')) || 0
                  const minutes = Math.floor(config.restSeconds / 60)
                  onUpdate({ restSeconds: minutes * 60 + seconds })
                }}
                className="w-9 rounded bg-slate-800 px-1 py-1 text-center text-sm"
              />
            </div>
          </div>
        </div>
      </SwipeToDeleteRow>
    </div>
  )
}

interface ExercisePickerProps {
  exercises: Exercise[]
  muscleGroupFilter: MuscleGroupName | 'all'
  onMuscleGroupFilterChange: (value: MuscleGroupName | 'all') => void
  equipmentFilter: EquipmentType | 'all'
  onEquipmentFilterChange: (value: EquipmentType | 'all') => void
  onSelect: (exerciseId: string) => void
}

// Lista con los mismos filtros, usada tanto para agregar un ejercicio nuevo como para elegir su reemplazo.
function ExercisePicker({
  exercises,
  muscleGroupFilter,
  onMuscleGroupFilterChange,
  equipmentFilter,
  onEquipmentFilterChange,
  onSelect,
}: ExercisePickerProps) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <select
          value={muscleGroupFilter}
          onChange={(e) => onMuscleGroupFilterChange(e.target.value as MuscleGroupName | 'all')}
          aria-label="Filtrar por grupo muscular"
          className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200"
        >
          <option value="all">Todos los grupos</option>
          {MUSCLE_GROUPS.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>

        <select
          value={equipmentFilter}
          onChange={(e) => onEquipmentFilterChange(e.target.value as EquipmentType | 'all')}
          aria-label="Filtrar por equipo"
          className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-200"
        >
          <option value="all">Todo el equipo</option>
          {EQUIPMENT_TYPES.map((equipmentOption) => (
            <option key={equipmentOption} value={equipmentOption}>
              {equipmentOption}
            </option>
          ))}
        </select>
      </div>

      {exercises.length === 0 && <p className="mt-4 text-sm text-slate-500">Sin resultados</p>}

      {exercises.map((exercise) => (
        <button
          key={exercise.id}
          type="button"
          onClick={() => onSelect(exercise.id)}
          className="flex w-full items-center border-b border-slate-800 py-2 text-left"
        >
          {exercise.name}
        </button>
      ))}
    </>
  )
}

export function RoutineForm({ routineToEdit, nextOrder = 0, onDone }: RoutineFormProps) {
  const [name, setName] = useState(routineToEdit?.name ?? '')
  const [suggestedDay, setSuggestedDay] = useState(routineToEdit?.suggestedDay ?? DAYS_OF_WEEK[0])
  const [suggestedTime, setSuggestedTime] = useState(routineToEdit?.suggestedTime ?? '')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [configs, setConfigs] = useState<ExerciseConfig[]>(() =>
    routineToEdit
      ? routineToEdit.exercises.map((routineExercise) => {
          const firstSet = routineExercise.targetSets[0] ?? {
            type: 'Normal' as const,
            repsMin: 8,
            repsMax: 12,
            weight: 0,
            restSeconds: 60,
          }
          return {
            exerciseId: routineExercise.exerciseId,
            type: firstSet.type,
            repsMin: firstSet.repsMin,
            repsMax: firstSet.repsMax,
            weight: firstSet.weight,
            restSeconds: firstSet.restSeconds,
            setCount: routineExercise.targetSets.length,
          }

        })
      : [],
  )

  const [muscleGroupFilter, setMuscleGroupFilter] = useState<MuscleGroupName | 'all'>('all')
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentType | 'all'>('all')
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [menuExerciseId, setMenuExerciseId] = useState<string | null>(null) // ejercicio cuyo menú (⋮) está abierto
  const [replacingExerciseId, setReplacingExerciseId] = useState<string | null>(null) // ejercicio que se va a reemplazar

  useEffect(() => {
    const unsubscribe = firebaseWorkoutRepository.subscribeExercises(setExercises)
    return unsubscribe
  }, [])

  const availableExercises = exercises
    .filter((exercise) => !configs.some((c) => c.exerciseId === exercise.id))
    .filter((exercise) => equipmentFilter === 'all' || exercise.equipment === equipmentFilter)
    .filter((exercise) => {
      if (muscleGroupFilter === 'all') return true
      const groups = [...exercise.primaryMuscles, ...exercise.secondaryMuscles].map(getMuscleGroup)
      return groups.includes(muscleGroupFilter)
    })

  function toggleExercise(exerciseId: string) {
    const existing = configs.find((c) => c.exerciseId === exerciseId)
    if (existing) {
      setConfigs(configs.filter((c) => c.exerciseId !== exerciseId))
    } else {
      setConfigs([...configs, { exerciseId, type: 'Normal', repsMin: 8, repsMax: 12, weight: 0, restSeconds: 60, setCount: 3 }])

    }
  }

  function updateConfig(exerciseId: string, changes: Partial<ExerciseConfig>) {
    setConfigs(
      configs.map((config) => (config.exerciseId === exerciseId ? {...config, ...changes} : config)),
    )
  }

  // Cambia solo el ejercicio de un puesto de la rutina; conserva sus series/reps/peso/descanso y su posición.
  function replaceExercise(oldExerciseId: string, newExerciseId: string) {
    setConfigs(
      configs.map((config) => (config.exerciseId === oldExerciseId ? { ...config, exerciseId: newExerciseId } : config)),
    )
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setConfigs((current) => {
      const oldIndex = current.findIndex((c) => c.exerciseId === active.id)
      const newIndex = current.findIndex((c) => c.exerciseId === over.id)
      if (oldIndex === -1 || newIndex === -1) return current
      return arrayMove(current, oldIndex, newIndex)
    })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const routineExercises: RoutineExercise[] = configs.map((config) => ({
      exerciseId: config.exerciseId,
      targetSets: Array.from({ length: config.setCount }, () => createTargetSet(config)),
    }))

    const routine: Routine = {
      id: routineToEdit ? routineToEdit.id : firebaseRoutineRepository.generateRoutineId(),
      name,
      suggestedDay,
      suggestedTime: suggestedTime === '' ? null : suggestedTime,
      exercises: routineExercises,
      order: routineToEdit ? routineToEdit.order : nextOrder,
    }

    if (routineToEdit) {
      firebaseRoutineRepository.updateRoutine(routine)
    } else {
      firebaseRoutineRepository.addRoutine(routine)
    }

    onDone()

    setName('')
    setSuggestedDay(DAYS_OF_WEEK[0])
    setSuggestedTime('')
    setConfigs([])
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre de la rutina"
        aria-label="Nombre de la rutina"
        className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <select
          value={suggestedDay}
          onChange={(e) => setSuggestedDay(e.target.value)}
          aria-label="Día sugerido"
          className="flex-1 rounded bg-slate-800 px-3 py-2 text-sm text-slate-100"
        >
          {DAYS_OF_WEEK.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={suggestedTime}
          onChange={(e) => setSuggestedTime(e.target.value)}
          aria-label="Hora sugerida (opcional)"
          className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-100"
        />
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        La hora es opcional: si la pones, el Diario la usa para sugerir cuándo comer antes y después de entrenar.
      </p>

      <div>
        <p className="text-sm text-slate-400">Ejercicios de la rutina (en orden)</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={configs.map((c) => c.exerciseId)} strategy={verticalListSortingStrategy}>
            {configs.map((config) => {
              const exercise = exercises.find((e) => e.id === config.exerciseId)
              if (!exercise) return null

              return (
                <SortableExerciseRow
                  key={config.exerciseId}
                  config={config}
                  exercise={exercise}
                  onRemove={() => toggleExercise(exercise.id)}
                  onUpdate={(changes) => updateConfig(exercise.id, changes)}
                  onOpenMenu={() => setMenuExerciseId(exercise.id)}
                />
              )
            })}
          </SortableContext>
        </DndContext>
      </div>

      <button
        type="button"
        onClick={() => setIsPickerOpen(true)}
        className={secondaryButton}
      >
        + Agregar ejercicio
      </button>

      <Modal isOpen={isPickerOpen} onClose={() => setIsPickerOpen(false)} title="Elegir ejercicio">
        <ExercisePicker
          exercises={availableExercises}
          muscleGroupFilter={muscleGroupFilter}
          onMuscleGroupFilterChange={setMuscleGroupFilter}
          equipmentFilter={equipmentFilter}
          onEquipmentFilterChange={setEquipmentFilter}
          onSelect={(exerciseId) => {
            toggleExercise(exerciseId)
            setIsPickerOpen(false)
          }}
        />
      </Modal>

      {/* Menú (⋮) de un ejercicio ya agregado. Por ahora una sola opción; deja lugar para más sin volver a
          un botón por acción en la fila (que ya iba justa de espacio). */}
      <Modal
        isOpen={menuExerciseId !== null}
        onClose={() => setMenuExerciseId(null)}
        title={exercises.find((exercise) => exercise.id === menuExerciseId)?.name ?? 'Opciones'}
      >
        <button
          type="button"
          onClick={() => {
            setReplacingExerciseId(menuExerciseId)
            setMenuExerciseId(null)
          }}
          className="flex w-full items-center rounded-xl px-3 py-3 text-left text-sm text-slate-100 active:bg-slate-800"
        >
          Reemplazar ejercicio
        </button>
      </Modal>

      <Modal isOpen={replacingExerciseId !== null} onClose={() => setReplacingExerciseId(null)} title="Reemplazar ejercicio">
        <ExercisePicker
          exercises={availableExercises}
          muscleGroupFilter={muscleGroupFilter}
          onMuscleGroupFilterChange={setMuscleGroupFilter}
          equipmentFilter={equipmentFilter}
          onEquipmentFilterChange={setEquipmentFilter}
          onSelect={(exerciseId) => {
            if (replacingExerciseId) replaceExercise(replacingExerciseId, exerciseId)
            setReplacingExerciseId(null)
          }}
        />
      </Modal>

      <button type="submit" className={primaryButton}>
        {routineToEdit ? 'Guardar cambios' : 'Crear rutina'}
      </button>
    </form>
  )
}