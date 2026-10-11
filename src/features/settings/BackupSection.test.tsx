import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createEmptyCollections, type BackupCollections } from '@/domain/backup'
import { BackupSection } from './BackupSection'

const deliverTextFile = vi.fn(async (_text: string, _fileName: string, _mimeType: string) => 'downloaded' as const)
const exportAll = vi.fn(async (): Promise<BackupCollections> => createEmptyCollections())

vi.mock('@/app/deliverFile', () => ({
  deliverTextFile: (text: string, fileName: string, mimeType: string) => deliverTextFile(text, fileName, mimeType),
}))
vi.mock('@/data/firestore/backupRepository', () => ({
  firebaseBackupRepository: {
    exportAll: () => exportAll(),
    importAll: vi.fn(() => 0),
  },
}))
vi.mock('@/app/lastBackup', () => ({
  readLastBackup: () => null,
  saveLastBackup: vi.fn(),
}))

afterEach(() => {
  deliverTextFile.mockClear()
  exportAll.mockClear()
})

describe('BackupSection: qué incluir al exportar', () => {
  it('por defecto todas las colecciones están seleccionadas', () => {
    render(<BackupSection />)
    expect(screen.getByRole('button', { name: 'Ejercicios' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Alimentos y recetas' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Rutinas' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('destildar una colección la excluye del archivo exportado (p. ej. para una cuenta de pruebas)', async () => {
    exportAll.mockResolvedValueOnce({
      ...createEmptyCollections(),
      exercises: { e1: { name: 'Press banca' } },
      routines: { r1: { name: 'Empuje' } },
      foods: { f1: { name: 'Arroz' } },
    })
    render(<BackupSection />)

    await userEvent.click(screen.getByRole('button', { name: 'Rutinas' }))
    expect(screen.getByRole('button', { name: 'Rutinas' })).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(screen.getByRole('button', { name: 'Exportar respaldo' }))

    const exportedText = deliverTextFile.mock.calls[0]?.[0] as string
    const exported = JSON.parse(exportedText)
    expect(exported.collections.exercises).toEqual({ e1: { name: 'Press banca' } })
    expect(exported.collections.foods).toEqual({ f1: { name: 'Arroz' } })
    expect(exported.collections.routines).toEqual({})
  })

  it('sin ninguna colección elegida, el botón de exportar se desactiva', async () => {
    render(<BackupSection />)
    for (const label of ['Perfil', 'Ejercicios', 'Rutinas', 'Sesiones de entrenamiento', 'Pesajes', 'Fases de nutrición', 'Comidas guardadas', 'Días del diario', 'Alimentos y recetas']) {
      await userEvent.click(screen.getByRole('button', { name: label }))
    }
    expect(screen.getByRole('button', { name: 'Exportar respaldo' })).toBeDisabled()
  })

  it('"Solo alimentos favoritos" no aparece si "Alimentos y recetas" está destildado', async () => {
    render(<BackupSection />)
    expect(screen.getByLabelText('Solo alimentos favoritos (⭐)')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Alimentos y recetas' }))
    expect(screen.queryByLabelText('Solo alimentos favoritos (⭐)')).not.toBeInTheDocument()
  })

  it('"Solo alimentos favoritos" deja solo los favoritos en el archivo exportado', async () => {
    exportAll.mockResolvedValueOnce({
      ...createEmptyCollections(),
      foods: { f1: { name: 'Arroz', isFavorite: true }, f2: { name: 'Fideos', isFavorite: false } },
    })
    render(<BackupSection />)

    await userEvent.click(screen.getByLabelText('Solo alimentos favoritos (⭐)'))
    await userEvent.click(screen.getByRole('button', { name: 'Exportar respaldo' }))

    const exported = JSON.parse(deliverTextFile.mock.calls[0]?.[0] as string)
    expect(exported.collections.foods).toEqual({ f1: { name: 'Arroz', isFavorite: true } })
  })
})
