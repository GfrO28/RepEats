// Respaldo completo de los datos del usuario en un archivo JSON.
// Aquí solo hay formato y validación (sin Firebase): leer y escribir en Firestore vive en data/firestore.

export const BACKUP_APP = 'RepEats'
export const BACKUP_VERSION = 1

// Todo lo que cuelga de users/{uid}. El perfil es la colección "profile" con un único documento "main".
export const BACKUP_COLLECTIONS = [
  'profile',
  'exercises',
  'routines',
  'sessions',
  'weighIns',
  'phases',
  'savedMeals',
  'diary',
  'foods',
] as const
export type BackupCollection = (typeof BACKUP_COLLECTIONS)[number]

export const BACKUP_COLLECTION_LABELS: Record<BackupCollection, string> = {
  profile: 'Perfil',
  exercises: 'Ejercicios',
  routines: 'Rutinas',
  sessions: 'Sesiones de entrenamiento',
  weighIns: 'Pesajes',
  phases: 'Fases de nutrición',
  savedMeals: 'Comidas guardadas',
  diary: 'Días del diario',
  foods: 'Alimentos y recetas',
}

// Un documento tal como va en el archivo: JSON plano; las fechas exactas (Timestamp) van como { "__timestamp": "ISO" }
export type BackupDocument = Record<string, unknown>
export type BackupCollections = Record<BackupCollection, Record<string, BackupDocument>>

export interface BackupFile {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string // ISO
  collections: BackupCollections
}

export const TIMESTAMP_KEY = '__timestamp'
export interface TimestampMarker {
  [TIMESTAMP_KEY]: string
}

// Tope de seguridad: un archivo con más documentos que esto no es un respaldo de esta app
export const MAX_BACKUP_DOCUMENTS = 50_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function createTimestampMarker(date: Date): TimestampMarker {
  return { [TIMESTAMP_KEY]: date.toISOString() }
}

// Un marcador válido: solo la clave "__timestamp", con un texto que sea una fecha real
export function isTimestampMarker(value: unknown): value is TimestampMarker {
  if (!isRecord(value)) return false
  const keys = Object.keys(value)
  const iso = value[TIMESTAMP_KEY]
  return keys.length === 1 && keys[0] === TIMESTAMP_KEY && typeof iso === 'string' && !Number.isNaN(new Date(iso).getTime())
}

// Reglas de Firestore para el id de un documento: sin "/", ni "." o "..", ni el patrón reservado "__algo__"
function isValidDocumentId(id: string): boolean {
  return id !== '' && !id.includes('/') && id !== '.' && id !== '..' && !/^__.*__$/.test(id) && id.length <= 200
}

export function createEmptyCollections(): BackupCollections {
  return {
    profile: {},
    exercises: {},
    routines: {},
    sessions: {},
    weighIns: {},
    phases: {},
    savedMeals: {},
    diary: {},
    foods: {},
  }
}

export function buildBackup(collections: BackupCollections, exportedAt: Date): BackupFile {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: exportedAt.toISOString(), collections }
}

// Deja solo las colecciones elegidas (el resto queda vacía); para exportar, por ejemplo, solo Ejercicios y
// Alimentos hacia una cuenta de pruebas, sin llevarse rutinas, diario ni el resto de datos personales.
export function filterBackupCollections(collections: BackupCollections, selected: readonly BackupCollection[]): BackupCollections {
  const filtered = createEmptyCollections()
  for (const collection of selected) filtered[collection] = collections[collection]
  return filtered
}

// Deja solo los alimentos marcados como favoritos (⭐); para exportar una biblioteca más chica y curada, sin
// arrastrar todo lo que se probó una vez o se importó de las Tablas Peruanas.
export function filterFavoriteFoods(foods: Record<string, BackupDocument>): Record<string, BackupDocument> {
  return Object.fromEntries(Object.entries(foods).filter(([, food]) => food.isFavorite === true))
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup)
}

export interface BackupSummaryLine {
  collection: BackupCollection
  count: number
}

export function summarizeBackup(backup: BackupFile): BackupSummaryLine[] {
  return BACKUP_COLLECTIONS.map((collection) => ({
    collection,
    count: Object.keys(backup.collections[collection]).length,
  }))
}

export function countBackupDocuments(backup: BackupFile): number {
  return summarizeBackup(backup).reduce((total, line) => total + line.count, 0)
}

// ¿Hay algún marcador de fecha mal formado dentro del valor? (cualquier objeto con la clave "__timestamp")
function hasInvalidTimestamp(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasInvalidTimestamp)
  if (!isRecord(value)) return false
  if (TIMESTAMP_KEY in value) return !isTimestampMarker(value)
  return Object.values(value).some(hasInvalidTimestamp)
}

export interface BackupParseResult {
  backup: BackupFile | null // null si el archivo no sirve
  error: string | null
  warnings: string[] // el archivo sirve, pero conviene saberlo
}

const fail = (error: string): BackupParseResult => ({ backup: null, error, warnings: [] })

// Valida a fondo antes de escribir nada: cualquier documento mal formado rechaza todo el archivo,
// porque un respaldo a medias podría dejar los datos inconsistentes.
export function parseBackup(text: string): BackupParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return fail('El archivo no es un JSON válido.')
  }

  if (!isRecord(parsed) || parsed.app !== BACKUP_APP) return fail('Este archivo no es un respaldo de RepEats.')
  if (typeof parsed.version !== 'number' || !Number.isInteger(parsed.version) || parsed.version < 1) {
    return fail('El respaldo no indica una versión válida.')
  }
  if (parsed.version > BACKUP_VERSION) {
    return fail('Este respaldo se creó con una versión más nueva de la app. Actualiza la app e inténtalo de nuevo.')
  }
  if (typeof parsed.exportedAt !== 'string' || Number.isNaN(new Date(parsed.exportedAt).getTime())) {
    return fail('El respaldo no trae una fecha de exportación válida.')
  }
  if (!isRecord(parsed.collections)) return fail('El respaldo no trae datos ("collections").')

  const warnings: string[] = []
  const collections = createEmptyCollections()
  const knownNames: readonly string[] = BACKUP_COLLECTIONS

  for (const name of Object.keys(parsed.collections)) {
    if (!knownNames.includes(name)) warnings.push(`Se ignoró la sección desconocida "${name}".`)
  }

  let total = 0
  for (const name of BACKUP_COLLECTIONS) {
    const rawCollection = parsed.collections[name]
    if (rawCollection === undefined) continue // una sección ausente cuenta como vacía
    if (!isRecord(rawCollection)) return fail(`La sección "${BACKUP_COLLECTION_LABELS[name]}" tiene un formato inválido.`)

    for (const [id, document] of Object.entries(rawCollection)) {
      if (!isValidDocumentId(id)) return fail(`En "${BACKUP_COLLECTION_LABELS[name]}" hay un identificador no válido: "${id}".`)
      if (!isRecord(document)) return fail(`En "${BACKUP_COLLECTION_LABELS[name]}", el registro "${id}" no es un objeto.`)
      if (hasInvalidTimestamp(document)) {
        return fail(`En "${BACKUP_COLLECTION_LABELS[name]}", el registro "${id}" tiene una fecha mal formada.`)
      }
      collections[name][id] = document
      total += 1
      if (total > MAX_BACKUP_DOCUMENTS) return fail('El archivo tiene demasiados registros para ser un respaldo de esta app.')
    }
  }

  return {
    backup: { app: BACKUP_APP, version: parsed.version, exportedAt: parsed.exportedAt, collections },
    error: null,
    warnings,
  }
}
