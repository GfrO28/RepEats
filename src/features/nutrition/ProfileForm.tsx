import { useId, useState, type FormEvent } from 'react'
import { firebaseProfileRepository } from '@/data/firestore/profileRepository'
import type { Profile } from '@/repositories/ProfileRepository'
import {
  SEXES, SEX_LABELS, ACTIVITY_LEVELS, ACTIVITY_LEVEL_LABELS, ACTIVITY_LEVEL_DESCRIPTIONS,
  type Sex, type ActivityLevel,
} from '@/domain/energyExpenditure'
import { chip, primaryButton } from '@/app/buttonStyles'

interface ProfileFormProps {
  profileToEdit: Profile | null
  onDone: () => void
}

export function ProfileForm({ profileToEdit, onDone }: ProfileFormProps) {
  const fieldId = useId()
  const [sex, setSex] = useState<Sex>(profileToEdit?.sex ?? SEXES[0])
  const [weightKg, setWeightKg] = useState(profileToEdit ? String(profileToEdit.weightKg) : '')
  const [heightCm, setHeightCm] = useState(profileToEdit ? String(profileToEdit.heightCm) : '')
  const [ageYears, setAgeYears] = useState(profileToEdit ? String(profileToEdit.ageYears) : '')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(profileToEdit?.activityLevel ?? ACTIVITY_LEVELS[0])

  // Se deriva en cada render: Number('') es 0 y Number('abc') es NaN, ambos dan false
  const isValid = Number(weightKg) > 0 && Number(heightCm) > 0 && Number(ageYears) > 0

  function handleSubmit(event: FormEvent) {
    // 1. evita que el navegador recargue la página
    event.preventDefault()

    // 2. armas el objeto con la forma del tipo
    const profile: Profile = {
      sex,
      weightKg: Number(weightKg),
      heightCm: Number(heightCm),
      ageYears: Number(ageYears),
      activityLevel,
      optionalMeals: profileToEdit?.optionalMeals ?? [], // este formulario no lo edita, pero no debe borrarlo
      adaptiveTdee: profileToEdit?.adaptiveTdee ?? null, // tampoco este: lo maneja el ajuste semanal
    }

    // 3. guardas (sin await)
    firebaseProfileRepository.saveProfile(profile)

    // 4. avisas al padre que terminó (cierra el modal)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-2">
        {SEXES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setSex(option)}
            className={chip(sex === option)}
          >
            {SEX_LABELS[option]}
          </button>
        ))}
      </div>

      <div className="flex flex-col">
        <label htmlFor={`${fieldId}-1`} className="text-xs text-slate-500">Peso (kg)</label>
        <input id={`${fieldId}-1`}
          type="number"
          step="0.1"
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col">
        <label htmlFor={`${fieldId}-2`} className="text-xs text-slate-500">Estatura (cm)</label>
        <input id={`${fieldId}-2`}
          type="number"
          value={heightCm}
          onChange={(e) => setHeightCm(e.target.value)}
          className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col">
        <label htmlFor={`${fieldId}-3`} className="text-xs text-slate-500">Edad (años)</label>
        <input id={`${fieldId}-3`}
          type="number"
          value={ageYears}
          onChange={(e) => setAgeYears(e.target.value)}
          className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col">
        <label htmlFor={`${fieldId}-4`} className="text-xs text-slate-500">Nivel de actividad</label>
        <select id={`${fieldId}-4`}
          value={activityLevel}
          onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
          className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-100"
        >
          {ACTIVITY_LEVELS.map((option) => (
            <option key={option} value={option}>
              {ACTIVITY_LEVEL_LABELS[option]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-400">{ACTIVITY_LEVEL_DESCRIPTIONS[activityLevel]}</p>
        <p className="mt-1 text-xs text-slate-500">
          Cuenta también cuánto te mueves fuera del gimnasio: si trabajas sentado, elige un nivel menos. Es un punto de
          partida; el ajuste adaptativo lo corregirá con tu peso real.
        </p>
      </div>

      <button
        type="submit"
        disabled={!isValid}
        className={primaryButton}
      >
        Guardar perfil
      </button>
    </form>
  )
}
