import { useId, useState } from 'react'
import { firebaseFoodRepository } from '@/data/firestore/foodRepository'
import { openFoodFactsProductLookup } from '@/data/openFoodFacts/productLookup'
import type { Food } from '@/repositories/FoodRepository'
import { findFoodByBarcode, isValidBarcode } from '@/domain/foodLabel'
import {
  describeProductDataIssue,
  findProductDataIssue,
  type ProductLookupResult,
  type ScannedProduct,
} from '@/domain/openFoodFacts'
import { BarcodeScanner } from './BarcodeScanner'
import { FoodForm, type FoodPrefill } from './FoodForm'
import { primaryButton, secondaryButton } from '@/app/buttonStyles'
import { kcalText, proteinText, fatText, carbsText } from '@/app/macroStyles'

interface ScanFoodFlowProps {
  foods: readonly Food[]
  // El alimento del producto escaneado: uno que ya tenías (alreadySaved) o uno recién guardado
  onResolved: (food: Food, alreadySaved: boolean) => void
}

type Step =
  | { name: 'scan' }
  | { name: 'looking'; code: string }
  | { name: 'result'; code: string; lookup: ProductLookupResult }
  | { name: 'form'; prefill: FoodPrefill }

const inputClass = 'w-full rounded bg-slate-800 px-3 py-2 text-sm'
const round1 = (value: number) => Math.round(value * 10) / 10

function prefillFromProduct(code: string, product: ScannedProduct | null): FoodPrefill {
  return {
    name: product?.name ?? '',
    brand: product?.brand ?? null,
    barcode: code,
    values: product?.partial ?? {},
    servingGrams: product?.servingGrams ?? null,
  }
}

export function ScanFoodFlow({ foods, onResolved }: ScanFoodFlowProps) {
  const fieldId = useId()
  const [step, setStep] = useState<Step>({ name: 'scan' })
  const [manualCode, setManualCode] = useState('')
  const [cameraMessage, setCameraMessage] = useState<string | null>(null)
  const [codeMessage, setCodeMessage] = useState<string | null>(null)

  async function handleCode(rawCode: string) {
    const code = rawCode.trim()
    if (!isValidBarcode(code)) {
      setCodeMessage(`El código ${code} no es válido. Prueba de nuevo o escríbelo a mano.`)
      setStep({ name: 'scan' })
      return
    }
    setCodeMessage(null)

    // Primero lo que ya tienes: funciona sin conexión y es tu dato verificado
    const existing = findFoodByBarcode(foods, code)
    if (existing) {
      onResolved(existing, true)
      return
    }

    setStep({ name: 'looking', code })
    const lookup = await openFoodFactsProductLookup.findByBarcode(code)
    setStep({ name: 'result', code, lookup })
  }

  function saveFromOpenFoodFacts(product: ScannedProduct) {
    if (product.per100g === null) return
    const food: Food = {
      id: firebaseFoodRepository.generateFoodId(),
      name: product.name,
      brand: product.brand,
      barcode: product.barcode,
      source: 'openFoodFacts',
      per100g: product.per100g,
      unit: product.servingGrams !== null ? { label: 'porción', grams: product.servingGrams } : null,
      isFavorite: false,
      useCount: 0,
      useCountByMeal: {},
      lastUsedAt: null,
      recipe: null,
      isPreparedDish: false,
    }
    firebaseFoodRepository.addFood(food)
    onResolved(food, false)
  }

  if (step.name === 'form') {
    return (
      <FoodForm
        foods={foods}
        foodToEdit={null}
        prefill={step.prefill}
        onDone={() => undefined}
        onSaved={(food) => onResolved(food, false)}
      />
    )
  }

  if (step.name === 'looking') {
    return <p className="py-6 text-center text-sm text-slate-400">Buscando el código {step.code} en Open Food Facts…</p>
  }

  if (step.name === 'result') {
    const { code, lookup } = step
    const product = lookup.status === 'found' ? lookup.product : null
    const issue = product?.per100g ? findProductDataIssue(product.per100g) : null
    const canSaveAsIs = product !== null && product.per100g !== null && product.name !== '' && issue === null

    return (
      <div className="flex flex-col gap-4">
        {lookup.status === 'error' && (
          <p className="text-sm text-amber-400">
            No se pudo consultar Open Food Facts (sin conexión o no responde). Puedes reintentar o ingresar los datos de la
            etiqueta.
          </p>
        )}
        {lookup.status === 'notFound' && (
          <p className="text-sm text-slate-300">
            Open Food Facts no conoce el código {code}. Copia los datos de la etiqueta del producto.
          </p>
        )}
        {product && product.per100g === null && (
          <p className="text-sm text-slate-300">
            Open Food Facts conoce este producto ({product.name || 'sin nombre'}), pero le faltan valores nutricionales.
            Completa los que faltan con la etiqueta.
          </p>
        )}

        {product && product.per100g !== null && (
          <div className="rounded-xl bg-slate-800 p-3">
            <p className="font-medium">{product.name || 'Producto sin nombre'}</p>
            {product.brand && <p className="text-xs text-slate-400">{product.brand}</p>}
            <p className="mt-1 text-sm">
              <span className={kcalText}>{Math.round(product.per100g.kcal)} kcal</span>
              {' · '}
              <span className={proteinText}>P {round1(product.per100g.proteinG)}</span>
              {' · '}
              <span className={fatText}>G {round1(product.per100g.fatG)}</span>
              {' · '}
              <span className={carbsText}>C {round1(product.per100g.carbsG)}</span> (por 100 g)
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Fuente: Open Food Facts, una base colaborativa. Compara con la etiqueta del producto antes de guardar.
            </p>
          </div>
        )}
        {issue && product?.per100g && (
          <p className="text-sm text-amber-400">
            {describeProductDataIssue(issue, product.per100g)} Corrígelo con la etiqueta.
          </p>
        )}
        {product && product.per100g !== null && product.name === '' && issue === null && (
          <p className="text-sm text-slate-300">Al producto le falta el nombre: agrégalo en el formulario.</p>
        )}

        <div className="flex flex-col gap-2">
          {canSaveAsIs && product && (
            <button
              type="button"
              onClick={() => saveFromOpenFoodFacts(product)}
              className={primaryButton}
            >
              Guardar tal como está
            </button>
          )}
          <button
            type="button"
            onClick={() => setStep({ name: 'form', prefill: prefillFromProduct(code, product) })}
            className={canSaveAsIs ? secondaryButton : primaryButton}
          >
            {canSaveAsIs ? 'Corregir con la etiqueta' : 'Ingresar desde la etiqueta'}
          </button>
          {lookup.status === 'error' && (
            <button
              type="button"
              onClick={() => void handleCode(code)}
              className={secondaryButton}
            >
              Reintentar
            </button>
          )}
          <button
            type="button"
            onClick={() => setStep({ name: 'scan' })}
            className={secondaryButton}
          >
            Escanear otro
          </button>
        </div>
      </div>
    )
  }

  // step.name === 'scan'
  return (
    <div className="flex flex-col gap-4">
      {cameraMessage ? (
        <p className="text-sm text-amber-400">{cameraMessage} Puedes escribir el código a mano.</p>
      ) : (
        <>
          <BarcodeScanner onScan={(code) => void handleCode(code)} onCameraError={setCameraMessage} />
          <p className="text-xs text-slate-500">Apunta la cámara al código de barras del producto.</p>
        </>
      )}
      {codeMessage && <p className="text-sm text-amber-400">{codeMessage}</p>}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void handleCode(manualCode)
        }}
        className="flex flex-col gap-2"
      >
        <label htmlFor={`${fieldId}-1`} className="text-xs text-slate-500">O escribe el código</label>
        <div className="flex gap-2">
          <input id={`${fieldId}-1`}
            inputMode="numeric"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
            placeholder="7750182007269"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={manualCode === ''}
            className={primaryButton}
          >
            Buscar
          </button>
        </div>
      </form>
    </div>
  )
}
