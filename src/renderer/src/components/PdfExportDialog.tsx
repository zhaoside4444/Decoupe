import { useEffect, useMemo, useState } from 'react'
import { FileText, X } from 'lucide-react'
import type { NoteSummary } from '@shared/types'
import { findRelatedNotes } from '@shared/related'
import { formatRelationReason } from '@shared/related'
import { PASTEL_THEMES, type UiSettings } from '@shared/settings'
import { restoreFocusIfLost } from '../util'

interface PdfExportDialogProps {
  title: string
  space: string
  createdAt: string
  updatedAt: number
  tags: string[]
  notes: NoteSummary[]
  currentPath: string
  currentBase: string
  currentLinks: string[]
  uiSettings: UiSettings
  onClose: () => void
  onExport: (options: PdfExportOptions) => Promise<void>
}

export interface PdfExportOptions {
  relatedMode: 'none' | 'summary' | 'full'
  selectedRelatedPaths: string[]
  themeMode: 'pastel' | 'monochrome'
  includeMetadata: boolean
}

export function PdfExportDialog({
  title,
  space,
  createdAt,
  updatedAt,
  tags,
  notes,
  currentPath,
  currentBase,
  currentLinks,
  uiSettings,
  onClose,
  onExport
}: PdfExportDialogProps) {
  const [relatedMode, setRelatedMode] = useState<'none' | 'summary' | 'full'>('none')
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [themeMode, setThemeMode] = useState<'pastel' | 'monochrome'>('pastel')
  const [includeMetadata, setIncludeMetadata] = useState(true)
  const [exporting, setExporting] = useState(false)

  const relatedNotes = useMemo(
    () =>
      findRelatedNotes({
        currentPath,
        currentBase,
        currentTags: tags,
        currentLinks,
        notes,
        maxResults: 8
      }),
    [currentPath, currentBase, tags, currentLinks, notes]
  )

  // Sélectionne toutes les notes liées uniquement au passage en mode « annexes complètes » :
  // un effet dépendant de la sélection re-cocherait la dernière note décochée.
  function selectFullMode(): void {
    setRelatedMode('full')
    setSelectedPaths(new Set(relatedNotes.map((r) => r.path)))
  }

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

  function togglePath(path: string): void {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  async function handleExport(): Promise<void> {
    if (exporting) return
    setExporting(true)
    try {
      await onExport({
        relatedMode,
        selectedRelatedPaths: Array.from(selectedPaths),
        themeMode,
        includeMetadata
      })
    } finally {
      setExporting(false)
    }
  }

  const pastelTheme = PASTEL_THEMES.find((t) => t.id === uiSettings.theme) ?? PASTEL_THEMES[0]

  return (
    <div
      className="trash-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="trash-dialog pdf-export-dialog" role="dialog" aria-label="Exporter en PDF">
        <header className="trash-head">
          <div>
            <h2>Exporter en PDF</h2>
            <p>« {title} »</p>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Fermer"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </header>

        <div className="settings-body">
          <section className="settings-section">
            <div className="settings-section-head">
              <h3>Notes liées</h3>
              <p>Choisissez comment intégrer les notes connectées au document.</p>
            </div>
            <div className="pdf-related-options">
              <label className="pdf-radio">
                <input
                  type="radio"
                  name="related-mode"
                  checked={relatedMode === 'none'}
                  onChange={() => setRelatedMode('none')}
                />
                <span>Aucune (note seule)</span>
              </label>
              <label className="pdf-radio">
                <input
                  type="radio"
                  name="related-mode"
                  checked={relatedMode === 'summary'}
                  onChange={() => setRelatedMode('summary')}
                  disabled={!relatedNotes.length}
                />
                <span>Index de synthèse ({relatedNotes.length} notes)</span>
              </label>
              <label className="pdf-radio">
                <input
                  type="radio"
                  name="related-mode"
                  checked={relatedMode === 'full'}
                  onChange={selectFullMode}
                  disabled={!relatedNotes.length}
                />
                <span>Annexes complètes</span>
              </label>
            </div>

            {relatedMode === 'full' && relatedNotes.length > 0 && (
              <div className="pdf-related-checkboxes">
                {relatedNotes.map((rn) => (
                  <label key={rn.path} className="pdf-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedPaths.has(rn.path)}
                      onChange={() => togglePath(rn.path)}
                    />
                    <span className="pdf-checkbox-label">
                      {rn.title}
                      <span className="pdf-checkbox-meta">
                        {rn.space || 'Boîte d’entrée'} · {formatRelationReason(rn)}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <h3>Style d'impression</h3>
              <p>Choisissez la palette pour le document PDF.</p>
            </div>
            <div className="pdf-style-options">
              <label className="pdf-radio">
                <input
                  type="radio"
                  name="theme-mode"
                  checked={themeMode === 'pastel'}
                  onChange={() => setThemeMode('pastel')}
                />
                <span>
                  Thème pastel ({pastelTheme.label})
                </span>
              </label>
              <label className="pdf-radio">
                <input
                  type="radio"
                  name="theme-mode"
                  checked={themeMode === 'monochrome'}
                  onChange={() => setThemeMode('monochrome')}
                />
                <span>Épuré / Noir &amp; blanc</span>
              </label>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <h3>Métadonnées</h3>
              <p>Inclure l'espace, les dates et les tags dans l'en-tête.</p>
            </div>
            <label className="pdf-checkbox">
              <input
                type="checkbox"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
              />
              <span>Inclure les métadonnées</span>
            </label>
          </section>
        </div>

        <footer className="trash-foot">
          <button type="button" className="action-btn" onClick={onClose} disabled={exporting}>
            Annuler
          </button>
          <button
            type="button"
            className="action-btn primary"
            onClick={() => void handleExport()}
            disabled={exporting}
          >
            {exporting ? 'Exportation…' : 'Exporter en PDF'}
          </button>
        </footer>
      </div>
    </div>
  )
}
