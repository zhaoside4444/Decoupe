import { useEffect, useState } from 'react'
import { Check, Sliders, X } from 'lucide-react'
import type { BackupOverview, Space } from '@shared/types'
import {
  EDITOR_WIDTH_PRESETS,
  PASTEL_THEMES,
  type PastelThemeId,
  type UiSettings
} from '@shared/settings'
import { errorMessage, restoreFocusIfLost } from '../util'

interface SettingsDialogProps {
  settings: UiSettings
  spaces: Space[]
  onUpdateSettings: (next: UiSettings) => void
  onClose: () => void
  onNotice: (message: string) => void
  onError: (message: string) => void
}

const RETENTION_OPTIONS = [
  { value: 3, label: '3 sauvegardes' },
  { value: 5, label: '5 sauvegardes' },
  { value: 10, label: '10 sauvegardes' },
  { value: 20, label: '20 sauvegardes' },
  { value: 50, label: '50 sauvegardes' }
]

export function SettingsDialog({
  settings,
  spaces,
  onUpdateSettings,
  onClose,
  onNotice,
  onError
}: SettingsDialogProps) {
  const [backupOverview, setBackupOverview] = useState<BackupOverview | null>(null)
  const [retentionBusy, setRetentionBusy] = useState(false)

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

  useEffect(() => {
    let cancelled = false
    void window.api
      .backupOverview()
      .then((overview) => {
        if (!cancelled) setBackupOverview(overview)
      })
      .catch(() => {
        // Sauvegardes non initialisées : ignoré silencieusement dans la modale
      })
    return () => {
      cancelled = true
    }
  }, [])

  function updateTheme(theme: PastelThemeId): void {
    onUpdateSettings({ ...settings, theme })
  }

  function updateWidth(editorWidth: number): void {
    onUpdateSettings({ ...settings, editorWidth })
  }

  function updateDefaultSpace(defaultSpace: string): void {
    onUpdateSettings({ ...settings, defaultSpace })
  }

  async function updateRetention(retention: number): Promise<void> {
    if (!backupOverview || retentionBusy) return
    setRetentionBusy(true)
    try {
      const updated = await window.api.updateBackupSettings({
        ...backupOverview.settings,
        retention
      })
      setBackupOverview({ ...backupOverview, settings: updated })
      onNotice(`Rétention des sauvegardes ajustée à ${retention}.`)
    } catch (error) {
      onError(errorMessage(error))
    } finally {
      setRetentionBusy(false)
    }
  }

  return (
    <div
      className="trash-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="trash-dialog settings-dialog" role="dialog" aria-label="Réglages de l’application">
        <header className="trash-head">
          <div>
            <h2>Réglages</h2>
            <p>Personnalisez l’apparence et le comportement de votre carnet de notes.</p>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Fermer les réglages"
            onClick={onClose}
            autoFocus
          >
            <X size={15} />
          </button>
        </header>

        <div className="settings-body">
          <section className="settings-section">
            <div className="settings-section-head">
              <h3>Thème carnet</h3>
              <p>Sélectionnez une palette douce inspirée des carnets de papier.</p>
            </div>
            <div className="theme-grid">
              {PASTEL_THEMES.map((theme) => {
                const isActive = settings.theme === theme.id
                return (
                  <button
                    key={theme.id}
                    type="button"
                    className={`theme-card ${isActive ? 'is-active' : ''}`}
                    onClick={() => updateTheme(theme.id)}
                  >
                    <span className="theme-preview" style={{ background: theme.bg }}>
                      <span className="theme-swatch" style={{ background: theme.accent }} />
                    </span>
                    <span className="theme-info">
                      <span className="theme-label">{theme.label}</span>
                      {isActive && <Check size={12} className="theme-check" />}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <h3>Largeur de l’éditeur</h3>
              <p>Ajustez le confort de lecture et de saisie des pages Markdown.</p>
            </div>
            <div className="settings-row">
              <div className="presets-bar">
                {EDITOR_WIDTH_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className={`preset-btn ${settings.editorWidth === preset.value ? 'is-active' : ''}`}
                    onClick={() => updateWidth(preset.value)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="slider-row">
                <Sliders size={14} className="slider-icon" />
                <input
                  type="range"
                  min="520"
                  max="1100"
                  step="10"
                  value={settings.editorWidth}
                  aria-label="Largeur de l'éditeur en pixels"
                  onChange={(event) => updateWidth(Number(event.target.value))}
                />
                <span className="slider-value">{settings.editorWidth} px</span>
              </div>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <h3>Ouverture de l’application</h3>
              <p>Choisissez l’espace ou le filtre affiché à chaque lancement.</p>
            </div>
            <div className="settings-row">
              <select
                className="settings-select"
                value={settings.defaultSpace}
                aria-label="Espace d'ouverture par défaut"
                onChange={(event) => updateDefaultSpace(event.target.value)}
              >
                <option value="auto">Automatique (espace de la première note)</option>
                <option value="">Boîte d’entrée</option>
                <option value="*">Toutes les notes</option>
                {spaces.map((space) => (
                  <option key={space.name} value={space.name}>
                    {space.name}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <h3>Suggestions de notes liées</h3>
              <p>Affichez automatiquement en bas de page les notes partageant des tags ou des liens.</p>
            </div>
            <div className="settings-row">
              <label className="settings-toggle-label">
                <input
                  type="checkbox"
                  checked={settings.showRelatedNotes}
                  onChange={(event) =>
                    onUpdateSettings({ ...settings, showRelatedNotes: event.target.checked })
                  }
                />
                <span>Activer les suggestions de notes liées</span>
              </label>
            </div>
          </section>

          {backupOverview ? (
            <section className="settings-section">
              <div className="settings-section-head">
                <h3>Rétention des sauvegardes</h3>
                <p>Conservez un nombre défini d’instantanés de sécurité automatiques.</p>
              </div>
              <div className="settings-row">
                <select
                  className="settings-select"
                  value={backupOverview.settings.retention}
                  disabled={retentionBusy}
                  aria-label="Nombre de sauvegardes à conserver"
                  onChange={(event) => void updateRetention(Number(event.target.value))}
                >
                  {RETENTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </section>
          ) : null}
        </div>

        <footer className="trash-foot">
          <button type="button" className="action-btn" onClick={onClose}>
            Fermer
          </button>
        </footer>
      </div>
    </div>
  )
}
