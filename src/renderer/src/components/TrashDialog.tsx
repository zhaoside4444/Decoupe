import { useEffect, useState } from 'react'
import { FileText, Folder, RotateCcw, Trash2, X } from 'lucide-react'
import type { TrashItem } from '@shared/types'
import { spaceOfPath } from '@shared/text'
import { formatDateTime, restoreFocusIfLost } from '../util'

interface TrashDialogProps {
  items: TrashItem[]
  onClose: () => void
  onRestore: (item: TrashItem) => Promise<void>
  onDelete: (item: TrashItem) => Promise<void>
}

function locationOf(item: TrashItem): string {
  if (item.kind === 'space') return 'Dossier'
  if (!item.originalPath) return 'Emplacement d’origine inconnu'
  return spaceOfPath(item.originalPath) || 'Boîte d’entrée'
}

export function TrashDialog({
  items,
  onClose,
  onRestore,
  onDelete
}: TrashDialogProps) {
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    return () => {
      restoreFocusIfLost(previous)
    }
  }, [])

  useEffect(() => {
    function handleKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function restore(item: TrashItem): Promise<void> {
    if (busy) return
    setBusy(item.path)
    try {
      await onRestore(item)
    } finally {
      setBusy(null)
    }
  }

  async function remove(item: TrashItem): Promise<void> {
    if (busy) return
    setBusy(item.path)
    try {
      await onDelete(item)
      setConfirming(null)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className="trash-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="trash-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trash-title"
      >
        <header className="trash-head">
          <div>
            <h2 id="trash-title">Corbeille</h2>
            <p>
              {items.length
                ? `${items.length} élément${items.length > 1 ? 's' : ''} supprimé${
                    items.length > 1 ? 's' : ''
                  }`
                : 'Aucun élément supprimé'}
            </p>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Fermer la corbeille"
            onClick={onClose}
            autoFocus
          >
            <X size={16} />
          </button>
        </header>

        {items.length ? (
          <ul className="trash-list">
            {items.map((item) => {
              const Icon = item.kind === 'space' ? Folder : FileText
              const isBusy = busy === item.path
              return (
                <li className="trash-item" key={item.path}>
                  <span className="trash-kind" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <div className="trash-copy">
                    <strong>{item.title}</strong>
                    <span>
                      {item.kind === 'space' ? 'Dossier' : 'Note'} · {locationOf(item)} ·
                      supprimé : {formatDateTime(item.deletedAt)}
                    </span>
                  </div>

                  {confirming === item.path ? (
                    <div className="trash-confirm">
                      <span>Définitivement ?</span>
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
                        onClick={() => void remove(item)}
                      >
                        {isBusy ? 'Suppression…' : 'Supprimer'}
                      </button>
                    </div>
                  ) : (
                    <div className="trash-actions">
                      <button
                        type="button"
                        className="trash-restore"
                        disabled={Boolean(busy)}
                        title={`Restaurer ${item.title}`}
                        onClick={() => void restore(item)}
                      >
                        <RotateCcw size={14} />
                        <span>{isBusy ? 'Restauration…' : 'Restaurer'}</span>
                      </button>
                      <button
                        type="button"
                        className="trash-delete"
                        disabled={Boolean(busy)}
                        title={`Supprimer définitivement ${item.title}`}
                        aria-label={`Supprimer définitivement ${item.title}`}
                        onClick={() => setConfirming(item.path)}
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
            <Trash2 size={22} />
            <p>La corbeille est vide.</p>
            <span>Les notes et dossiers supprimés apparaîtront ici.</span>
          </div>
        )}
      </section>
    </div>
  )
}
