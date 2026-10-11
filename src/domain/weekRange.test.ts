import { describe, it, expect } from 'vitest'
import { getCurrentWeekRange } from './weekRange'

function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

describe('getCurrentWeekRange', () => {
  it('un miércoles cae en la semana de lunes a domingo que lo contiene', () => {
    const { start, end } = getCurrentWeekRange(new Date(2026, 2, 4)) // miércoles 4 de marzo

    expect(localDateString(start)).toBe('2026-03-02')
    expect(localDateString(end)).toBe('2026-03-08')
  })

  it('un domingo cae en la MISMA semana que ya terminó, no en la siguiente', () => {
    const { start, end } = getCurrentWeekRange(new Date(2026, 2, 8)) // domingo 8 de marzo

    expect(localDateString(start)).toBe('2026-03-02')
    expect(localDateString(end)).toBe('2026-03-08')
  })
})

