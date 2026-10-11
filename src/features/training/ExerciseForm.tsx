import { useState, type FormEvent } from 'react'
import Model, { type IMuscleStats } from 'react-body-highlighter'
import { firebaseWorkoutRepository } from '@/data/firestore/workoutRepository'
import type { Exercise } from '@/repositories/WorkoutRepository'
import {
  MUSCLE_GROUP_INFO,
  SPECIFIC_MUSCLES,
  getMuscleGroup,
  getMuscleLabel,
  type MuscleGroupName,
  type SpecificMuscle,
} from '@/domain/muscleGroups'
import { GROUP_TO_BODY_PARTS, BODY_PART_TO_GROUPS } from '@/domain/bodyHighlighterMapping'
import { EQUIPMENT_TYPES, type EquipmentType } from '@/domain/equipmentTypes'
import { Modal } from '@/app/Modal'
import { chip, primaryButton } from '@/app/buttonStyles'

interface ExerciseFormProps {
  exerciseToEdit: Exercise | null
  onDone: () => void
}

function toggleMuscle(list: SpecificMuscle[], muscle: SpecificMuscle, max: number): SpecificMuscle[] {
  if (list.includes(muscle)) {
    return list.filter((m) => m !== muscle)
  }
  if (list.length >= max) {
    return list
  }
  return [...list, muscle]
}

export function ExerciseForm({ exerciseToEdit, onDone }: ExerciseFormProps) {
  const [name, setName] = useState(exerciseToEdit?.name ?? '')
  const [primaryMuscles, setPrimaryMuscles] = useState<SpecificMuscle[]>(exerciseToEdit?.primaryMuscles ?? [])
  const [secondaryMuscles, setSecondaryMuscles] = useState<SpecificMuscle[]>(exerciseToEdit?.secondaryMuscles ?? [])
  const [equipment, setEquipment] = useState<EquipmentType>(exerciseToEdit?.equipment ?? EQUIPMENT_TYPES[0])
  const [notes, setNotes] = useState(exerciseToEdit?.notes ?? '')

  const [pickerMode, setPickerMode] = useState<'primary' | 'secondary'>('primary')
  const [bodyView, setBodyView] = useState<'anterior' | 'posterior'>('anterior')
  const [openGroups, setOpenGroups] = useState<MuscleGroupName[] | null>(null)
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false)

  const activeMuscles = pickerMode === 'primary' ? primaryMuscles : secondaryMuscles
  const activeMax = pickerMode === 'primary' ? 2 : 5

  // El mapa muestra AMBAS listas a la vez, con colores distintos — no solo el modo activo
  const primaryGroups = new Set(primaryMuscles.map(getMuscleGroup))
  const secondaryGroups = new Set(secondaryMuscles.map(getMuscleGroup))
  const primaryParts = Array.from(primaryGroups).flatMap((group) => GROUP_TO_BODY_PARTS[group] ?? [])
  const secondaryParts = Array.from(secondaryGroups).flatMap((group) => GROUP_TO_BODY_PARTS[group] ?? [])

  function handleBodyClick({ muscle }: IMuscleStats) {
    const groups = BODY_PART_TO_GROUPS[muscle]
    if (!groups) return
    setOpenGroups(groups)
  }

  function toggleActiveMuscle(muscle: SpecificMuscle) {
    if (pickerMode === 'primary') {
      setPrimaryMuscles(toggleMuscle(primaryMuscles, muscle, activeMax))
    } else {
      setSecondaryMuscles(toggleMuscle(secondaryMuscles, muscle, activeMax))
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const exercise: Exercise = {
      id: exerciseToEdit ? exerciseToEdit.id : firebaseWorkoutRepository.generateExerciseId(),
      name,
      primaryMuscles,
      secondaryMuscles,
      equipment,
      notes,
    }

    if (exerciseToEdit) {
      firebaseWorkoutRepository.updateExercise(exercise)
    } else {
      firebaseWorkoutRepository.addExercise(exercise)
    }

    onDone()

    setName('')
    setPrimaryMuscles([])
    setSecondaryMuscles([])
    setEquipment(EQUIPMENT_TYPES[0])
    setNotes('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre"
        aria-label="Nombre del ejercicio"
        className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
      />

      <div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPickerMode('primary')}
            className={chip(pickerMode === 'primary', 'bg-emerald-500')}
          >
            Eligiendo: Primario
          </button>
          <button
            type="button"
            onClick={() => setPickerMode('secondary')}
            className={chip(pickerMode === 'secondary', 'bg-amber-500')}
          >
            Eligiendo: Secundario
          </button>
        </div>

        {/* Layout de 2 columnas: resumen en texto a la izquierda, mapa a la derecha */}
        <div className="mt-2 flex gap-4">
          <div className="flex-1">
            <p className="text-xs text-slate-500">
              <span className="text-emerald-400">●</span> Primarios:{' '}
              {primaryMuscles.map(getMuscleLabel).join(', ') || '—'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              <span className="text-amber-400">●</span> Secundarios:{' '}
              {secondaryMuscles.map(getMuscleLabel).join(', ') || '—'}
            </p>
          </div>

          <div className="w-[140px] shrink-0">
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setBodyView('anterior')}
                className={chip(bodyView === 'anterior')}
              >
                Frente
              </button>
              <button
                type="button"
                onClick={() => setBodyView('posterior')}
                className={chip(bodyView === 'posterior')}
              >
                Espalda
              </button>
            </div>

            <div className="rbh-interactive">
            <Model
              type={bodyView}
              data={[
                { name: 'Secundario', muscles: secondaryParts, frequency: 1 },
                { name: 'Primario', muscles: primaryParts, frequency: 2 },
              ]}
              onClick={handleBodyClick}
              highlightedColors={['#fbbf24', '#34d399']}
              bodyColor="#475569"
            />
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={openGroups !== null} onClose={() => setOpenGroups(null)} title={openGroups?.join(' / ') ?? ''}>
        {openGroups
          ?.filter((group) => pickerMode === 'secondary' || MUSCLE_GROUP_INFO[group].primaryEligible)
          .map((group) => (
            <div key={group} className="mb-3">
              <p className="text-xs text-slate-500">{group}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {SPECIFIC_MUSCLES.filter((muscle) => getMuscleGroup(muscle) === group).map((muscle) => (
                  <button
                    key={muscle}
                    type="button"
                    onClick={() => toggleActiveMuscle(muscle)}
                    className={chip(activeMuscles.includes(muscle), 'bg-emerald-500')}
                  >
                    {getMuscleLabel(muscle)}
                  </button>
                ))}
              </div>
            </div>
          ))}
      </Modal>

      <div>
        <button
          type="button"
          onClick={() => setIsEquipmentModalOpen(true)}
          className={chip(false)}
        >
          Equipamiento: {equipment}
        </button>
      </div>

      <Modal isOpen={isEquipmentModalOpen} onClose={() => setIsEquipmentModalOpen(false)} title="Equipo">
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT_TYPES.map((equipmentOption) => (
            <button
              key={equipmentOption}
              type="button"
              onClick={() => {
                setEquipment(equipmentOption)
                setIsEquipmentModalOpen(false)
              }}
              className={chip(equipment === equipmentOption)}
            >
              {equipmentOption}
            </button>
          ))}
        </div>
      </Modal>

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas"
        aria-label="Notas"
        className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
      />
      <button type="submit" className={primaryButton}>
        {exerciseToEdit ? 'Guardar cambios' : 'Agregar ejercicio'}
      </button>
    </form>
  )
}
