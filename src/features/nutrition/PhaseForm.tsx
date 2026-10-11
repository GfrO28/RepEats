import { useId, useState, type FormEvent } from 'react'
import { firebasePhaseRepository } from '@/data/firestore/phaseRepository'
import type { Phase } from '@/repositories/PhaseRepository'
import type { Profile } from '@/repositories/ProfileRepository'
import { calculateBmr } from '@/domain/energyExpenditure'
import { resolveTdee } from '@/domain/adaptiveTdee'
import {
  adjustMacrosToCalories,
  buildTransitionSchedule,
  calculatePhasePlan,
  DEFAULT_TRANSITION_WEEKS,
  isValidTransitionWeeks,
  MAX_TRANSITION_WEEKS,
  MIN_TRANSITION_WEEKS,
  PHASE_TYPE_LABELS,
  resolvePhaseTargets,
  type PhaseTransition,
  type PhaseType,
} from '@/domain/nutritionGoals'
import { toLocalDateString } from '@/domain/localDate'
import { chip, primaryButton } from '@/app/buttonStyles'
import { proteinText, fatText, carbsText } from '@/app/macroStyles'

const SELECTABLE_PHASE_TYPES: PhaseType[] = ['deficit', 'maintenance', 'surplus', 'transition']

interface PhaseFormProps {
  profile: Profile
  activePhase: Phase | null
  onDone: () => void
}

export function PhaseForm({ profile, activePhase, onDone }: PhaseFormProps) {
  const fieldId = useId()
  // TODO: 4 useState (type, ratePercent, proteinPerKg, fatPerKg)
  const [type, setType] = useState<PhaseType>('deficit')
  const [ratePercent, setRatePercent] = useState('0.5')
  const [proteinPerKg, setProteinPerKg] = useState('1.8')
  const [fatPerKg, setFatPerKg] = useState('0.8')
  const [weeksInput, setWeeksInput] = useState(String(DEFAULT_TRANSITION_WEEKS))

  // TODO: tdee y plan, derivados en cada render
  const tdee = resolveTdee(calculateBmr(profile), profile.activityLevel, profile.adaptiveTdee)
  const plan = calculatePhasePlan({ type, weeklyRatePercent: Number(ratePercent), weightKg: profile.weightKg, tdee, proteinPerKg: Number(proteinPerKg), fatPerKg: Number(fatPerKg) })

  // Transición: parte del objetivo de la fase actual y llega al gasto de mantenimiento en N semanas
  const today = toLocalDateString(new Date())
  const isTransition = type === 'transition'
  const startCalories = activePhase ? resolvePhaseTargets(activePhase, today).targetCalories : null
  const weeks = Number(weeksInput)
  const transition: PhaseTransition | null =
    isTransition && startCalories !== null && isValidTransitionWeeks(weeks)
      ? { startCalories, endCalories: Math.round(tdee), weeks }
      : null
  const schedule = transition ? buildTransitionSchedule(transition) : []

  // El ritmo solo importa en déficit y superávit; proteína y grasa deben estar dentro de los rangos de la especificación
  const isRateValid = type === 'maintenance' || isTransition || Number(ratePercent) > 0
  const isValid =
    isRateValid &&
    (!isTransition || transition !== null) &&
    Number(proteinPerKg) >= 1.6 && Number(proteinPerKg) <= 2.2 &&
    Number(fatPerKg) >= 0.6 && Number(fatPerKg) <= 1

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    // 1. si había una fase en curso, se cierra hoy
    if (activePhase) {
      firebasePhaseRepository.updatePhase({ ...activePhase, endDate: today })
    }

    // 2. la fase nueva guarda lo ya calculado en el plan
    const phase: Phase = {
      id: firebasePhaseRepository.generatePhaseId(),
      type,
      startDate: today,
      endDate: null,
      weeklyRatePercent: plan.weeklyRatePercent,
      // Una transición guarda su calendario; su objetivo real de cada semana se calcula con resolvePhaseTargets
      targetCalories: transition ? (schedule[0] ?? plan.targetCalories) : plan.targetCalories,
      macros: transition ? adjustMacrosToCalories(plan.macros, schedule[0] ?? plan.targetCalories) : plan.macros,
      transition,
    }

    // 3. guardas (sin await) y avisas al padre
    firebasePhaseRepository.addPhase(phase)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* TODO: chips de tipo con SELECTABLE_PHASE_TYPES y PHASE_TYPE_LABELS */}
      <div className="flex gap-2">
        {SELECTABLE_PHASE_TYPES.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setType(option)}
            // La transición necesita una fase anterior de la que partir
            disabled={option === 'transition' && activePhase === null}
            aria-pressed={type === option}
            className={`${chip(type === option)} disabled:opacity-40`}
          >
            {PHASE_TYPE_LABELS[option]}
          </button>
        ))}
      </div>
      {activePhase === null && (
        <p className="text-xs text-slate-500">La transición aparece cuando ya tienes una fase en curso: parte de su objetivo.</p>
      )}
      {isTransition && (
        <p className="text-xs text-slate-400">
          Sube o baja las calorías poco a poco, una vez por semana, desde el objetivo de tu fase actual hasta tu gasto de
          mantenimiento ({Math.round(tdee)} kcal). Sirve para salir de un déficit o un superávit sin cambios bruscos.
        </p>
      )}

      {/* TODO: input de ritmo, solo si type !== 'maintenance' */}
      {isTransition && (
        <div className="flex flex-col">
          <label htmlFor={`${fieldId}-4`} className="text-xs text-slate-500">Duración (semanas)</label>
          <input
            id={`${fieldId}-4`}
            type="number"
            inputMode="numeric"
            value={weeksInput}
            onChange={(e) => setWeeksInput(e.target.value)}
            className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">
            De {MIN_TRANSITION_WEEKS} a {MAX_TRANSITION_WEEKS}. Lo habitual es de 2 a 6.
          </p>
        </div>
      )}

      {type !== 'maintenance' && !isTransition && (
        <div className="flex flex-col">
          <label htmlFor={`${fieldId}-1`} className="text-xs text-slate-500">Ritmo semanal (% del peso)</label>
          <input id={`${fieldId}-1`}
            type="number"
            step="0.05"
            value={ratePercent}
            onChange={(e) => setRatePercent(e.target.value)}
            className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">
            {type === 'deficit' ? 'Recomendado en déficit: 0.5 a 1' : 'Recomendado en superávit: 0.25 a 0.5'}
          </p>
        </div>
      )}

      {/* TODO: inputs de proteína y grasa por kg */}
      <div className="flex flex-col">
        <label htmlFor={`${fieldId}-2`} className="text-xs text-slate-500">Proteína (g por kg)</label>
        <input id={`${fieldId}-2`}
          type="number"
          step="0.1"
          value={proteinPerKg}
          onChange={(e) => setProteinPerKg(e.target.value)}
          className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-slate-500">Recomendado: 1.6 a 2.2</p>
      </div>

      <div className="flex flex-col">
        <label htmlFor={`${fieldId}-3`} className="text-xs text-slate-500">Grasa (g por kg)</label>
        <input id={`${fieldId}-3`}
          type="number"
          step="0.1"
          value={fatPerKg}
          onChange={(e) => setFatPerKg(e.target.value)}
          className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-slate-500">Recomendado: 0.6 a 1</p>
      </div>

      {isValid && transition && (
        <div className="rounded-xl bg-slate-800 p-4">
          <p className="text-xs uppercase text-slate-500">Calendario de la transición</p>
          <ol className="mt-2 text-sm">
            {schedule.map((kcal, index) => (
              <li key={index} className="flex justify-between border-b border-slate-700 py-1">
                <span className="text-slate-400">Semana {index + 1}</span>
                <span className="font-medium">{kcal} kcal</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-slate-500">
            Empieza en {Math.round(transition.startCalories)} kcal (tu fase actual) y termina en {transition.endCalories} kcal
            (mantenimiento). Proteína y grasa se mantienen; los carbohidratos siguen a las calorías.
          </p>
        </div>
      )}

      {isValid && !isTransition && (
        <div className="rounded-xl bg-slate-800 p-4">
          <p className="text-xs uppercase text-slate-500">Vista previa</p>
          <p className="mt-1 text-2xl font-bold">{Math.round(plan.targetCalories)} kcal</p>
          <p className="mt-1 text-sm text-slate-400">
            <span className={proteinText}>Proteína {Math.round(plan.macros.proteinG)} g</span>
            {' · '}
            <span className={fatText}>Grasa {Math.round(plan.macros.fatG)} g</span>
            {' · '}
            <span className={carbsText}>Carbohidratos {Math.round(plan.macros.carbsG)} g</span>
          </p>

          {plan.macrosExceedTarget && (
            <p className="mt-2 text-xs text-amber-400">
              Con tu peso, proteína y grasa ya cubren las kcal objetivo; los carbohidratos quedan en 0. Considera subir las kcal.
            </p>
          )}
        </div>
      )}

      {/* TODO: botón de guardar, disabled si !isValid */}
      <button
        type="submit"
        disabled={!isValid}
        className={primaryButton}
      >
        Guardar fase
      </button>
    </form>
  )
}
