import { auth, db } from '@/firebase'
import { collection, doc, getDocs, Timestamp, writeBatch } from 'firebase/firestore'
import {
  BACKUP_COLLECTIONS,
  TIMESTAMP_KEY,
  createEmptyCollections,
  createTimestampMarker,
  isTimestampMarker,
  type BackupCollection,
  type BackupCollections,
  type BackupDocument,
} from '@/domain/backup'

// Un lote de Firestore admite hasta 500 escrituras
const BATCH_SIZE = 400

function userId(): string {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('No hay usuario autenticado')
  return uid
}

function backupCollection(name: BackupCollection) {
  return collection(db, 'users', userId(), name)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Firestore → archivo: cada Timestamp pasa a { "__timestamp": "ISO" } para que el JSON no pierda el tipo
function encodeValue(value: unknown): unknown {
  if (value instanceof Timestamp) return createTimestampMarker(value.toDate())
  if (Array.isArray(value)) return value.map(encodeValue)
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeValue(item)]))
  return value
}

// Archivo → Firestore: el camino inverso
function decodeValue(value: unknown): unknown {
  if (isTimestampMarker(value)) return Timestamp.fromDate(new Date(value[TIMESTAMP_KEY]))
  if (Array.isArray(value)) return value.map(decodeValue)
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeValue(item)]))
  return value
}

export const firebaseBackupRepository = {
  // Lee todo lo del usuario. Es una lectura de cada documento (cuenta para la cuota diaria), por eso solo
  // se hace cuando el usuario pide exportar.
  async exportAll(): Promise<BackupCollections> {
    const collections = createEmptyCollections()
    await Promise.all(
      BACKUP_COLLECTIONS.map(async (name) => {
        const snapshot = await getDocs(backupCollection(name))
        snapshot.forEach((docSnap) => {
          collections[name][docSnap.id] = encodeValue(docSnap.data()) as BackupDocument
        })
      }),
    )
    return collections
  },

  // Escribe los documentos del respaldo: los que ya existen con el mismo id se reemplazan y nada se borra.
  // Sin await (offline-first): los lotes se envían y la app los aplica de inmediato desde la caché local.
  // Devuelve cuántos documentos se enviaron.
  importAll(collections: BackupCollections): number {
    const writes = BACKUP_COLLECTIONS.flatMap((name) =>
      Object.entries(collections[name]).map(([id, document]) => ({
        ref: doc(backupCollection(name), id),
        data: decodeValue(document) as BackupDocument,
      })),
    )

    for (let start = 0; start < writes.length; start += BATCH_SIZE) {
      const batch = writeBatch(db)
      writes.slice(start, start + BATCH_SIZE).forEach((write) => batch.set(write.ref, write.data))
      batch.commit().catch((error: unknown) => {
        console.error(`Respaldo: falló el lote que empieza en el registro ${start + 1}`, error)
      })
    }
    return writes.length
  },
}
