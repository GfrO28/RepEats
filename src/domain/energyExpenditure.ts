// 1. Niveles de actividad — mismo patrón que EQUIPMENT_TYPES/SET_TYPES
export const ACTIVITY_LEVELS = [
    'sedentary',
    'light',
    'moderate',
    'active',
    'veryActive'
] as const
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number]

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentario',
  light: 'Ligero',
  moderate:  'Moderado',
  active:  'Alto',
  veryActive:  'Muy alto'
}

// Referencia para elegir el nivel; incluye el ejercicio y lo que te mueves el resto del día
export const ACTIVITY_LEVEL_DESCRIPTIONS: Record<ActivityLevel, string> = {
  sedentary: 'Poco o nada de ejercicio y trabajo de escritorio',
  light: 'Ejercicio de 1 a 3 días por semana',
  moderate: 'Ejercicio de 3 a 5 días por semana',
  active: 'Ejercicio de 6 a 7 días por semana, o trabajo físico más entrenamiento',
  veryActive: 'Doble sesión diaria o trabajo físico muy pesado',
}

const ACTIVITY_LEVEL_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2, 
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9
}

// 2. Sexo
export const SEXES = ['male', 'female'] as const
export type Sex = (typeof SEXES)[number]

export const SEX_LABELS: Record<Sex, string> = {
  male: 'Hombre', 
  female: 'Mujer'
}

// 3. Datos de entrada para el TMB
export interface BmrInput {
  sex: Sex
  weightKg: number
  heightCm: number
  ageYears: number
}

// 4. TMB (Mifflin-St Jeor)
export function calculateBmr(input: BmrInput): number {
  return input.sex === 'male' ? (10*input.weightKg + 6.25*input.heightCm - 5*input.ageYears + 5) : (10*input.weightKg + 6.25*input.heightCm - 5*input.ageYears - 161)
}

// 5. TDEE
export function calculateTdee(bmr: number, activityLevel: ActivityLevel): number {
  return (bmr*ACTIVITY_LEVEL_FACTORS[activityLevel])
}
