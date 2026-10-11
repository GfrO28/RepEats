import { useState } from 'react'
import { DiaryPage } from './DiaryPage'
import { FoodLibraryPage } from './FoodLibraryPage'
import { PlanPage } from './PlanPage'
import { WeightPage } from './WeightPage'
import { TabBar } from '@/app/TabBar'

type NutritionTab = 'diario' | 'alimentos' | 'peso' | 'plan'

const TABS: { id: NutritionTab; label: string }[] = [
  { id: 'diario', label: 'Diario' },
  { id: 'alimentos', label: 'Alimentos' },
  { id: 'peso', label: 'Peso' },
  { id: 'plan', label: 'Plan' },
]

export function NutritionPage() {
  const [tab, setTab] = useState<NutritionTab>('diario')

  return (
    <div>
      <TabBar label="Secciones de Nutrición" tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'diario' && <DiaryPage />}
      {tab === 'alimentos' && <FoodLibraryPage />}
      {tab === 'peso' && <WeightPage />}
      {tab === 'plan' && <PlanPage />}
    </div>
  )
}
