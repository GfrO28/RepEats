import { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NumberField } from './NumberField'

// Un padre que guarda un número, como hacen la sesión en vivo y el formulario de rutinas
function Harness({ initial, allowDecimals = true }: { initial: number; allowDecimals?: boolean }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <NumberField value={value} onChange={setValue} allowDecimals={allowDecimals} ariaLabel="cantidad" />
      <p data-testid="value">{value}</p>
    </>
  )
}

const field = () => screen.getByLabelText('cantidad') as HTMLInputElement

describe('NumberField', () => {
  it('muestra el valor inicial', () => {
    render(<Harness initial={60} />)
    expect(field().value).toBe('60')
  })

  it('un valor 0 se muestra vacío, con el 0 solo como guía', () => {
    render(<Harness initial={0} />)
    expect(field().value).toBe('')
    expect(field().placeholder).toBe('0')
  })

  it('al borrar todo el campo queda vacío, sin un 0 pegado', async () => {
    const user = userEvent.setup()
    render(<Harness initial={60} />)

    await user.clear(field())
    expect(field().value).toBe('')
    expect(screen.getByTestId('value').textContent).toBe('0') // hacia afuera vale 0
  })

  it('después de borrar, escribir un número no deja un cero delante', async () => {
    const user = userEvent.setup()
    render(<Harness initial={60} />)

    await user.clear(field())
    await user.type(field(), '75')
    expect(field().value).toBe('75')
    expect(screen.getByTestId('value').textContent).toBe('75')
  })

  it('al tocar el campo se selecciona el contenido, así que escribir lo reemplaza', async () => {
    const user = userEvent.setup()
    render(<Harness initial={60} />)

    await user.click(field())
    await user.keyboard('8')
    expect(field().value).toBe('8')
  })

  it('acepta decimales con punto o con coma', async () => {
    const user = userEvent.setup()
    render(<Harness initial={0} />)

    await user.type(field(), '2,5')
    expect(field().value).toBe('2,5')
    expect(screen.getByTestId('value').textContent).toBe('2.5')
  })

  it('ignora letras y signos', async () => {
    const user = userEvent.setup()
    render(<Harness initial={0} />)

    await user.type(field(), '1a-2')
    expect(field().value).toBe('12')
  })

  it('sin decimales no acepta el punto', async () => {
    const user = userEvent.setup()
    render(<Harness initial={0} allowDecimals={false} />)

    await user.type(field(), '8.5')
    expect(field().value).toBe('85')
  })

  it('al salir del campo limpia un cero a la izquierda', async () => {
    const user = userEvent.setup()
    render(<Harness initial={0} />)

    await user.type(field(), '05')
    await user.tab()
    expect(field().value).toBe('5')
  })
})
