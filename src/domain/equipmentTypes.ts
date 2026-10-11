export const EQUIPMENT_TYPES = [
  'Mancuernas',
  'Cuerda para saltar',
  'Kettlebell',
  'Cajón pliométrico',
  'Banco',
  'Peso corporal',
  'Polea',
  'Barra Z',
  'Barra olímpica',
  'Barra',
  'Máquina',
  'Máquina Smith',
  'Máquina de palanca',
] as const
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number]
