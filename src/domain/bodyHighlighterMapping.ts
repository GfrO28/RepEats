import type { Muscle } from 'react-body-highlighter'
import type { MuscleGroupName } from './muscleGroups'

// Subconjunto de "Muscle" de react-body-highlighter que sí usamos (excluye head/neck/knees/soleus)
export type BodyHighlighterMuscle =
  | 'trapezius'
  | 'upper-back'
  | 'lower-back'
  | 'chest'
  | 'biceps'
  | 'triceps'
  | 'forearm'
  | 'back-deltoids'
  | 'front-deltoids'
  | 'abs'
  | 'obliques'
  | 'adductor'
  | 'abductors'
  | 'hamstring'
  | 'quadriceps'
  | 'calves'
  | 'gluteal'

// Grupo nuestro → qué región(es) del dibujo debe iluminar (para reflejar la selección)
export const GROUP_TO_BODY_PARTS: Partial<Record<MuscleGroupName, Muscle[]>> = {
  Trapecios: ['trapezius'],
  Dorsales: ['upper-back'],
  'Espalda alta': ['upper-back'],
  Lumbares: ['lower-back'],
  Pectorales: ['chest'],
  Bíceps: ['biceps'],
  Tríceps: ['triceps'],
  Antebrazos: ['forearm'],
  Hombros: ['back-deltoids', 'front-deltoids'],
  Abdominales: ['abs'],
  Oblicuos: ['obliques'],
  Aductores: ['adductor'],
  Isquiotibiales: ['hamstring'],
  Cuádriceps: ['quadriceps'],
  Abductores: ['abductors'],
  Pantorrillas: ['calves'],
  Glúteos: ['gluteal'],
  // 'Flexores de cadera' no tiene silueta propia en el dibujo, pero se ilumina junto
  // con Abductores (misma zona de la cadera) cuando está seleccionado
  'Flexores de cadera': ['abductors'],
}

// Región tocada en el dibujo → cuál(es) grupo(s) nuestro(s) representa
// Partial<Record<Muscle, ...>> (no solo BodyHighlighterMuscle) porque el onClick real de la
// librería puede tocar regiones que no mapeamos (head, neck, knees, left/right-soleus).
export const BODY_PART_TO_GROUPS: Partial<Record<Muscle, MuscleGroupName[]>> = {
  trapezius: ['Trapecios'],
  'upper-back': ['Dorsales', 'Espalda alta'],
  'lower-back': ['Lumbares'],
  chest: ['Pectorales'],
  biceps: ['Bíceps'],
  triceps: ['Tríceps'],
  forearm: ['Antebrazos'],
  'back-deltoids': ['Hombros'],
  'front-deltoids': ['Hombros'],
  abs: ['Abdominales'],
  obliques: ['Oblicuos'],
  adductor: ['Aductores'],
  abductors: ['Abductores', 'Flexores de cadera'],
  hamstring: ['Isquiotibiales'],
  quadriceps: ['Cuádriceps'],
  calves: ['Pantorrillas'],
  gluteal: ['Glúteos'],
}

// ── Mapa de calor: series por grupo muscular → intensidad del color ──

// 1 = poco, 4 = mucho. Los cortes siguen los rangos habituales de series semanales por músculo:
// menos de 5 es poco estímulo, de 10 a 15 es la zona de trabajo típica de hipertrofia y de 16 en adelante es mucho.
export const INTENSITY_LEVELS = 4
const INTENSITY_THRESHOLDS = [1, 5, 10, 16] as const

// 0 = sin series (la región no se ilumina)
export function getSetIntensity(setCount: number): number {
  return INTENSITY_THRESHOLDS.filter((threshold) => setCount >= threshold).length
}

export interface IntensityBodyData {
  name: string
  muscles: Muscle[]
  frequency: number // 1..INTENSITY_LEVELS: posición en highlightedColors (frequency 1 = primer color)
}

// Datos para react-body-highlighter: una entrada por región del dibujo, con la intensidad del grupo que más series
// tenga (varias regiones comparten grupo, y varios grupos comparten región como "Dorsales" y "Espalda alta").
export function buildIntensityBodyData(setsByGroup: Partial<Record<MuscleGroupName, number>>): IntensityBodyData[] {
  const intensityByPart = new Map<Muscle, number>()

  for (const [group, setCount] of Object.entries(setsByGroup) as [MuscleGroupName, number][]) {
    const intensity = getSetIntensity(setCount)
    if (intensity === 0) continue
    for (const part of GROUP_TO_BODY_PARTS[group] ?? []) {
      intensityByPart.set(part, Math.max(intensityByPart.get(part) ?? 0, intensity))
    }
  }

  return [...intensityByPart].map(([part, frequency]) => ({ name: part, muscles: [part], frequency }))
}
