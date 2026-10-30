import { useEffect, useState } from 'react'
import {
  Archive,
  Clock,
  Download,
  HardDrive,
  RotateCcw,
  Save,
  Trash2,
  X
} from 'lucide-react'
import type { BackupEntry, BackupOverview, BackupSettings } from '@shared/types'
import { errorMessage, formatBytes, formatDateTime, restoreFocusIfLost } from '../util'

interface BackupDialogProps {
  onClose: () => void
  onRestore: (entry: BackupEntry) => Promise<void>
  onNotice: (message: string) => void
  onError: (message: string) => void
}

const INTERVALS = [
  { value: 6, label: 'Toutes les 6 h' },
  { value: 12, label: 'Toutes les 12 h' },
  { value: 24, label: 'Tous les jours' },
  { value: 72, label: 'Tous les 3 jours' },
  { value: 168, label: 'Toutes les semaines' }
]

const RETENTIONS = [
  { value: 3, label: '3 sauvegardes' },
  { value: 5, label: '5 sauvegardes' },
  { value: 10, label: '10 sauvegardes' },
  { value: 20, label: '20 sauvegardes' },
  { value: 50, label: '50 sauvegardes' }
]

export function BackupDialog({
  onClose,
  onRestore,
  onNotice,
  onError
}: BackupDialogProps) {
  const [overview, setOverview] = useState<BackupOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<{
    id: string
    action: 'restore' | 'delete'
  } | null>(null)

  async function load(): Promise<BackupOverview | null> {
    try {
      const next = await window.api.backupOverview()
      setOverview(next)
      return next
    } catch (error) {
      onError(errorMessage(error))
      return null
    }
  }

  useEffect(() => {
    let cancelled = false
    void window.api
      .backupOverview()
      .then((next) => {
        if (!cancelled) setOverview(next)
      })
      .catch((error) => {
        if (!cancelled) onError(errorMessage(error))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [onError])

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    return () => {
      restoreFocusIfLost(previous)
    }
  }, [])

  useEffect(() => {
    function handleKey(event: KeyboardEvent): void {
      if (event.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [busy, onClose])

  async function createBackup(): Promise<void> {
    if (busy) return
    setBusy('create')
    try {
      await window.api.createBackup('Sauvegarde manuelle')
      await load()
      onNotice('Sauvegarde créée.')
    } catch (error) {
      onError(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  async function exportVault(): Promise<void> {
    if (busy) return
    setBusy('export')
    try {
      const destination = await window.api.exportVault()
      if (destination) onNotice(`Vault exporté vers ${destination}`)
    } catch (error) {
      onError(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  async function saveSettings(patch: Partial<BackupSettings>): Promise<void> {
    if (!overview || busy) return
    setBusy('settings')
    const optimistic = { ...overview.settings, ...patch }
    setOverview({ ...overview, settings: optimistic })
    try {
      const saved = await window.api.updateBackupSettings(optimistic)
      setOverview((current) => (current ? { ...current, settings: saved } : current))
    } catch (error) {
      onError(errorMessage(error))
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function remove(entry: BackupEntry): Promise<void> {
    if (busy) return
    setBusy(entry.id)
    try {
      await window.api.deleteBackup(entry.id)
      await load()
      setConfirming(null)
      onNotice('Sauvegarde supprimée.')
    } catch (error) {
      onError(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  async function restore(entry: BackupEntry): Promise<void> {
    if (busy) return
    setBusy(entry.id)
    try {
      await onRestore(entry)
    } catch {
      // L'application signale déjà l'erreur ; le dialogue reste ouvert.
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className="trash-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <section
        className="trash-dialog backup-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-title"
      >
        <header className="trash-head">
          <div>
            <h2 id="backup-title">Sauvegardes</h2>
            <p>
              {overview
                ? `${overview.entries.length} sauvegarde${
                    overview.entries.length > 1 ? 's' : ''
                  } locale${overview.entries.length > 1 ? 's' : ''}`
                : 'Chargement…'}
            </p>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Fermer les sauvegardes"
            onClick={onClose}
            disabled={Boolean(busy)}
            autoFocus
          >
            <X size={16} />
          </button>
        </header>

        {overview ? (
          <>
            <div className="backup-toolbar">
              <button
                type="button"
                className="backup-primary"
                disabled={Boolean(busy)}
                onClick={() => void createBackup()}
              >
                <Save size={14} />
                {busy === 'create' ? 'Sauvegarde…' : 'Sauvegarder maintenant'}
              </button>
              <button
                type="button"
                className="backup-secondary"
                disabled={Boolean(busy)}
                onClick={() => void exportVault()}
              >
                <Download size={14} />
                {busy === 'export' ? 'Export…' : 'Exporter le vault'}
              </button>
            </div>

            <div className="backup-settings">
              <label className="backup-toggle">
                <input
                  type="checkbox"
                  checked={overview.settings.enabled}
                  disabled={Boolean(busy)}
                  onChange={(event) =>
                    void saveSettings({ enabled: event.target.checked })
                  }
                />
                <span>
                  <strong>Sauvegarde automatique</strong>
                  <small>Un instantané régulier du contenu du vault.</small>
                </span>
              </label>
              <div className="backup-selects">
                <label>
                  <span>Fréquence</span>
                  <select
                    value={overview.settings.intervalHours}
                    disabled={Boolean(busy) || !overview.settings.enabled}
                    onChange={(event) =>
                      void saveSettings({ intervalHours: Number(event.target.value) })
                    }
                  >
                    {INTERVALS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Conserver</span>
                  <select
                    value={overview.settings.retention}
                    disabled={Boolean(busy)}
                    onChange={(event) =>
                      void saveSettings({ retention: Number(event.target.value) })
                    }
                  >
                    {RETENTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {loading ? (
              <div className="trash-empty">
                <Clock size={22} />
                <p>Chargement des sauvegardes…</p>
              </div>
            ) : overview.entries.length ? (
              <ul className="trash-list backup-list">
                {overview.entries.map((entry) => {
                  const isBusy = busy === entry.id
                  const confirmation =
                    confirming?.id === entry.id ? confirming.action : null
                  return (
                    <li className="trash-item backup-item" key={entry.id}>
                      <span className="trash-kind" aria-hidden="true">
                        <Archive size={16} />
                      </span>
                      <div className="trash-copy">
                        <strong>{entry.reason}</strong>
                        <span>
                          {formatDateTime(entry.createdAt)} · {formatBytes(entry.size)}
                        </span>
                      </div>

                      {confirmation ? (
                        <div className="trash-confirm">
                          <span>
                            {confirmation === 'restore'
                              ? 'Remplacer le vault ?'
                              : 'Supprimer ?'}
                          </span>
                          <button
                            type="button"
                            className="trash-cancel"
                            disabled={isBusy}
                            onClick={() => setConfirming(null)}
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            className="trash-danger"
                            disabled={isBusy}
                            onClick={() =>
                              void (confirmation === 'restore'
                                ? restore(entry)
                                : remove(entry))
                            }
                          >
                            {isBusy
                              ? confirmation === 'restore'
                                ? 'Restauration…'
                                : 'Suppression…'
                              : confirmation === 'restore'
                                ? 'Restaurer'
                                : 'Supprimer'}
                          </button>
                        </div>
                      ) : (
                        <div className="trash-actions">
                          <button
                            type="button"
                            className="trash-restore"
                            disabled={Boolean(busy)}
                            title={`Restaurer ${formatDateTime(entry.createdAt)}`}
                            onClick={() =>
                              setConfirming({ id: entry.id, action: 'restore' })
                            }
                          >
                            <RotateCcw size={14} />
                            <span>Restaurer</span>
                          </button>
                          <button
                            type="button"
                            className="trash-delete"
                            disabled={Boolean(busy)}
                            title="Supprimer cette sauvegarde"
                            aria-label="Supprimer cette sauvegarde"
                            onClick={() =>
                              setConfirming({ id: entry.id, action: 'delete' })
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="trash-empty">
                <HardDrive size={22} />
                <p>Aucune sauvegarde pour le moment.</p>
                <span>Créez un instantané ou activez la sauvegarde automatique.</span>
              </div>
            )}

            <footer className="backup-foot" title={overview.directory}>
              <HardDrive size={12} />
              <span>{overview.directory}</span>
            </footer>
          </>
        ) : (
          <div className="trash-empty">
            <Clock size={22} />
            <p>{loading ? 'Chargement des sauvegardes…' : 'Sauvegardes indisponibles.'}</p>
          </div>
        )}
      </section>
    </div>
  )
}
