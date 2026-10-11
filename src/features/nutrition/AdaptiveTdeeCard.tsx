import { useEffect, useState } from 'react'
import { firebaseDiaryRepository } from '@/data/firestore/diaryRepository'
import { firebasePhaseRepository } from '@/data/firestore/phaseRepository'
import { firebaseProfileRepository } from '@/data/firestore/profileRepository'
import { firebaseWeighInRepository } from '@/data/firestore/weighInRepository'
import type { DiaryDay } from '@/repositories/DiaryRepository'
import type { Phase } from '@/repositories/PhaseRepository'
import type { Profile } from '@/repositories/ProfileRepository'
import {
  ADAPTIVE_WINDOW_DAYS,
  INSUFFICIENT_REASON_MESSAGES,
  calculateObservedTdee,
  canUpdateTdee,
  getNextTdeeUpdateDate,
  proposeTdeeUpdate,
  resolveTdee,
} from '@/domain/adaptiveTdee'
import { getDailyIntakes } from '@/domain/diary'
import { calculateBmr } from '@/domain/energyExpenditure'
import { addDaysToLocalDate, formatShortLocalDate, toLocalDateString } from '@/domain/localDate'
import { recalculatePhaseTarget } from '@/domain/nutritionGoals'
import type { WeighIn } from '@/domain/weightTrend'
import { linkButton, primaryButton, secondaryButtonOnCard } from '@/app/buttonStyles'

interface AdaptiveTdeeCardProps {
  profile: Profile
  activePhase: Phase | null
}

const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)}`

// Ajuste semanal: compara lo que comiste con lo que cambió tu peso de tendencia para estimar tu gasto real,
// y te propone corregir el gasto que usa el plan. Nunca cambia nada sin que lo confirmes.
export function AdaptiveTdeeCard({ profile, activePhase }: AdaptiveTdeeCardProps) {
  // null = todavía cargando
  const [weighIns, setWeighIns] = useState<WeighIn[] | null>(null)
  const [days, setDays] = useState<DiaryDay[] | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)

  const today = toLocalDateString(new Date())
  const windowStart = addDaysToLocalDate(today, -(ADAPTIVE_WINDOW_DAYS - 1))

  useEffect(() => {
    const unsubscribe = firebaseWeighInRepository.subscribeWeighIns(setWeighIns)
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = firebaseDiaryRepository.subscribeRange(windowStart, today, setDays)
    return unsubscribe
  }, [windowStart, today])

  const adaptive = profile.adaptiveTdee
  const currentTdee = resolveTdee(calculateBmr(profile), profile.activityLevel, adaptive)

  function applyAdjustment(proposedTdee: number) {
    firebaseProfileRepository.saveProfile({ ...profile, adaptiveTdee: { kcal: proposedTdee, updatedAt: today } })
    // La fase en curso guarda su objetivo ya calculado: se recalcula con el gasto nuevo (mismo ritmo, misma
    // proteína y grasa; cambian los carbohidratos)
    if (activePhase?.transition) {
      // La transición apunta al gasto de mantenimiento: si el gasto cambia, cambia adónde llega (su calendario se recalcula)
      firebasePhaseRepository.updatePhase({ ...activePhase, transition: { ...activePhase.transition, endCalories: proposedTdee } })
    } else if (activePhase) {
      const retarget = recalculatePhaseTarget({
        weeklyRatePercent: activePhase.weeklyRatePercent,
        macros: activePhase.macros,
        weightKg: profile.weightKg,
        tdee: proposedTdee,
      })
      firebasePhaseRepository.updatePhase({ ...activePhase, targetCalories: retarget.targetCalories, macros: retarget.macros })
    }
    setIsDismissed(false)
  }

  function resetToEstimate() {
    if (!window.confirm('¿Volver a la estimación por nivel de actividad? El objetivo de tu fase actual no cambia.')) return
    firebaseProfileRepository.saveProfile({ ...profile, adaptiveTdee: null })
  }

  function renderBody() {
    if (weighIns === null || days === null) return <p className="text-sm text-slate-400">Revisando tus datos…</p>

    if (!canUpdateTdee(adaptive, today)) {
      const next = getNextTdeeUpdateDate(adaptive)
      return (
        <p className="text-sm text-slate-400">
          Ya ajustaste tu gasto esta semana. El próximo ajuste está disponible el {next ? formatShortLocalDate(next) : ''}.
        </p>
      )
    }

    const observed = calculateObservedTdee({ endDate: today, weighIns, intakes: getDailyIntakes(days) })
    if (observed.status === 'insufficient') {
      return <p className="text-sm text-slate-400">{INSUFFICIENT_REASON_MESSAGES[observed.reason]}</p>
    }

    const observedTdee = Math.round(observed.observedTdee)
    const summary = (
      <p className="text-sm text-slate-400">
        En {observed.spanDays} días comiste unas {Math.round(observed.averageIntakeKcal)} kcal al día y tu peso de tendencia
        cambió {observed.trendChangeKg > 0 ? '+' : observed.trendChangeKg < 0 ? '−' : ''}
        {Math.abs(observed.trendChangeKg).toFixed(1)} kg. Eso indica un gasto real cercano a {observedTdee} kcal.
      </p>
    )

    const proposal = proposeTdeeUpdate(currentTdee, observed.observedTdee)
    if (!proposal.isMeaningful) {
      return (
        <>
          {summary}
          <p className="mt-2 text-sm text-slate-300">
            Tu gasto actual ({Math.round(currentTdee)} kcal) coincide con lo observado: no hace falta ajustar nada.
          </p>
        </>
      )
    }

    if (isDismissed) {
      return (
        <>
          {summary}
          <p className="mt-2 text-sm text-slate-400">Dejaste el ajuste para después.</p>
          <button type="button" onClick={() => setIsDismissed(false)} className={`${linkButton} mt-2`}>
            Ver el ajuste sugerido
          </button>
        </>
      )
    }

    const retarget = activePhase && !activePhase.transition
      ? recalculatePhaseTarget({
          weeklyRatePercent: activePhase.weeklyRatePercent,
          macros: activePhase.macros,
          weightKg: profile.weightKg,
          tdee: proposal.proposedTdee,
        })
      : null

    return (
      <>
        {summary}
        <div className="mt-3 rounded-xl bg-slate-900 p-3">
          <p className="text-xs text-slate-500">Ajuste sugerido de tu gasto (TDEE)</p>
          <p className="text-xl font-bold">
            {Math.round(currentTdee)} → {proposal.proposedTdee} kcal{' '}
            <span className="text-sm font-normal text-slate-400">({signed(proposal.changeKcal)})</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            El cambio se limita para que sea gradual: se acerca un poco a lo observado en cada ajuste semanal.
          </p>
          {activePhase?.transition && (
            <p className="mt-2 text-sm text-slate-300">
              Tu transición llegará a {proposal.proposedTdee} kcal en vez de {activePhase.transition.endCalories} kcal.
            </p>
          )}
          {activePhase && retarget && (
            <p className="mt-2 text-sm text-slate-300">
              El objetivo de tu fase pasaría de {Math.round(activePhase.targetCalories)} a {Math.round(retarget.targetCalories)}{' '}
              kcal (proteína y grasa se mantienen; cambian los carbohidratos).
            </p>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => applyAdjustment(proposal.proposedTdee)}
            className={`${primaryButton} flex-1`}
          >
            Aplicar ajuste
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className={secondaryButtonOnCard}
          >
            Ahora no
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="mt-4 rounded-xl bg-slate-800 p-4">
      <p className="text-xs uppercase text-slate-500">Ajuste semanal</p>
      {adaptive && (
        <p className="mt-1 text-sm text-slate-300">
          Usando tu gasto ajustado: {adaptive.kcal} kcal (actualizado el {formatShortLocalDate(adaptive.updatedAt)}).
        </p>
      )}
      <div className="mt-2">{renderBody()}</div>
      <p className="mt-3 text-xs text-slate-500">
        Es una estimación: depende de que anotes casi todo lo que comes y de pesarte con regularidad.
      </p>
      {adaptive && (
        <button type="button" onClick={resetToEstimate} className={`${linkButton} mt-2 underline`}>
          Volver a la estimación por nivel de actividad
        </button>
      )}
    </div>
  )
}
