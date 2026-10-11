// Los campos numéricos del formulario se guardan como texto; Number('') da 0, así que hay que descartar el vacío aparte
export function isNonNegativeNumber(text: string): boolean {
  return text.trim() !== '' && Number(text) >= 0
}

export function isPositiveNumber(text: string): boolean {
  return text.trim() !== '' && Number(text) > 0
}
