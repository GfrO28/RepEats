import { firebaseFoodRepository } from '@/data/firestore/foodRepository'
import type { Food } from '@/repositories/FoodRepository'

// Estrella para marcar/desmarcar un alimento como favorito (se guarda al instante, sin abrir ningún formulario)
export function FavoriteStar({ food }: { food: Food }) {
  return (
    <button
      type="button"
      aria-label={food.isFavorite ? `Quitar ${food.name} de favoritos` : `Marcar ${food.name} como favorito`}
      onClick={() => firebaseFoodRepository.setFavorite(food.id, !food.isFavorite)}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center text-2xl leading-none ${food.isFavorite ? 'text-amber-400' : 'text-slate-600'}`}
    >
      {food.isFavorite ? '★' : '☆'}
    </button>
  )
}
