// "12 450 kg": redondeado y con separador de miles al estilo de Perú
export function formatKg(kg: number): string {
  return `${Math.round(kg).toLocaleString('es-PE')} kg`
}
