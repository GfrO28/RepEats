import type { Food } from '@/repositories/FoodRepository'

// Etiqueta para distinguir una receta propia de un alimento con el mismo nombre
export function RecipeBadge({ food }: { food: Food }) {
  if (!food.recipe) return null
  return <span className="ml-2 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300">Receta</span>
}
