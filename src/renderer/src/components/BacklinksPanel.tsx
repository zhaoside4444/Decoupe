import { useEffect } from 'react'
import { ArrowUpRight, Link2, RefreshCw, X } from 'lucide-react'
import type { BacklinkEntry } from '@shared/types'
import { formatDate, restoreFocusIfLost } from '../util'

interface BacklinksPanelProps {
  noteTitle: string
  noteBase: string
  entries: BacklinkEntry[]
  loading: boolean
  error: string | null
  onOpen: (path: string) => void
  onRefresh: () => void
  onClose: () => void
}

export function BacklinksPanel({
  noteTitle,
  noteBase,
  entries,
  loading,
  error,
  onOpen,
  onRefresh,
  onClose
}: BacklinksPanelProps) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    return () => {
      restoreFocusIfLost(previous)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <aside className="backlinks-panel" aria-label="Liens entrants" aria-busy={loading}>
      <header className="backlinks-head">
        <div className="backlinks-title">
          <Link2 size={15} />
          <h2>Liens entrants</h2>
          {entries.length ? <span className="backlinks-count">{entries.length}</span> : null}
        </div>
        <div className="backlinks-actions">
          <button
            type="button"
            className={`icon-btn tiny${loading ? ' is-spinning' : ''}`}
            title="Actualiser les liens entrants"
            aria-label="Actualiser les liens entrants"
            disabled={loading}
            onClick={onRefresh}
          >
            <RefreshCw size={13} />
          </button>
          <button
            type="button"
            className="icon-btn tiny"
            title="Fermer les liens entrants"
            aria-label="Fermer les liens entrants"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
      </header>

      <div className="backlinks-scroll">
        {error ? (
          <div className="backlinks-empty">
            <Link2 size={20} />
            <p>{error}</p>
            <button type="button" className="backlinks-retry" onClick={onRefresh}>
              Réessayer
            </button>
          </div>
        ) : loading && !entries.length ? (
          <div className="backlinks-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ) : entries.length ? (
          <div className="backlinks-list">
            {entries.map((entry) => (
              <button
                key={entry.path}
                type="button"
                className="backlink-item"
                title={entry.path}
                onClick={() => onOpen(entry.path)}
              >
                <span className="backlink-title-row">
                  <span className="backlink-title">{entry.title}</span>
                  <ArrowUpRight size={13} />
                </span>
                <span className="backlink-meta">
                  {entry.space || 'Boîte d’entrée'} · {formatDate(entry.updatedAt)}
                  {entry.occurrences > 1 ? ` · ${entry.occurrences} liens` : ''}
                </span>
                {entry.snippet ? <span className="backlink-snippet">{entry.snippet}</span> : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="backlinks-empty">
            <Link2 size={20} />
            <p>
              Aucune note ne pointe encore vers « {noteTitle} ».
            </p>
            <span>
              Écrivez <code>[[{noteBase}]]</code> dans une autre note pour la référencer ici.
            </span>
          </div>
        )}
      </div>
    </aside>
  )
}
