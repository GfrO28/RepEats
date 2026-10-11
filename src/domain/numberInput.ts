// Números escritos a mano en un campo de texto.
// Se aceptan coma o punto como separador decimal (el teclado del celular en es-PE puede dar coma).

// ¿Es un texto que todavía puede llegar a ser un número? ("", "5", "5.", ".5" sí; "5a" no)
export function isValidNumberText(text: string, allowDecimals: boolean): boolean {
  return (allowDecimals ? /^\d*[.,]?\d*$/ : /^\d*$/).test(text)
}

// El texto vacío o un punto suelto cuentan como 0
export function parseNumberText(text: string): number {
  const normalized = text.replace(',', '.')
  if (normalized === '' || normalized === '.') return 0
  return Number(normalized)
}

// El 0 se muestra como campo vacío (con un "0" gris de guía): así, al escribir, no queda un cero delante
export function formatNumberText(value: number): string {
  return value === 0 ? '' : String(value)
}
