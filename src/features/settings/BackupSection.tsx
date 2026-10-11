import { useState, type ChangeEvent } from 'react'
import { firebaseBackupRepository } from '@/data/firestore/backupRepository'
import { deliverTextFile } from '@/app/deliverFile'
import { readLastBackup, saveLastBackup } from '@/app/lastBackup'
import {
  BACKUP_COLLECTIONS,
  BACKUP_COLLECTION_LABELS,
  buildBackup,
  countBackupDocuments,
  filterBackupCollections,
  filterFavoriteFoods,
  parseBackup,
  serializeBackup,
  summarizeBackup,
  type BackupCollection,
  type BackupFile,
} from '@/domain/backup'
import { toLocalDateString } from '@/domain/localDate'
import { chip, primaryButton, secondaryButton, secondaryButtonOnCard } from '@/app/buttonStyles'

interface PendingImport {
  backup: BackupFile
  warnings: string[]
}

type Notice = { kind: 'info' | 'error'; text: string }

// "10/03/2026" en hora local, para mostrar
function formatDate(date: Date): string {
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function BackupSection() {
  const [isExporting, setIsExporting] = useState(false)
  const [lastBackup, setLastBackup] = useState<Date | null>(() => readLastBackup())
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  // Por defecto se exporta todo (como siempre); se puede destildar lo que no se quiera llevar, p. ej. para pasar
  // solo Ejercicios y Alimentos a una cuenta de pruebas, sin las rutinas ni los datos personales del diario.
  const [selected, setSelected] = useState<Set<BackupCollection>>(() => new Set(BACKUP_COLLECTIONS))
  // Solo aplica a la colección "foods"; útil para llevar una biblioteca más chica y curada (sin todo lo probado
  // una vez ni las Tablas Peruanas completas) a una cuenta de pruebas.
  const [onlyFavoriteFoods, setOnlyFavoriteFoods] = useState(false)

  function toggleCollection(collection: BackupCollection) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(collection)) next.delete(collection)
      else next.add(collection)
      return next
    })
  }

  async function handleExport() {
    setIsExporting(true)
    setNotice(null)
    try {
      const now = new Date()
      const all = await firebaseBackupRepository.exportAll()
      const filtered = filterBackupCollections(all, [...selected])
      if (onlyFavoriteFoods) filtered.foods = filterFavoriteFoods(filtered.foods)
      const backup = buildBackup(filtered, now)
      const fileName = `repeats-respaldo-${toLocalDateString(now)}.json`
      const result = await deliverTextFile(serializeBackup(backup), fileName, 'application/json')

      if (result === 'cancelled') return
      saveLastBackup(now)
      setLastBackup(now)
      setNotice({
        kind: 'info',
        text:
          result === 'shared'
            ? `Respaldo listo (${countBackupDocuments(backup)} registros). Guárdalo en un lugar seguro, como Drive o Archivos.`
            : `Respaldo descargado (${countBackupDocuments(backup)} registros): ${fileName}.`,
      })
    } catch (error) {
      console.error('Respaldo: falló la exportación', error)
      setNotice({ kind: 'error', text: 'No se pudo crear el respaldo. Revisa tu conexión e inténtalo de nuevo.' })
    } finally {
      setIsExporting(false)
    }
  }

  async function handleFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // permite elegir de nuevo el mismo archivo
    if (!file) return

    setNotice(null)
    setPendingImport(null)
    const result = parseBackup(await file.text())
    if (result.backup === null) {
      setNotice({ kind: 'error', text: result.error ?? 'No se pudo leer el respaldo.' })
      return
    }
    setPendingImport({ backup: result.backup, warnings: result.warnings })
  }

  function confirmImport() {
    if (!pendingImport) return
    const count = firebaseBackupRepository.importAll(pendingImport.backup.collections)
    setPendingImport(null)
    setNotice({
      kind: 'info',
      text: `Se enviaron ${count} registros. Ya se ven en la app y se sincronizan con la nube en cuanto haya conexión.`,
    })
  }

  return (
    <div className="mt-6">
      <p className="text-xs uppercase text-slate-500">Respaldo de tus datos</p>
      <p className="mt-2 text-sm text-slate-400">
        Tus datos están en la nube, pero el plan gratuito no incluye copias de seguridad. Guarda un archivo de respaldo de
        vez en cuando.
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Último respaldo desde este dispositivo: {lastBackup ? formatDate(lastBackup) : 'aún no has hecho uno'}.
      </p>

      <p className="mt-4 text-xs uppercase text-slate-500">Qué incluir al exportar</p>
      <p className="mt-1 text-xs text-slate-500">
        Por defecto va todo. Destilda lo que no quieras llevar, por ejemplo para pasar solo Ejercicios y Alimentos a
        una cuenta de pruebas.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {BACKUP_COLLECTIONS.map((collection) => (
          <button
            key={collection}
            type="button"
            onClick={() => toggleCollection(collection)}
            aria-pressed={selected.has(collection)}
            className={chip(selected.has(collection))}
          >
            {BACKUP_COLLECTION_LABELS[collection]}
          </button>
        ))}
      </div>

      {selected.has('foods') && (
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={onlyFavoriteFoods}
            onChange={(e) => setOnlyFavoriteFoods(e.target.checked)}
            className="h-4 w-4"
          />
          Solo alimentos favoritos (⭐)
        </label>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => void handleExport()} disabled={isExporting || selected.size === 0} className={secondaryButton}>
          {isExporting ? 'Preparando…' : 'Exportar respaldo'}
        </button>
        <label className={`${secondaryButton} cursor-pointer`}>
          Importar respaldo
          <input type="file" accept="application/json,.json" onChange={(e) => void handleFileChosen(e)} className="sr-only" />
        </label>
      </div>

      {notice && (
        <p role="status" className={`mt-3 text-sm ${notice.kind === 'error' ? 'text-amber-400' : 'text-slate-300'}`}>
          {notice.text}
        </p>
      )}

      {pendingImport && (
        <div className="mt-4 rounded-xl bg-slate-800 p-4">
          <p className="text-sm font-semibold">Vista previa del respaldo</p>
          <p className="text-xs text-slate-400">
            Exportado el {formatDate(new Date(pendingImport.backup.exportedAt))} · {countBackupDocuments(pendingImport.backup)} registros
          </p>
          <ul className="mt-2 text-sm">
            {summarizeBackup(pendingImport.backup)
              .filter((line) => line.count > 0)
              .map((line) => (
                <li key={line.collection} className="flex justify-between border-b border-slate-700 py-1">
                  <span>{BACKUP_COLLECTION_LABELS[line.collection]}</span>
                  <span className="text-slate-400">{line.count}</span>
                </li>
              ))}
          </ul>
          {pendingImport.warnings.map((warning) => (
            <p key={warning} className="mt-2 text-xs text-amber-400">
              {warning}
            </p>
          ))}
          <p className="mt-3 text-xs text-slate-500">
            Importar combina los datos: los registros con el mismo identificador se reemplazan por los del archivo y no se
            borra nada de lo que ya tienes.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={confirmImport}
              disabled={countBackupDocuments(pendingImport.backup) === 0}
              className={`${primaryButton} flex-1`}
            >
              Importar
            </button>
            <button type="button" onClick={() => setPendingImport(null)} className={secondaryButtonOnCard}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
