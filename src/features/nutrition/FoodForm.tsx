import { useId, useState, type FormEvent } from 'react'
import { firebaseFoodRepository } from '@/data/firestore/foodRepository'
import type { Food } from '@/repositories/FoodRepository'
import { isNonNegativeNumber, isPositiveNumber } from '@/domain/inputValidation'
import { isKcalConsistent, type NutritionValues } from '@/domain/foodNutrition'
import { convertLabelToPer100g, findFoodByBarcode, isValidBarcode } from '@/domain/foodLabel'
import { chip, primaryButton } from '@/app/buttonStyles'
import { kcalText, proteinText, fatText, carbsText } from '@/app/macroStyles'

// Datos para precargar un alimento nuevo (p. ej. lo que trajo el escáner); los valores ya vienen por 100 g
export interface FoodPrefill {
  name: string
  brand: string | null
  barcode: string | null
  values: Partial<NutritionValues>
  servingGrams: number | null
}

interface FoodFormProps {
  foods: readonly Food[] // para avisar de un código de barras repetido
  foodToEdit: Food | null
  prefill?: FoodPrefill | null // solo para alimentos nuevos
  onDone: () => void
  onSaved?: (food: Food) => void // recibe el alimento guardado (antes de onDone)
}

// La etiqueta puede dar los valores por 100 g o por porción; en la base siempre se guardan por 100 g
type LabelBasis = 'per100g' | 'perServing'

const inputClass = 'w-full rounded bg-slate-800 px-3 py-2 text-sm'
const round1 = (value: number) => Math.round(value * 10) / 10

export function FoodForm({ foods, foodToEdit, prefill = null, onDone, onSaved }: FoodFormProps) {
  const fieldId = useId()
  const initial = foodToEdit ? null : prefill
  const [name, setName] = useState(foodToEdit?.name ?? initial?.name ?? '')
  const [brand, setBrand] = useState(foodToEdit?.brand ?? initial?.brand ?? '')
  const [barcode, setBarcode] = useState(foodToEdit?.barcode ?? initial?.barcode ?? '')
  // Al editar, los valores guardados ya son por 100 g
  const [basis, setBasis] = useState<LabelBasis>('per100g')
  const [servingGrams, setServingGrams] = useState('')
  const initialValues = foodToEdit?.per100g ?? initial?.values ?? {}
  const [kcal, setKcal] = useState(initialValues.kcal === undefined ? '' : String(initialValues.kcal))
  const [proteinG, setProteinG] = useState(initialValues.proteinG === undefined ? '' : String(initialValues.proteinG))
  const [fatG, setFatG] = useState(initialValues.fatG === undefined ? '' : String(initialValues.fatG))
  const [carbsG, setCarbsG] = useState(initialValues.carbsG === undefined ? '' : String(initialValues.carbsG))
  const initialUnit = foodToEdit?.unit ?? (initial?.servingGrams ? { label: 'porción', grams: initial.servingGrams } : null)
  const [unitLabel, setUnitLabel] = useState(initialUnit?.label ?? '')
  const [unitGrams, setUnitGrams] = useState(initialUnit ? String(initialUnit.grams) : '')

  const areValuesValid =
    isNonNegativeNumber(kcal) && isNonNegativeNumber(proteinG) && isNonNegativeNumber(fatG) && isNonNegativeNumber(carbsG)
  const isServingValid = basis === 'per100g' || isPositiveNumber(servingGrams)

  // Lo que se guarda: los valores por 100 g (convertidos si la etiqueta era por porción)
  const enteredValues: NutritionValues = {
    kcal: Number(kcal),
    proteinG: Number(proteinG),
    fatG: Number(fatG),
    carbsG: Number(carbsG),
  }
  const canCalculate = areValuesValid && isServingValid
  const per100g = canCalculate
    ? basis === 'perServing'
      ? convertLabelToPer100g(enteredValues, Number(servingGrams))
      : enteredValues
    : null

  const macrosTotal = per100g ? per100g.proteinG + per100g.fatG + per100g.carbsG : 0
  const macrosExceedLimit = macrosTotal > 100
  const isKcalMismatch = per100g !== null && !macrosExceedLimit && !isKcalConsistent(per100g)

  // Unidad opcional: o ambos campos vacíos, o ambos completos (nombre y gramos mayores que 0)
  const isUnitValid =
    (unitLabel.trim() === '' && unitGrams.trim() === '') || (unitLabel.trim() !== '' && Number(unitGrams) > 0)

  // El código es opcional, pero si se escribe debe ser un código real (el dígito de control atrapa los errores de tecleo)
  const isBarcodeValid = barcode === '' || isValidBarcode(barcode)
  const duplicatedByBarcode = findFoodByBarcode(foods, barcode, foodToEdit?.id ?? null)

  const isValid =
    name.trim() !== '' && per100g !== null && !macrosExceedLimit && isUnitValid && isBarcodeValid

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isValid || per100g === null) return

    // Si la etiqueta era por porción y no se definió una unidad, la porción de la etiqueta pasa a ser la unidad
    let unit = unitLabel.trim() === '' ? null : { label: unitLabel.trim(), grams: Number(unitGrams) }
    if (unit === null && basis === 'perServing') unit = { label: 'porción', grams: Number(servingGrams) }

    const cleanBrand = brand.trim() === '' ? null : brand.trim()
    const cleanBarcode = barcode === '' ? null : barcode

    const food: Food = {
      id: foodToEdit ? foodToEdit.id : firebaseFoodRepository.generateFoodId(),
      name: name.trim(),
      brand: cleanBrand,
      barcode: cleanBarcode,
      // Con marca o código es un producto envasado copiado de su etiqueta; si no, un alimento a mano
      source: foodToEdit?.source ?? (cleanBrand !== null || cleanBarcode !== null ? 'label' : 'manual'),
      per100g,
      unit,
      isFavorite: foodToEdit?.isFavorite ?? false,
      useCount: foodToEdit?.useCount ?? 0,
      useCountByMeal: foodToEdit?.useCountByMeal ?? {},
      lastUsedAt: foodToEdit?.lastUsedAt ?? null,
      recipe: null, // las recetas se editan en su propio formulario
      isPreparedDish: foodToEdit?.isPreparedDish ?? false,
    }

    if (foodToEdit) {
      firebaseFoodRepository.updateFood(food)
    } else {
      firebaseFoodRepository.addFood(food)
    }

    onSaved?.(food)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col">
        <label htmlFor={`${fieldId}-1`} className="text-xs text-slate-500">Nombre</label>
        <input id={`${fieldId}-1`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej.: Leche entera"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col">
          <label htmlFor={`${fieldId}-2`} className="text-xs text-slate-500">Marca (opcional)</label>
          <input id={`${fieldId}-2`} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ej.: Gloria" className={inputClass} />
        </div>
        <div className="flex flex-col">
          <label htmlFor={`${fieldId}-3`} className="text-xs text-slate-500">Código de barras (opcional)</label>
          <input id={`${fieldId}-3`}
            inputMode="numeric"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ''))}
            placeholder="7750182007269"
            className={inputClass}
          />
        </div>
      </div>
      {!isBarcodeValid && (
        <p className="text-xs text-amber-400">
          Ese código no es válido (deben ser 8, 12, 13 o 14 dígitos con su dígito de control). Revisa que esté bien tecleado.
        </p>
      )}
      {duplicatedByBarcode && (
        <p className="text-xs text-amber-400">Ya tienes "{duplicatedByBarcode.name}" con este mismo código. Puedes guardarlo igual.</p>
      )}

      <div>
        <p className="text-xs uppercase text-slate-500">La etiqueta indica los valores</p>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(['per100g', 'perServing'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setBasis(option)}
              aria-pressed={basis === option}
              className={`${chip(basis === option)} justify-center`}
            >
              {option === 'per100g' ? 'Por 100 g' : 'Por porción'}
            </button>
          ))}
        </div>
      </div>

      {basis === 'perServing' && (
        <div className="flex flex-col">
          <label htmlFor={`${fieldId}-4`} className="text-xs text-slate-500">Tamaño de la porción (g)</label>
          <input id={`${fieldId}-4`}
            type="number"
            inputMode="decimal"
            value={servingGrams}
            onChange={(e) => setServingGrams(e.target.value)}
            placeholder="30"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-500">
            Lo dice la etiqueta ("porción de 30 g"). Si es un líquido en ml, escribe los mismos números en g.
          </p>
        </div>
      )}

      <p className="text-xs uppercase text-slate-500">
        {basis === 'per100g' ? 'Valores por 100 g' : 'Valores por porción'}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col">
          <label htmlFor={`${fieldId}-5`} className="text-xs text-slate-500">Calorías (kcal)</label>
          <input id={`${fieldId}-5`} type="number" value={kcal} onChange={(e) => setKcal(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col">
          <label htmlFor={`${fieldId}-6`} className="text-xs text-slate-500">Proteína (g)</label>
          <input id={`${fieldId}-6`} type="number" step="0.1" value={proteinG} onChange={(e) => setProteinG(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col">
          <label htmlFor={`${fieldId}-7`} className="text-xs text-slate-500">Grasa (g)</label>
          <input id={`${fieldId}-7`} type="number" step="0.1" value={fatG} onChange={(e) => setFatG(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col">
          <label htmlFor={`${fieldId}-8`} className="text-xs text-slate-500">Carbohidratos (g)</label>
          <input id={`${fieldId}-8`} type="number" step="0.1" value={carbsG} onChange={(e) => setCarbsG(e.target.value)} className={inputClass} />
        </div>
      </div>
      {macrosExceedLimit && (
        <p className="text-xs text-amber-400">
          Proteína, grasa y carbohidratos no pueden sumar más de 100 g por cada 100 g de alimento.
          {basis === 'perServing' && ' Revisa el tamaño de la porción.'}
        </p>
      )}
      {isKcalMismatch && (
        <p className="text-xs text-amber-400">
          Las kcal no coinciden con lo que suman los macros. Revisa que hayas copiado bien la etiqueta; puedes guardarlo
          igual.
        </p>
      )}
      {basis === 'perServing' && per100g && (
        <div className="rounded-xl bg-slate-800 p-3">
          <p className="text-xs text-slate-500">Se guardará por 100 g</p>
          <p className="text-sm">
            <span className={kcalText}>{Math.round(per100g.kcal)} kcal</span>
            {' · '}
            <span className={proteinText}>P {round1(per100g.proteinG)}</span>
            {' · '}
            <span className={fatText}>G {round1(per100g.fatG)}</span>
            {' · '}
            <span className={carbsText}>C {round1(per100g.carbsG)}</span>
          </p>
        </div>
      )}

      <p className="text-xs uppercase text-slate-500">Unidad (opcional)</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col">
          <label htmlFor={`${fieldId}-9`} className="text-xs text-slate-500">Nombre de la unidad</label>
          <input id={`${fieldId}-9`} value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} placeholder="huevo" className={inputClass} />
        </div>
        <div className="flex flex-col">
          <label htmlFor={`${fieldId}-10`} className="text-xs text-slate-500">Gramos por unidad</label>
          <input id={`${fieldId}-10`}
            type="number"
            value={unitGrams}
            onChange={(e) => setUnitGrams(e.target.value)}
            placeholder="50"
            className={inputClass}
          />
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Ej.: huevo = 50 g. Si la completas, podrás registrar "2 huevos" en el diario.
        {basis === 'perServing' && ' Si la dejas vacía, la porción de la etiqueta se guarda como unidad.'}
      </p>

      <button
        type="submit"
        disabled={!isValid}
        className={primaryButton}
      >
        {foodToEdit ? 'Guardar cambios' : 'Crear alimento'}
      </button>
    </form>
  )
}
