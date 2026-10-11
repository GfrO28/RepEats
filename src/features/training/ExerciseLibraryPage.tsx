import { useEffect, useState } from 'react'
import { firebaseWorkoutRepository } from '@/data/firestore/workoutRepository'
import { firebaseRoutineRepository } from '@/data/firestore/routineRepository'
import { ExerciseForm } from './ExerciseForm'
import type { Exercise } from '@/repositories/WorkoutRepository'
import type { Routine } from '@/repositories/RoutineRepository'
import { Modal } from '@/app/Modal'
import { SwipeToDeleteRow } from '@/app/SwipeToDeleteRow'
import { MUSCLE_GROUPS, getMuscleGroup, type MuscleGroupName } from '@/domain/muscleGroups'
import { EQUIPMENT_TYPES, type EquipmentType } from '@/domain/equipmentTypes'
import { fabButton } from '@/app/buttonStyles'

export function ExerciseLibraryPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [routines, setRoutines] = useState<Routine[]>([]) // solo para avisar en cuántas rutinas se usa cada ejercicio
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null) // solo una fila deslizada a la vez
  const [muscleGroupFilter, setMuscleGroupFilter] = useState<MuscleGroupName | 'all'>('all')
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentType | 'all'>('all')

  useEffect(() => {
    const unsubscribe = firebaseWorkoutRepository.subscribeExercises(setExercises)
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = firebaseRoutineRepository.subscribeRoutines(setRoutines)
    return unsubscribe
  }, [])

  const isFormOpen = isCreating || editingExercise !== null

  function closeForm() {
    setIsCreating(false)
    setEditingExercise(null)
  }

  function handleDelete(exercise: Exercise) {
    // Aviso si alguna rutina lo usa: al borrarlo, esas rutinas simplemente dejan de mostrarlo (no se rompen,
    // pero conviene que el usuario lo sepa antes de borrar)
    const routinesUsingIt = routines.filter((routine) => routine.exercises.some((re) => re.exerciseId === exercise.id))
    const usageWarning =
      routinesUsingIt.length > 0
        ? ` Se usa en ${routinesUsingIt.length} ${routinesUsingIt.length === 1 ? 'rutina' : 'rutinas'} (${routinesUsingIt
            .map((r) => r.name)
            .join(', ')}): dejará de aparecer en ${routinesUsingIt.length === 1 ? 'ella' : 'ellas'}.`
        : ''

    if (window.confirm(`¿Eliminar el ejercicio "${exercise.name}"?${usageWarning}`)) {
      firebaseWorkoutRepository.deleteExercise(exercise.id)
    }
  }

  const filteredExercises = exercises
    .filter((exercise) => equipmentFilter === 'all' || exercise.equipment === equipmentFilter)
    .filter((exercise) => {
      if (muscleGroupFilter === 'all') return true
      const groups = [...exercise.primaryMuscles, ...exercise.secondaryMuscles].map(getMuscleGroup)
      return groups.includes(muscleGroupFilter)
    })

  return (
    <section className="px-4 py-6">
      <h1 className="text-xl font-semibold">Ejercicios</h1>

      <div className="mt-2 flex flex-wrap gap-2">
        <select
          value={muscleGroupFilter}
          onChange={(e) => setMuscleGroupFilter(e.target.value as MuscleGroupName | 'all')}
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
          onChange={(e) => setEquipmentFilter(e.target.value as EquipmentType | 'all')}
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

      {filteredExercises.length === 0 && <p className="mt-4">Aún no tienes ejercicios</p>}

      {filteredExercises.map((exercise) => (
        <SwipeToDeleteRow
          key={exercise.id}
          isOpen={openSwipeId === exercise.id}
          onOpenChange={(open) => setOpenSwipeId(open ? exercise.id : null)}
          onDelete={() => {
            handleDelete(exercise)
            setOpenSwipeId(null)
          }}
          deleteLabel={`Eliminar ${exercise.name}`}
        >
          <button
            type="button"
            onClick={() => setEditingExercise(exercise)}
            className="flex min-h-11 w-full items-center py-2 text-left"
          >
            <span>{exercise.name}</span>
          </button>
        </SwipeToDeleteRow>
      ))}

      <button
        type="button"
        onClick={() => setIsCreating(true)}
        aria-label="Nuevo ejercicio"
        className={fabButton}
      >
        +
      </button>

      <Modal isOpen={isFormOpen} onClose={closeForm} title={editingExercise ? 'Editar ejercicio' : 'Nuevo ejercicio'}>
        <ExerciseForm
          key={editingExercise?.id ?? 'new'}
          exerciseToEdit={editingExercise}
          onDone={closeForm}
        />
      </Modal>
    </section>
  )
}
