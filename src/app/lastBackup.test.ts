import { beforeEach, describe, expect, it } from 'vitest'
import { LAST_BACKUP_STORAGE_KEY, readLastBackup, saveLastBackup } from './lastBackup'

beforeEach(() => localStorage.clear())

describe('lastBackup', () => {
  it('sin nada guardado devuelve null', () => {
    expect(readLastBackup()).toBeNull()
  })

  it('guarda y recupera la fecha', () => {
    const date = new Date('2026-03-10T15:00:00.000Z')
    saveLastBackup(date)
    expect(readLastBackup()?.toISOString()).toBe(date.toISOString())
  })

  it('un valor guardado que no es una fecha se trata como sin respaldo', () => {
    localStorage.setItem(LAST_BACKUP_STORAGE_KEY, 'basura')
    expect(readLastBackup()).toBeNull()
  })
})
