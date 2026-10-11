import type { WeighIn } from '@/domain/weightTrend'

export interface WeighInRepository {
  // Los pesajes más recientes (la fecha 'YYYY-MM-DD' es también el id: un pesaje por día)
  subscribeWeighIns(onChange: (weighIns: WeighIn[]) => void): () => void
  // Crea el pesaje del día o reemplaza el que ya existía
  saveWeighIn(weighIn: WeighIn): void
  deleteWeighIn(date: string): void
}
