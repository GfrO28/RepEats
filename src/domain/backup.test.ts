import { describe, it, expect } from 'vitest'
import {
  BACKUP_COLLECTIONS,
  MAX_BACKUP_DOCUMENTS,
  buildBackup,
  countBackupDocuments,
  createEmptyCollections,
  createTimestampMarker,
  filterBackupCollections,
  filterFavoriteFoods,
  isTimestampMarker,
  parseBackup,
  serializeBackup,
  summarizeBackup,
} from './backup'

const NOW = new Date('2026-03-10T15:00:00.000Z')

function sampleCollections() {
  const collections = createEmptyCollections()
  collections.profile['main'] = { sex: 'male', weightKg: 72, optionalMeals: [], adaptiveTdee: null }
  collections.exercises['e1'] = { name: 'Press banca', primaryMuscles: ['pectoral_medio'] }
  collections.sessions['s1'] = {
    startedAt: createTimestampMarker(new Date('2026-03-09T12:00:00.000Z')),
    endedAt: null,
    exercises: [{ sets: [{ reps: 8, completedAt: createTimestampMarker(new Date('2026-03-09T12:10:00.000Z')) }] }],
  }
  collections.diary['2026-03-09'] = { meals: [], hiddenMeals: [] }
  return collections
}

// Un archivo de respaldo como texto, con un cambio puntual para probar cada rechazo
function fileWith(changes: Record<string, unknown> = {}) {
  return JSON.stringify({ ...buildBackup(sampleCollections(), NOW), ...changes })
}

describe('isTimestampMarker', () => {
  it('acepta un marcador con una fecha ISO válida', () => {
    expect(isTimestampMarker(createTimestampMarker(NOW))).toBe(true)
    expect(isTimestampMarker({ __timestamp: '2026-03-10T15:00:00.000Z' })).toBe(true)
  })

  it('rechaza fechas inválidas, otros tipos y claves extra', () => {
    expect(isTimestampMarker({ __timestamp: 'no es fecha' })).toBe(false)
    expect(isTimestampMarker({ __timestamp: 123 })).toBe(false)
    expect(isTimestampMarker({ __timestamp: '2026-03-10T15:00:00.000Z', extra: 1 })).toBe(false)
    expect(isTimestampMarker(null)).toBe(false)
    expect(isTimestampMarker('2026-03-10')).toBe(false)
    expect(isTimestampMarker([])).toBe(false)
  })
})

describe('buildBackup / serializeBackup / parseBackup', () => {
  it('ida y vuelta: lo exportado se importa idéntico', () => {
    const backup = buildBackup(sampleCollections(), NOW)
    const result = parseBackup(serializeBackup(backup))
    expect(result.error).toBeNull()
    expect(result.warnings).toEqual([])
    expect(result.backup).toEqual(backup)
  })

  it('el archivo lleva la app, la versión y la fecha de exportación', () => {
    const backup = buildBackup(createEmptyCollections(), NOW)
    expect(backup).toMatchObject({ app: 'RepEats', version: 1, exportedAt: '2026-03-10T15:00:00.000Z' })
  })

  it('un respaldo vacío (sin ningún dato) es válido', () => {
    const result = parseBackup(serializeBackup(buildBackup(createEmptyCollections(), NOW)))
    expect(result.error).toBeNull()
    expect(result.backup && countBackupDocuments(result.backup)).toBe(0)
  })

  it('una sección ausente cuenta como vacía', () => {
    const result = parseBackup(fileWith({ collections: { foods: { f1: { name: 'Arroz' } } } }))
    expect(result.error).toBeNull()
    expect(result.backup?.collections.foods['f1']).toEqual({ name: 'Arroz' })
    expect(result.backup?.collections.sessions).toEqual({})
  })

  it('una sección desconocida se ignora con un aviso', () => {
    const backup = buildBackup(sampleCollections(), NOW)
    const result = parseBackup(JSON.stringify({ ...backup, collections: { ...backup.collections, secretos: { a: {} } } }))
    expect(result.error).toBeNull()
    expect(result.warnings).toEqual(['Se ignoró la sección desconocida "secretos".'])
    expect(result.backup && 'secretos' in result.backup.collections).toBe(false)
  })
})

describe('parseBackup: rechazos', () => {
  it('texto que no es JSON', () => {
    expect(parseBackup('esto no es json').error).toContain('JSON válido')
    expect(parseBackup('').error).toContain('JSON válido')
  })

  it('un JSON que no es de RepEats', () => {
    expect(parseBackup('[1,2,3]').error).toContain('no es un respaldo de RepEats')
    expect(parseBackup('null').error).toContain('no es un respaldo de RepEats')
    expect(parseBackup(fileWith({ app: 'OtraApp' })).error).toContain('no es un respaldo de RepEats')
  })

  it('una versión inválida o más nueva que la de la app', () => {
    expect(parseBackup(fileWith({ version: 'uno' })).error).toContain('versión válida')
    expect(parseBackup(fileWith({ version: 0 })).error).toContain('versión válida')
    expect(parseBackup(fileWith({ version: 1.5 })).error).toContain('versión válida')
    expect(parseBackup(fileWith({ version: 99 })).error).toContain('versión más nueva')
  })

  it('fecha de exportación o datos ausentes', () => {
    expect(parseBackup(fileWith({ exportedAt: 'ayer' })).error).toContain('fecha de exportación')
    expect(parseBackup(fileWith({ collections: 'nada' })).error).toContain('no trae datos')
  })

  it('una sección que no es un objeto', () => {
    expect(parseBackup(fileWith({ collections: { foods: [1, 2] } })).error).toContain('formato inválido')
  })

  it('identificadores que Firestore no acepta', () => {
    for (const badId of ['', 'a/b', '.', '..', '__reservado__']) {
      const result = parseBackup(fileWith({ collections: { foods: { [badId]: { name: 'x' } } } }))
      expect(result.error, `id "${badId}"`).toContain('identificador no válido')
    }
  })

  it('un registro que no es un objeto', () => {
    expect(parseBackup(fileWith({ collections: { foods: { f1: 'texto' } } })).error).toContain('no es un objeto')
    expect(parseBackup(fileWith({ collections: { foods: { f1: [1] } } })).error).toContain('no es un objeto')
    expect(parseBackup(fileWith({ collections: { foods: { f1: null } } })).error).toContain('no es un objeto')
  })

  it('una fecha mal formada, aunque esté anidada', () => {
    const bad = { exercises: [{ sets: [{ completedAt: { __timestamp: 'no es fecha' } }] }] }
    const result = parseBackup(fileWith({ collections: { sessions: { s1: bad } } }))
    expect(result.error).toContain('fecha mal formada')
    expect(result.backup).toBeNull()
  })

  it('demasiados registros', () => {
    const many: Record<string, object> = {}
    for (let i = 0; i <= MAX_BACKUP_DOCUMENTS; i++) many[`d${i}`] = {}
    expect(parseBackup(fileWith({ collections: { diary: many } })).error).toContain('demasiados registros')
  })

  it('un solo registro malo rechaza todo el archivo (no se importa a medias)', () => {
    const result = parseBackup(fileWith({ collections: { foods: { ok: { name: 'Arroz' }, malo: 5 } } }))
    expect(result.backup).toBeNull()
  })
})

describe('summarizeBackup / countBackupDocuments', () => {
  it('cuenta los registros por sección, en el orden de siempre', () => {
    const backup = buildBackup(sampleCollections(), NOW)
    const summary = summarizeBackup(backup)
    expect(summary.map((line) => line.collection)).toEqual([...BACKUP_COLLECTIONS])
    expect(summary.find((line) => line.collection === 'exercises')?.count).toBe(1)
    expect(summary.find((line) => line.collection === 'foods')?.count).toBe(0)
    expect(countBackupDocuments(backup)).toBe(4)
  })
})

describe('filterBackupCollections', () => {
  it('deja solo las colecciones elegidas; el resto queda vacía', () => {
    const filtered = filterBackupCollections(sampleCollections(), ['exercises', 'foods'])
    expect(filtered.exercises).toEqual({ e1: { name: 'Press banca', primaryMuscles: ['pectoral_medio'] } })
    expect(filtered.foods).toEqual({})
    expect(filtered.profile).toEqual({})
    expect(filtered.sessions).toEqual({})
    expect(filtered.diary).toEqual({})
  })

  it('sin ninguna elegida, todo queda vacío', () => {
    const filtered = filterBackupCollections(sampleCollections(), [])
    expect(countBackupDocuments(buildBackup(filtered, NOW))).toBe(0)
  })

  it('con todas elegidas, equivale al respaldo completo', () => {
    const original = sampleCollections()
    const filtered = filterBackupCollections(original, BACKUP_COLLECTIONS)
    expect(filtered).toEqual(original)
  })

  it('no modifica las colecciones originales', () => {
    const original = sampleCollections()
    filterBackupCollections(original, ['exercises'])
    expect(original.profile['main']).toBeDefined()
  })
})

describe('filterFavoriteFoods', () => {
  it('deja solo los alimentos con isFavorite true', () => {
    const foods = {
      f1: { name: 'Arroz', isFavorite: true },
      f2: { name: 'Fideos', isFavorite: false },
      f3: { name: 'Palta', isFavorite: true },
    }
    expect(filterFavoriteFoods(foods)).toEqual({ f1: { name: 'Arroz', isFavorite: true }, f3: { name: 'Palta', isFavorite: true } })
  })

  it('sin ningún favorito, queda vacío', () => {
    expect(filterFavoriteFoods({ f1: { name: 'Arroz', isFavorite: false } })).toEqual({})
  })
})
