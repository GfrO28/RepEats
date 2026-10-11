import { describe, expect, it } from 'vitest'
import routineBackupFile from '../../docs/seed-data/rutina-inicial-respaldo.json?raw'
import { parseBackup } from './backup'
import { DAYS_OF_WEEK } from './daysOfWeek'
import { EQUIPMENT_TYPES } from './equipmentTypes'
import { MUSCLE_GROUP_INFO, SPECIFIC_MUSCLES, getMuscleGroup, type SpecificMuscle } from './muscleGroups'
import { SET_TYPES } from './setTypes'

// El archivo de la rutina real del usuario, listo para "Ajustes → Importar respaldo". Estas pruebas evitan que se
// importe algo que la app no sabe mostrar (un músculo, un equipo o un día que no existen, o una rutina que apunta a un
// ejercicio que no está).
const result = parseBackup(routineBackupFile)
const collections = result.backup?.collections

describe('rutina-inicial-respaldo.json', () => {
  it('es un respaldo válido para la app, sin avisos', () => {
    expect(result.error).toBeNull()
    expect(result.warnings).toEqual([])
    expect(result.backup).not.toBeNull()
  })

  it('trae 40 ejercicios y 5 rutinas, y nada más', () => {
    expect(Object.keys(collections?.exercises ?? {})).toHaveLength(40)
    expect(Object.keys(collections?.routines ?? {})).toHaveLength(5)
    for (const name of ['profile', 'sessions', 'weighIns', 'phases', 'savedMeals', 'diary', 'foods'] as const) {
      expect(collections?.[name]).toEqual({})
    }
  })

  const exercises = Object.values(collections?.exercises ?? {})
  const routines = Object.values(collections?.routines ?? {})

  it('cada ejercicio usa músculos, equipo e id que existen', () => {
    for (const exercise of exercises) {
      const primary = exercise.primaryMuscles as SpecificMuscle[]
      const secondary = exercise.secondaryMuscles as SpecificMuscle[]
      expect(typeof exercise.name, JSON.stringify(exercise)).toBe('string')
      expect(EQUIPMENT_TYPES as readonly string[], `${exercise.name}: equipo`).toContain(exercise.equipment)
      for (const muscle of [...primary, ...secondary]) {
        expect(SPECIFIC_MUSCLES as readonly string[], `${exercise.name}: músculo ${muscle}`).toContain(muscle)
      }
      expect(exercise.id, `${exercise.name}: el id del documento`).toMatch(/^ej-[a-z0-9-]+$/)
    }
  })

  it('cada ejercicio tiene 1 o 2 músculos primarios del mismo grupo y elegibles como primarios (regla de la app)', () => {
    for (const exercise of exercises) {
      const primary = exercise.primaryMuscles as SpecificMuscle[]
      expect(primary.length, `${exercise.name}: cantidad de primarios`).toBeGreaterThanOrEqual(1)
      expect(primary.length, `${exercise.name}: cantidad de primarios`).toBeLessThanOrEqual(2)
      const groups = new Set(primary.map(getMuscleGroup))
      expect(groups.size, `${exercise.name}: los primarios deben ser del mismo grupo`).toBe(1)
      for (const group of groups) {
        expect(MUSCLE_GROUP_INFO[group].primaryEligible, `${exercise.name}: ${group} no puede ser primario`).toBe(true)
      }
      expect((exercise.secondaryMuscles as string[]).length, `${exercise.name}: secundarios`).toBeLessThanOrEqual(5)
    }
  })

  it('cada rutina usa un día válido y solo ejercicios que están en el archivo', () => {
    const exerciseIds = new Set(exercises.map((exercise) => exercise.id as string))
    for (const routine of routines) {
      expect(DAYS_OF_WEEK as readonly string[], `${routine.name}: día`).toContain(routine.suggestedDay)
      const items = routine.exercises as { exerciseId: string; targetSets: Record<string, unknown>[] }[]
      expect(items.length, `${routine.name}: sin ejercicios`).toBeGreaterThan(0)
      for (const item of items) {
        expect(exerciseIds.has(item.exerciseId), `${routine.name}: ejercicio ${item.exerciseId} no existe`).toBe(true)
        expect(item.targetSets.length).toBeGreaterThan(0)
      }
    }
  })

  it('cada rutina trae un "order" numérico único: 0, 1, 2... en el orden del archivo (Lunes a Sábado)', () => {
    const orders = routines.map((routine) => routine.order as number).sort((a, b) => a - b)
    expect(orders).toEqual([0, 1, 2, 3, 4])
    const byOrder = [...routines].sort((a, b) => (a.order as number) - (b.order as number))
    expect(byOrder.map((routine) => routine.suggestedDay)).toEqual(['Lunes', 'Martes', 'Miércoles', 'Viernes', 'Sábado'])
  })

  it('cada serie objetivo es coherente: tipo válido, repeticiones y descanso positivos, rango bien ordenado', () => {
    for (const routine of routines) {
      const items = routine.exercises as { exerciseId: string; targetSets: Record<string, number | string>[] }[]
      for (const item of items) {
        for (const set of item.targetSets) {
          const label = `${routine.name} / ${item.exerciseId}`
          expect(SET_TYPES as readonly string[], label).toContain(set.type)
          expect(set.repsMin as number, label).toBeGreaterThan(0)
          expect(set.repsMax as number, `${label}: repsMax >= repsMin`).toBeGreaterThanOrEqual(set.repsMin as number)
          expect(set.restSeconds as number, label).toBeGreaterThan(0)
          expect(set.weight as number, label).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  it('las series de un mismo ejercicio en una rutina son idénticas (así lo maneja el formulario de rutinas)', () => {
    for (const routine of routines) {
      const items = routine.exercises as { exerciseId: string; targetSets: unknown[] }[]
      for (const item of items) {
        const first = JSON.stringify(item.targetSets[0])
        expect(item.targetSets.every((set) => JSON.stringify(set) === first), `${routine.name} / ${item.exerciseId}`).toBe(true)
      }
    }
  })

  it('los ejercicios se reutilizan entre días por id, sin duplicarse', () => {
    const usage = new Map<string, number>()
    for (const routine of routines) {
      for (const item of routine.exercises as { exerciseId: string }[]) {
        usage.set(item.exerciseId, (usage.get(item.exerciseId) ?? 0) + 1)
      }
    }
    // "Elevación lateral en polea" se hace martes y sábado
    expect(usage.get('ej-elevacion-lateral-en-polea')).toBe(2)
    // 38 series de ejercicio en total repartidas en las 5 rutinas (algunos ejercicios se repiten entre días)
    expect([...usage.values()].reduce((a, b) => a + b, 0)).toBe(38)
  })

  it('el crunch en máquina es un ejercicio distinto sentado o tumbado: sentado el martes, tumbado el viernes', () => {
    const byId = new Map(exercises.map((exercise) => [exercise.id as string, exercise.name as string]))
    expect([...byId.values()]).toEqual(expect.arrayContaining(['Crunch en máquina, sentado', 'Crunch en máquina, tumbado']))

    function crunchUsedOn(day: string): string | undefined {
      const routine = routines.find((r) => r.suggestedDay === day) as { exercises: { exerciseId: string }[] } | undefined
      const item = routine?.exercises.find((exercise) => byId.get(exercise.exerciseId)?.startsWith('Crunch en máquina'))
      return item && byId.get(item.exerciseId)
    }
    expect(crunchUsedOn('Martes')).toBe('Crunch en máquina, sentado')
    expect(crunchUsedOn('Viernes')).toBe('Crunch en máquina, tumbado')
  })

  it('distingue los ejercicios que antes estaban mezclados o mal clasificados', () => {
    const byName = new Map(exercises.map((exercise) => [exercise.name, exercise]))

    // Las dos hiperextensiones son ejercicios distintos, con el glúteo o la espalda baja como primario
    expect(byName.get('Hiperextensión 45°, enfoque glúteo')?.primaryMuscles).toEqual(['gluteo_mayor'])
    expect(byName.get('Hiperextensión 45°, enfoque espalda baja')?.primaryMuscles).toEqual(['erectores_espinales'])

    // Los gemelos de pie trabajan gemelo y sóleo a la vez (según la flexión de rodilla), ambos primarios
    expect(byName.get('Gemelos de pie en máquina')?.primaryMuscles).toEqual(['gemelos', 'soleo'])

    // "Aperturas" y "Dominadas asistidas / jalón neutro" ya no son un solo ejercicio con "o" en el nombre
    for (const name of ['Aperturas en máquina', 'Aperturas en polea (cruce de poleas)', 'Dominadas asistidas', 'Jalón al pecho agarre neutro']) {
      expect(byName.has(name), name).toBe(true)
    }

    // El remo sentado del sábado es agarre pronado para espalda alta (romboides/trapecio), no para dorsales
    const remoPronado = byName.get('Remo sentado en máquina, agarre pronado')
    expect(remoPronado?.primaryMuscles).toEqual(['romboides'])
    expect(remoPronado?.secondaryMuscles).toContain('trapecio_medio')

    // El press plano del sábado es con barra en banco horizontal, no en máquina de poleas
    expect(byName.get('Press plano con barra')?.equipment).toBe('Barra')
  })
})
