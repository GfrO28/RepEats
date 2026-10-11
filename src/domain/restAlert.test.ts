import { describe, it, expect } from 'vitest'
import {
  REST_BANNER_HIDE_AFTER_MS,
  REST_END_ALERT_GRACE_MS,
  getRestBannerHideDelayMs,
  shouldAlertRestEnd,
} from './restAlert'

const endsAt = new Date('2026-03-10T12:00:00.000Z')
const after = (ms: number) => new Date(endsAt.getTime() + ms)

describe('shouldAlertRestEnd', () => {
  it('avisa al pasar de "queda tiempo" a "terminó", justo al terminar', () => {
    expect(shouldAlertRestEnd(1, 0, endsAt, after(300))).toBe(true)
  })

  it('no avisa mientras todavía queda tiempo', () => {
    expect(shouldAlertRestEnd(10, 9, endsAt, after(-9000))).toBe(false)
    expect(shouldAlertRestEnd(2, 1, endsAt, after(-1000))).toBe(false)
  })

  it('no avisa dos veces: si ya estaba en 0 en la comprobación anterior', () => {
    expect(shouldAlertRestEnd(0, 0, endsAt, after(1300))).toBe(false)
  })

  it('no avisa si no había un descanso en curso antes (previo null) ni ahora (sin fin)', () => {
    expect(shouldAlertRestEnd(null, 0, endsAt, after(300))).toBe(false)
    expect(shouldAlertRestEnd(1, 0, null, after(300))).toBe(false)
  })

  it('no avisa cuando empieza un descanso nuevo (de 0 a mucho)', () => {
    expect(shouldAlertRestEnd(0, 60, endsAt, after(-60000))).toBe(false)
  })

  it('tolera hasta 5 s de retraso al notarlo, y no más', () => {
    expect(shouldAlertRestEnd(3, 0, endsAt, after(REST_END_ALERT_GRACE_MS))).toBe(true)
    expect(shouldAlertRestEnd(3, 0, endsAt, after(REST_END_ALERT_GRACE_MS + 1))).toBe(false)
  })

  it('al volver de segundo plano mucho después, no suena fuera de tiempo', () => {
    expect(shouldAlertRestEnd(45, 0, endsAt, after(3 * 60 * 1000))).toBe(false)
  })
})

describe('getRestBannerHideDelayMs', () => {
  it('justo al terminar el descanso faltan 3 s para ocultar el recuadro', () => {
    expect(getRestBannerHideDelayMs(endsAt, endsAt)).toBe(REST_BANNER_HIDE_AFTER_MS)
  })

  it('va bajando a medida que pasa el tiempo', () => {
    expect(getRestBannerHideDelayMs(endsAt, after(1000))).toBe(2000)
    expect(getRestBannerHideDelayMs(endsAt, after(2999))).toBe(1)
  })

  it('a los 3 s, o después, ya toca ocultarlo (nunca negativo)', () => {
    expect(getRestBannerHideDelayMs(endsAt, after(REST_BANNER_HIDE_AFTER_MS))).toBe(0)
    expect(getRestBannerHideDelayMs(endsAt, after(60_000))).toBe(0)
  })

  it('antes de que termine, el plazo incluye el tiempo que falta', () => {
    expect(getRestBannerHideDelayMs(endsAt, after(-10_000))).toBe(13_000)
  })
})
