import { useEffect, useState } from 'react'
import { firebaseDiaryRepository } from '@/data/firestore/diaryRepository'
import { firebaseFoodRepository } from '@/data/firestore/foodRepository'
import { firebasePhaseRepository } from '@/data/firestore/phaseRepository'
import { firebaseProfileRepository } from '@/data/firestore/profileRepository'
import { firebaseRoutineRepository } from '@/data/firestore/routineRepository'
import { firebaseSavedMealRepository } from '@/data/firestore/savedMealRepository'
import { firebaseSessionRepository } from '@/data/firestore/sessionRepository'
import type { DiaryDay, DiaryItem } from '@/repositories/DiaryRepository'
import type { Routine } from '@/repositories/RoutineRepository'
import type { SavedMeal } from '@/repositories/SavedMealRepository'
import type { Food } from '@/repositories/FoodRepository'
import type { Phase } from '@/repositories/PhaseRepository'
import type { Profile } from '@/repositories/ProfileRepository'
import type { Session } from '@/repositories/SessionRepository'
import { resolveDayExerciseKcal } from '@/domain/exerciseCalories'
import { calculateBmr } from '@/domain/energyExpenditure'
import { resolveTdee } from '@/domain/adaptiveTdee'
import { resolvePhaseTargets, distributeMealTargets } from '@/domain/nutritionGoals'
import { resolveMealTimes } from '@/domain/mealSchedule'
import { getDayOfWeek, getTrainingTimeForDay } from '@/domain/routineSchedule'
import { MEAL_TYPE_LABELS, type MealType } from '@/domain/mealTypes'
import {
  createEmptyDay,
  getVisibleMealTypes,
  getAddableMealTypes,
  addMealToDay,
  removeMealFromDay,
  addItemToDay,
  addItemsToDay,
  copyDayInto,
  getMealItems,
  removeItemFromDay,
  replaceItemInDay,
  calculateDayTotals,
} from '@/domain/diary'
import { createSavedMeal, updateSavedMeal } from '@/domain/savedMeals'
import { toLocalDateString, parseLocalDate, addDaysToLocalDate } from '@/domain/localDate'
import { Modal } from '@/app/Modal'
import { DayTotals } from './DayTotals'
import { MealSection } from './MealSection'
import { AddItemForm } from './AddItemForm'
import { MealTimePicker } from './MealTimePicker'
import { CopyFromDayForm, type CopyScope } from './CopyFromDayForm'
import { SaveMealForm } from './SaveMealForm'
import { chip, iconButton, linkButton } from '@/app/buttonStyles'

export function DiaryPage() {
  const [date, setDate] = useState(() => toLocalDateString(new Date()))
  // Se guarda junto con su fecha: al cambiar de día no se muestra por un instante el día anterior
  const [dayState, setDayState] = useState<{ date: string; day: DiaryDay | null } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [phases, setPhases] = useState<Phase[]>([])
  const [foods, setFoods] = useState<Food[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [addingTo, setAddingTo] = useState<MealType | null>(null)
  const [editingItem, setEditingItem] = useState<{ type: MealType; index: number } | null>(null)
  const [isAddMealOpen, setIsAddMealOpen] = useState(false)
  const [editingMealTime, setEditingMealTime] = useState<MealType | null>(null)
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([])
  // Comida sobre la que se está copiando de otro día, o guardando como comida
  const [copyingTo, setCopyingTo] = useState<MealType | null>(null)
  const [savingFrom, setSavingFrom] = useState<MealType | null>(null)
  const [editingSavedMeal, setEditingSavedMeal] = useState<SavedMeal | null>(null)

  useEffect(() => {
    const unsubscribe = firebaseDiaryRepository.subscribeDay(date, (day) => setDayState({ date, day }))
    return unsubscribe
  }, [date])

  useEffect(() => {
    const unsubscribe = firebaseSavedMealRepository.subscribeSavedMeals(setSavedMeals)
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = firebaseProfileRepository.subscribeProfile(setProfile)
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = firebasePhaseRepository.subscribePhases(setPhases)
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = firebaseFoodRepository.subscribeFoods(setFoods)
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = firebaseSessionRepository.subscribeSessions(setSessions)
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = firebaseRoutineRepository.subscribeRoutines(setRoutines)
    return unsubscribe
  }, [])

  const isLoaded = dayState !== null && dayState.date === date
  const day = isLoaded ? dayState.day : null
  const currentDay = day ?? createEmptyDay(date)

  const optionalMeals = profile?.optionalMeals ?? []
  const visibleMealTypes = getVisibleMealTypes(currentDay, optionalMeals)
  const addableMealTypes = getAddableMealTypes(currentDay, optionalMeals)
  const totals = calculateDayTotals(currentDay)

  const activePhase = phases.find((phase) => phase.endDate === null) ?? null
  // Una transición cambia de objetivo cada semana: se usa el del día que se está viendo
  const phaseTargets = activePhase ? resolvePhaseTargets(activePhase, date) : null
  const target = phaseTargets ? { kcal: phaseTargets.targetCalories, macros: phaseTargets.macros } : null
  // Reparto del objetivo del día entre las comidas que se ven hoy; sin fase activa, ninguna comida tiene objetivo
  const mealTargets = target ? distributeMealTargets(target, visibleMealTypes) : null

  // Hora de cada comida: la que el usuario eligió ese día, o si no, una tentativa a partir de la comida
  // anterior (y de la hora de entreno de la rutina sugerida ese día de la semana, si tiene una configurada)
  const trainingTime = getTrainingTimeForDay(routines, getDayOfWeek(parseLocalDate(date)))
  const mealTimes = resolveMealTimes(visibleMealTypes, currentDay.mealTimes, trainingTime)

  // Informativo: nunca se suma al objetivo (el ajuste adaptativo del gasto ya refleja tu actividad real)
  const exerciseKcal = profile ? resolveDayExerciseKcal(sessions, date, profile.weightKg) : 0

  // El velocímetro de calorías necesita el TDEE: define dónde empieza de verdad el superávit (ver DayTotals)
  const tdee = profile ? resolveTdee(calculateBmr(profile), profile.activityLevel, profile.adaptiveTdee) : 0

  const today = toLocalDateString(new Date())
  const dateLabel = parseLocalDate(date).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })

  // Cada cambio se guarda como un día completo (sin await: la UI se actualiza desde la caché local)
  function saveDay(updated: DiaryDay) {
    firebaseDiaryRepository.saveDay(updated)
  }

  function handleAddItem(item: DiaryItem) {
    if (addingTo === null) return
    saveDay(addItemToDay(currentDay, addingTo, item))
    setAddingTo(null)
  }

  function handleEditItem(item: DiaryItem) {
    if (editingItem === null) return
    saveDay(replaceItemInDay(currentDay, editingItem.type, editingItem.index, item))
    setEditingItem(null)
  }

  // Copiar de otro día: solo la comida desde la que se abrió, o el día completo
  function handleCopy(source: DiaryDay, scope: CopyScope) {
    if (copyingTo === null) return
    saveDay(scope === 'meal' ? addItemsToDay(currentDay, copyingTo, getMealItems(source, copyingTo)) : copyDayInto(currentDay, source))
    setCopyingTo(null)
  }

  // Se usa desde la categoría "Guardados" del propio buscador al agregar un alimento (no al editar uno ya registrado)
  function handleUseSavedMeal(meal: SavedMeal) {
    if (addingTo === null) return
    saveDay(addItemsToDay(currentDay, addingTo, meal.items))
    setAddingTo(null)
  }

  function handleDeleteSavedMeal(meal: SavedMeal) {
    if (window.confirm(`¿Eliminar la comida guardada "${meal.name}"? Lo ya registrado en el diario no cambia.`)) {
      firebaseSavedMealRepository.deleteSavedMeal(meal.id)
    }
  }

  function handleSaveMeal(name: string, items: DiaryItem[]) {
    if (savingFrom === null) return
    const meal = createSavedMeal(firebaseSavedMealRepository.generateSavedMealId(), name, items)
    firebaseSavedMealRepository.addSavedMeal(meal)
    setSavingFrom(null)
  }

  function handleUpdateSavedMeal(name: string, items: DiaryItem[]) {
    if (editingSavedMeal === null) return
    firebaseSavedMealRepository.updateSavedMeal(updateSavedMeal(editingSavedMeal, name, items))
    setEditingSavedMeal(null)
  }

  function handleAddMeal(type: MealType) {
    saveDay(addMealToDay(currentDay, type))
    setIsAddMealOpen(false)
  }

  function handleAcceptMealTime(type: MealType, time: string) {
    saveDay({ ...currentDay, mealTimes: { ...currentDay.mealTimes, [type]: time } })
    setEditingMealTime(null)
  }

  return (
    <section className="px-4 py-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setDate(addDaysToLocalDate(date, -1))}
          aria-label="Día anterior"
          className={`${iconButton} bg-slate-800`}
        >
          ‹
        </button>
        <div className="text-center">
          <p className="font-semibold capitalize">{dateLabel}</p>
          {date === today ? (
            <p className="text-xs text-primary">Hoy</p>
          ) : (
            <button type="button" onClick={() => setDate(today)} className={linkButton}>
              Ir a hoy
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDate(addDaysToLocalDate(date, 1))}
          aria-label="Día siguiente"
          className={`${iconButton} bg-slate-800`}
        >
          ›
        </button>
      </div>

      {isLoaded && (
        <>
          <div className="mt-2">
            <DayTotals totals={totals} target={target} tdee={tdee} exerciseKcal={exerciseKcal} />
          </div>

          {visibleMealTypes.map((type) => {
            const meal = currentDay.meals.find((m) => m.type === type)
            return (
              <MealSection
                key={type}
                type={type}
                items={meal ? meal.items : []}
                target={mealTargets ? mealTargets[type] : null}
                time={mealTimes[type] ?? null}
                onAddItem={() => setAddingTo(type)}
                onEditItem={(index) => setEditingItem({ type, index })}
                onRemoveItem={(index) => saveDay(removeItemFromDay(currentDay, type, index))}
                onRemoveMeal={() => saveDay(removeMealFromDay(currentDay, type))}
                onCopyFromDay={() => setCopyingTo(type)}
                onSaveAsMeal={() => setSavingFrom(type)}
              />
            )
          })}

          {addableMealTypes.length > 0 && (
            <button
              type="button"
              onClick={() => setIsAddMealOpen(true)}
              className="mt-4 min-h-11 w-full rounded-xl border border-dashed border-slate-700 px-4 py-2 text-sm text-slate-400"
            >
              + Agregar comida a este día
            </button>
          )}
        </>
      )}

      <Modal
        isOpen={addingTo !== null}
        onClose={() => setAddingTo(null)}
        title={addingTo ? `Agregar a ${MEAL_TYPE_LABELS[addingTo]}` : ''}
      >
        {addingTo && (
          <AddItemForm
            foods={foods}
            mealType={addingTo}
            mealTime={mealTimes[addingTo] ?? null}
            onEditMealTime={() => setEditingMealTime(addingTo)}
            savedMeals={savedMeals}
            onUseSavedMeal={handleUseSavedMeal}
            onEditSavedMeal={setEditingSavedMeal}
            onDeleteSavedMeal={handleDeleteSavedMeal}
            onAdd={handleAddItem}
          />
        )}
      </Modal>

      <Modal
        isOpen={editingItem !== null}
        onClose={() => setEditingItem(null)}
        title={editingItem ? `Editar en ${MEAL_TYPE_LABELS[editingItem.type]}` : ''}
      >
        {editingItem && (
          <AddItemForm
            foods={foods}
            mealType={editingItem.type}
            itemToEdit={getMealItems(currentDay, editingItem.type)[editingItem.index] ?? null}
            onAdd={handleEditItem}
          />
        )}
      </Modal>

      <Modal
        isOpen={copyingTo !== null}
        onClose={() => setCopyingTo(null)}
        title={copyingTo ? `Copiar a ${MEAL_TYPE_LABELS[copyingTo]}` : ''}
      >
        {copyingTo && <CopyFromDayForm targetDate={date} mealType={copyingTo} onCopy={handleCopy} />}
      </Modal>

      <Modal isOpen={savingFrom !== null} onClose={() => setSavingFrom(null)} title="Guardar como comida">
        {savingFrom && <SaveMealForm items={getMealItems(currentDay, savingFrom)} onSave={handleSaveMeal} />}
      </Modal>

      <Modal
        isOpen={editingSavedMeal !== null}
        onClose={() => setEditingSavedMeal(null)}
        title={editingSavedMeal ? `Editar "${editingSavedMeal.name}"` : ''}
      >
        {editingSavedMeal && (
          <SaveMealForm items={editingSavedMeal.items} mealToEdit={editingSavedMeal} onSave={handleUpdateSavedMeal} />
        )}
      </Modal>

      <Modal
        isOpen={editingMealTime !== null}
        onClose={() => setEditingMealTime(null)}
        title={editingMealTime ? `Hora de ${MEAL_TYPE_LABELS[editingMealTime]}` : ''}
      >
        {editingMealTime && (
          <MealTimePicker
            mealType={editingMealTime}
            resolvedTime={mealTimes[editingMealTime] ?? '00:00'}
            onAccept={(time) => handleAcceptMealTime(editingMealTime, time)}
          />
        )}
      </Modal>

      <Modal isOpen={isAddMealOpen} onClose={() => setIsAddMealOpen(false)} title="Agregar comida">
        <p className="text-sm text-slate-400">Se agrega solo a este día.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {addableMealTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleAddMeal(type)}
              className={chip(false)}
            >
              {MEAL_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </Modal>
    </section>
  )
}
