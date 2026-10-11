import type { Food } from '@/repositories/FoodRepository'
import type { MealType } from './mealTypes'
import { normalizeFoodName } from './foodImport'

// Con miles de alimentos no tiene sentido pintarlos todos: se muestran los primeros y se pide afinar
export const MAX_LIST_RESULTS = 50
export const MAX_RECENT_FOODS = 10

// Qué tan bien coincide un nombre con lo escrito (menor = mejor); null = no coincide
// 0: el nombre empieza con lo escrito ("lentejas g" -> "Lentejas grandes")
// 1: cada palabra escrita es el comienzo de alguna palabra del nombre ("grande lenteja" -> "Lentejas grandes")
// 2: cada palabra escrita aparece en algún lugar del nombre ("entej" -> "Lentejas")
function matchTier(normalizedName: string, normalizedQuery: string, queryWords: string[]): number | null {
  if (normalizedQuery === '' || normalizedName.startsWith(normalizedQuery)) return 0
  if (!queryWords.every((word) => normalizedName.includes(word))) return null

  const nameWords = normalizedName.split(/[^a-z0-9]+/)
  const isEveryWordAPrefix = queryWords.every((word) => nameWords.some((nameWord) => nameWord.startsWith(word)))
  return isEveryWordAPrefix ? 1 : 2
}

// Dentro del mismo nivel de coincidencia: favoritos primero, luego los más usados y, a igualdad, alfabético
function compareForPicker(a: { food: Food; tier: number }, b: { food: Food; tier: number }): number {
  if (a.tier !== b.tier) return a.tier - b.tier
  if (a.food.isFavorite !== b.food.isFavorite) return a.food.isFavorite ? -1 : 1
  if (a.food.useCount !== b.food.useCount) return b.food.useCount - a.food.useCount
  return a.food.name.localeCompare(b.food.name)
}

// Busca ignorando mayúsculas y tildes ("platano" encuentra "Plátano") y sin importar el orden de las palabras
// ("pollo arroz" encuentra "Arroz con pollo"). Texto vacío = todos, ordenados.
export function searchFoods(foods: readonly Food[], query: string): Food[] {
  const normalizedQuery = normalizeFoodName(query)
  const queryWords = normalizedQuery.split(' ').filter((word) => word !== '')

  return foods
    .flatMap((food) => {
      // La marca cuenta como parte del nombre ("gloria leche"); un código de barras completo coincide de una vez
      const tier =
        food.barcode !== null && food.barcode === query.trim()
          ? 0
          : matchTier(normalizeFoodName(`${food.name} ${food.brand ?? ''}`), normalizedQuery, queryWords)
      return tier === null ? [] : [{ food, tier }]
    })
    .sort(compareForPicker)
    .map((match) => match.food)
}

// Lo que se ofrece antes de escribir nada: los favoritos y los últimos alimentos usados
export function getQuickPicks(
  foods: readonly Food[],
  recentLimit: number = MAX_RECENT_FOODS,
): { favorites: Food[]; recents: Food[] } {
  const favorites = foods.filter((food) => food.isFavorite).sort((a, b) => a.name.localeCompare(b.name))

  // Un favorito no se repite en "Recientes"
  const recents = foods
    .filter((food) => !food.isFavorite && food.lastUsedAt !== null)
    .sort((a, b) => (b.lastUsedAt?.getTime() ?? 0) - (a.lastUsedAt?.getTime() ?? 0))
    .slice(0, recentLimit)

  return { favorites, recents }
}

// ── Categorías para "sectorizar" el buscador de alimentos (chips arriba de la lista) ──

export function getFavoriteFoods(foods: readonly Food[]): Food[] {
  return foods.filter((food) => food.isFavorite).sort((a, b) => a.name.localeCompare(b.name))
}

// Los que más se repiten en ESA comida en particular (p. ej. "Leche Gloria" en Desayuno), no en el diario entero:
// lo que se usa seguido al almuerzo no tiene por qué aparecer como frecuente al armar la cena.
export function getFrequentFoods(foods: readonly Food[], mealType: MealType, limit: number = MAX_RECENT_FOODS): Food[] {
  const countFor = (food: Food) => food.useCountByMeal[mealType] ?? 0
  return foods
    .filter((food) => countFor(food) > 0)
    .sort((a, b) => (countFor(b) !== countFor(a) ? countFor(b) - countFor(a) : a.name.localeCompare(b.name)))
    .slice(0, limit)
}

export function getRecipeFoods(foods: readonly Food[]): Food[] {
  return foods.filter((food) => food.recipe !== null).sort((a, b) => a.name.localeCompare(b.name))
}
