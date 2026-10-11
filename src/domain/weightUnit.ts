export type WeightUnit = 'kg' | 'lb'

const KG_PER_LB = 0.45359237

// Para mostrar/ingresar en libras lo que se guarda en kg (todo el resto de la app sigue trabajando en kg)
export function kgToLb(kg: number): number {
  return Math.round((kg / KG_PER_LB) * 10) / 10
}

export function lbToKg(lb: number): number {
  return Math.round(lb * KG_PER_LB * 100) / 100
}
