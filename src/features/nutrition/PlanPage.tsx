import { useEffect, useState } from 'react'
import { firebaseProfileRepository } from '@/data/firestore/profileRepository'
import { firebasePhaseRepository } from '@/data/firestore/phaseRepository'
import type { Profile } from '@/repositories/ProfileRepository'
import type { Phase } from '@/repositories/PhaseRepository'
import { calculateBmr, ACTIVITY_LEVEL_LABELS } from '@/domain/energyExpenditure'
import { resolveTdee } from '@/domain/adaptiveTdee'
import { PHASE_TYPE_LABELS, resolvePhaseTargets } from '@/domain/nutritionGoals'
import { toLocalDateString } from '@/domain/localDate'
import { MEAL_TYPE_LABELS, OPTIONAL_MEAL_TYPES, type MealType } from '@/domain/mealTypes'
import { Modal } from '@/app/Modal'
import { ProfileForm } from './ProfileForm'
import { PhaseForm } from './PhaseForm'
import { AdaptiveTdeeCard } from './AdaptiveTdeeCard'
import { chipOnCard, iconButton, primaryButton } from '@/app/buttonStyles'
import { proteinText, fatText, carbsText } from '@/app/macroStyles'

export function PlanPage() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const [isEditing, setIsEditing] = useState(false)
  const [phases, setPhases] = useState<Phase[]>([])
  const [isPhaseFormOpen, setIsPhaseFormOpen] = useState(false)

  // Suscripción al perfil (igual que en RoutineLibraryPage)
  useEffect(() => {
    const unsubscribe = firebaseProfileRepository.subscribeProfile(setProfile)
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = firebasePhaseRepository.subscribePhases(setPhases)
    return unsubscribe
  }, [])

  // undefined = todavía cargando
  if (profile === undefined) {
    return null
  }

  // null = el usuario aún no tiene perfil
  if (profile === null) {
    return (
      <section className="px-4 py-6">
        <h1 className="text-xl font-semibold">Completa tu perfil</h1>
        <p className="mt-2 text-sm text-slate-400">Con estos datos calculamos tu gasto energético diario.</p>
        <div className="mt-4">
          <ProfileForm profileToEdit={null} onDone={() => {}} />
        </div>
      </section>
    )
  }

  // A partir de aquí profile ya es un Profile (TypeScript lo sabe por los retornos anteriores)
  const bmr = calculateBmr(profile)
  const tdee = resolveTdee(bmr, profile.activityLevel, profile.adaptiveTdee)

  // La fase activa es la que aún no tiene fecha de fin
  const activePhase = phases.find((phase) => phase.endDate === null) ?? null
  // El objetivo de hoy: igual todos los días en una fase normal; en una transición cambia cada semana
  const activeTargets = activePhase ? resolvePhaseTargets(activePhase, toLocalDateString(new Date())) : null

  // El historial: las cerradas, de la más reciente a la más antigua ('YYYY-MM-DD' se ordena bien como texto)
  const pastPhases = phases
    .filter((phase) => phase.endDate !== null)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))

  // Activa o desactiva una comida opcional y guarda el perfil completo (sin await)
  // (función flecha y no `function`: las declaraciones `function` se elevan por encima de los return tempranos
  // y TypeScript pierde ahí el estrechamiento de `profile`)
  const toggleOptionalMeal = (type: MealType) => {
    const optionalMeals = profile.optionalMeals.includes(type)
      ? profile.optionalMeals.filter((meal) => meal !== type)
      : [...profile.optionalMeals, type]
    firebaseProfileRepository.saveProfile({ ...profile, optionalMeals })
  }

  return (
    <section className="px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Nutrición</h1>
        <button type="button" onClick={() => setIsEditing(true)} aria-label="Editar perfil" className={iconButton}>
          ✏️
        </button>
      </div>

      <div className="mt-4 rounded-xl bg-slate-800 p-4">
        <p className="text-xs uppercase text-slate-500">Tu gasto energético</p>
        <div className="mt-2 flex gap-8">
          <div>
            <p className="text-2xl font-bold">{Math.round(bmr)}</p>
            <p className="text-xs text-slate-400">TMB (kcal)</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{Math.round(tdee)}</p>
            <p className="text-xs text-slate-400">TDEE (kcal){profile.adaptiveTdee ? ' · ajustado' : ''}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-400">Actividad: {ACTIVITY_LEVEL_LABELS[profile.activityLevel]}</p>

        <p className="mt-4 text-xs text-slate-500">
          <span className="font-medium text-slate-400">TMB</span> (tasa metabólica basal): lo que tu cuerpo gasta en reposo
          total, solo por mantenerte vivo (respirar, el corazón, etc.), sin moverte nada — fórmula Mifflin-St Jeor, a partir
          de tu peso, estatura, edad y sexo.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          <span className="font-medium text-slate-400">TDEE</span> (gasto energético total diario): tu TMB multiplicado por
          tu nivel de actividad
          {profile.adaptiveTdee
            ? ', pero ahora mismo corregido según cómo cambió tu peso real (ver "Ajuste semanal" más abajo, en vez del cálculo por nivel de actividad)'
            : ''}
          . Es tu gasto estimado de un día normal, con el entrenamiento ya promediado ahí dentro — por eso las kcal de
          ejercicio no se suman aparte al objetivo del día en el Diario.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          El objetivo de kcal de tu fase (más abajo) sale de este TDEE, sumando o restando el ritmo semanal que elegiste al
          crear la fase.
        </p>
      </div>

      <AdaptiveTdeeCard profile={profile} activePhase={activePhase} />

      <div className="mt-4 rounded-xl bg-slate-800 p-4">
        <p className="text-xs uppercase text-slate-500">Fase activa</p>
        {activePhase && activeTargets ? (
          <>
            <p className="mt-1 text-lg font-semibold">{PHASE_TYPE_LABELS[activePhase.type]}</p>
            <p className="text-sm text-slate-400">
              {activePhase.transition && activeTargets.transitionWeek !== null
                ? `Desde ${activePhase.startDate} · semana ${activeTargets.transitionWeek} de ${activePhase.transition.weeks} · llegas a ${activePhase.transition.endCalories} kcal`
                : `Desde ${activePhase.startDate} · ${activePhase.weeklyRatePercent} % por semana`}
            </p>
            <p className="mt-2 text-2xl font-bold">{Math.round(activeTargets.targetCalories)} kcal</p>
            <p className="text-sm text-slate-400">
              <span className={proteinText}>Proteína {Math.round(activeTargets.macros.proteinG)} g</span>
              {' · '}
              <span className={fatText}>Grasa {Math.round(activeTargets.macros.fatG)} g</span>
              {' · '}
              <span className={carbsText}>Carbohidratos {Math.round(activeTargets.macros.carbsG)} g</span>
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Este objetivo sale de tu TDEE ({Math.round(tdee)} kcal, arriba) más o menos el ritmo semanal de esta fase; la
              proteína y la grasa se calculan por tu peso, y los carbohidratos son lo que queda de las kcal.
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-slate-400">Aún no tienes una fase activa</p>
        )}
        <button
          type="button"
          onClick={() => setIsPhaseFormOpen(true)}
          className={`${primaryButton} mt-4`}
        >
          {activePhase ? 'Nueva fase' : 'Empezar una fase'}
        </button>
      </div>

      {pastPhases.length > 0 && (
        <div className="mt-4">
          <p className="text-xs uppercase text-slate-500">Fases anteriores</p>
          {pastPhases.map((phase) => (
            <div key={phase.id} className="flex items-center justify-between border-b border-slate-800 py-2">
              <div>
                <p className="text-sm font-medium">{PHASE_TYPE_LABELS[phase.type]}</p>
                <p className="text-xs text-slate-500">
                  {phase.startDate} → {phase.endDate}
                </p>
              </div>
              <p className="text-sm text-slate-400">{Math.round(phase.targetCalories)} kcal</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-xl bg-slate-800 p-4">
        <p className="text-xs uppercase text-slate-500">Comidas opcionales</p>
        <p className="mt-1 text-sm text-slate-400">
          Desayuno, almuerzo y cena siempre se muestran. Activa las que uses además.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {OPTIONAL_MEAL_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleOptionalMeal(type)}
              className={chipOnCard(profile.optionalMeals.includes(type))}
            >
              {MEAL_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="Editar perfil">
        <ProfileForm profileToEdit={profile} onDone={() => setIsEditing(false)} />
      </Modal>

      <Modal isOpen={isPhaseFormOpen} onClose={() => setIsPhaseFormOpen(false)} title="Nueva fase">
        <PhaseForm profile={profile} activePhase={activePhase} onDone={() => setIsPhaseFormOpen(false)} />
      </Modal>
    </section>
  )
}
