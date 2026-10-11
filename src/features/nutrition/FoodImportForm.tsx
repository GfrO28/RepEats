import { useState, type ChangeEvent } from 'react'
import { firebaseFoodRepository } from '@/data/firestore/foodRepository'
import type { Food } from '@/repositories/FoodRepository'
import { parseFoodImport, type ImportIssue } from '@/domain/foodImport'
import { primaryButton } from '@/app/buttonStyles'

interface FoodImportFormProps {
  existingFoods: Food[]
  onDone: () => void
}

function IssueList({ title, issues, tone }: { title: string; issues: ImportIssue[]; tone: string }) {
  if (issues.length === 0) return null

  return (
    <div>
      <p className={`text-sm font-medium ${tone}`}>
        {title} ({issues.length})
      </p>
      <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-slate-400">
        {issues.map((issue) => (
          <li key={`${issue.position}-${issue.message}`} className="py-0.5">
            #{issue.position} · {issue.name}: {issue.message}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function FoodImportForm({ existingFoods, onDone }: FoodImportFormProps) {
  const [text, setText] = useState('')

  // Se valida en cada render mientras el usuario pega o carga el archivo (derivado, sin estado extra)
  const result = text.trim() === '' ? null : parseFoodImport(text, existingFoods.map((food) => food.name))
  const canImport = result !== null && result.fatalError === null && result.foods.length > 0

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setText(await file.text())
    event.target.value = '' // permite volver a elegir el mismo archivo
  }

  function handleImport() {
    if (!result || !canImport) return

    // Los ids se generan aquí, en el cliente, igual que al crear un alimento a mano
    const foods: Food[] = result.foods.map((draft) => ({
      ...draft,
      id: firebaseFoodRepository.generateFoodId(),
      isFavorite: false,
      useCount: 0,
      useCountByMeal: {},
      lastUsedAt: null,
      recipe: null,
    }))
    firebaseFoodRepository.addFoods(foods)
    onDone()
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">
        Pega el JSON o carga un archivo. Los alimentos que ya existen (mismo nombre) se omiten.
      </p>

      <input
        type="file"
        accept=".json,application/json"
        aria-label="Archivo JSON con alimentos"
        onChange={handleFile}
        className="text-sm text-slate-400 file:mr-3 file:rounded-full file:border-0 file:bg-slate-800 file:px-4 file:py-1 file:text-sm file:text-slate-200"
      />

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        aria-label="JSON de alimentos"
        spellCheck={false}
        placeholder='{ "foods": [ { "name": "Arroz blanco cocido", "kcal": 130, "proteinG": 2.7, "fatG": 0.3, "carbsG": 28 } ] }'
        className="w-full rounded bg-slate-800 px-3 py-2 font-mono text-xs"
      />

      {result?.fatalError && <p className="text-sm text-amber-400">{result.fatalError}</p>}

      {result && result.fatalError === null && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-emerald-400">{result.foods.length} alimento(s) listos para importar</p>
          <IssueList title="Con errores (no se importan)" issues={result.errors} tone="text-amber-400" />
          <IssueList title="Omitidos por repetidos" issues={result.duplicates} tone="text-slate-300" />
          <IssueList title="Revisar (sí se importan)" issues={result.warnings} tone="text-slate-300" />
        </div>
      )}

      <button
        type="button"
        onClick={handleImport}
        disabled={!canImport}
        className={primaryButton}
      >
        {canImport ? `Importar ${result.foods.length} alimento(s)` : 'Importar'}
      </button>
    </div>
  )
}
