import { beforeEach, describe, expect, it } from 'vitest'
import { readBooleanPreference, saveBooleanPreference } from './devicePreferences'

beforeEach(() => localStorage.clear())

describe('preferencias de sí/no del dispositivo', () => {
  it('sin nada guardado devuelve el valor por defecto', () => {
    expect(readBooleanPreference('x', true)).toBe(true)
    expect(readBooleanPreference('x', false)).toBe(false)
  })

  it('guarda y recupera, tanto activado como desactivado', () => {
    saveBooleanPreference('x', false)
    expect(readBooleanPreference('x', true)).toBe(false)
    saveBooleanPreference('x', true)
    expect(readBooleanPreference('x', false)).toBe(true)
  })

  it('un valor guardado que no reconoce se trata como sin guardar', () => {
    localStorage.setItem('x', 'quizás')
    expect(readBooleanPreference('x', true)).toBe(true)
  })

  it('cada clave es independiente', () => {
    saveBooleanPreference('a', false)
    expect(readBooleanPreference('b', true)).toBe(true)
  })
})
