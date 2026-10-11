import { useState, type ChangeEvent } from 'react'
import { formatNumberText, isValidNumberText, parseNumberText } from '@/domain/numberInput'

interface NumberFieldProps {
  id?: string // para asociarlo con su <label htmlFor>
  value: number
  onChange: (value: number) => void
  allowDecimals?: boolean
  className?: string
  ariaLabel?: string
}

// Campo numérico que mientras escribes guarda el TEXTO: al borrar queda vacío (no aparece un 0 pegado)
// y al tocarlo se selecciona todo, así que escribir reemplaza el valor anterior.
// Hacia afuera entrega siempre un número (vacío = 0).
export function NumberField({ id, value, onChange, allowDecimals = true, className, ariaLabel }: NumberFieldProps) {
  const [text, setText] = useState(() => formatNumberText(value))

  // Si el valor cambia desde fuera (no por lo que se está escribiendo), el texto lo sigue
  if (parseNumberText(text) !== value) setText(formatNumberText(value))

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value
    if (!isValidNumberText(next, allowDecimals)) return // se ignoran letras y signos
    setText(next)
    onChange(parseNumberText(next))
  }

  return (
    <input
      id={id}
      type="text"
      inputMode={allowDecimals ? 'decimal' : 'numeric'}
      value={text}
      onChange={handleChange}
      onFocus={(event) => event.target.select()}
      onBlur={() => setText(formatNumberText(value))} // limpia ceros a la izquierda ("05" -> "5")
      placeholder="0"
      aria-label={ariaLabel}
      className={className}
    />
  )
}
