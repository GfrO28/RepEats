// src/repositories/ProfileRepository.ts
import type { Sex, ActivityLevel } from '@/domain/energyExpenditure'
import type { MealType } from '@/domain/mealTypes'
import type { AdaptiveTdee } from '@/domain/adaptiveTdee'

export interface Profile {
  // TODO: sex, weightKg, heightCm, ageYears, activityLevel
  sex: Sex
  weightKg: number
  heightCm: number
  ageYears: number
  activityLevel: ActivityLevel
  optionalMeals: MealType[] // comidas opcionales que el usuario usa; se muestran siempre en el diario
  adaptiveTdee: AdaptiveTdee | null // gasto ajustado con los pesajes reales; null = se usa la estimación por nivel de actividad
}

export interface ProfileRepository {
  subscribeProfile(onChange: (profile: Profile | null) => void): () => void
  saveProfile(profile: Profile): void
}
