import { describe, it, expect } from 'vitest'
import { getRoutineMuscleGroups } from './routineMuscleGroups'
import type { Routine } from '@/repositories/RoutineRepository'
import type { Exercise } from '@/repositories/WorkoutRepository'

const pressBanca: Exercise = {
  id: 'ex1',
  name: 'Press de banca',
  primaryMuscles: ['pectoral_medio'],
  secondaryMuscles: ['triceps_cabeza_lateral'],
  equipment: 'Barra',
  notes: '',
}

const curlBiceps: Exercise = {
  id: 'ex2',
  name: 'Curl de bíceps',
  primaryMuscles: ['biceps_cabeza_larga'],
  secondaryMuscles: [],
  equipment: 'Mancuernas',
  notes: '',
}

const routine: Routine = {
  id: 'r1',
  name: 'Empuje',
  suggestedDay: 'Lunes',
  suggestedTime: null,
  order: 0,
  exercises: [
    { exerciseId: 'ex1', targetSets: [] },
    { exerciseId: 'ex2', targetSets: [] },
  ],
}

describe('getRoutineMuscleGroups', () => {
  it('junta los grupos musculares primarios de todos los ejercicios de la rutina, sin repetir', () => {
    const groups = getRoutineMuscleGroups(routine, [pressBanca, curlBiceps])
    expect(groups).toEqual(['Pectorales', 'Bíceps'])
  })

  it('ignora ejercicios de la rutina que ya no existen en la biblioteca', () => {
    const groups = getRoutineMuscleGroups(routine, [pressBanca])
    expect(groups).toEqual(['Pectorales'])
  })
})
