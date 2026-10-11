export const SET_TYPES = ['Normal', 'Calentamiento', 'Al Fallo', 'Drop Set'] as const
export type SetTypes = (typeof SET_TYPES)[number]

// Abreviatura corta para mostrar en la sesión en vivo
export const SET_TYPE_ABBREVIATIONS: Record<SetTypes, string> = {
  Normal: 'N',
  Calentamiento: 'C',
  'Al Fallo': 'F',
  'Drop Set': 'DS',
}
