import {
  DEFAULT_UI_SETTINGS,
  parseUiSettings,
  type UiSettings
} from '@shared/settings'

const STORAGE_KEY = 'decoupe.ui-settings'

export function loadUiSettings(): UiSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_UI_SETTINGS }
    return parseUiSettings(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_UI_SETTINGS }
  }
}

export function saveUiSettings(settings: UiSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Stockage local indisponible : ignoré.
  }
}

export function applyUiThemeAndWidth(settings: UiSettings): void {
  const root = document.documentElement
  root.dataset.theme = settings.theme
  root.style.setProperty('--editor-max-width', `${settings.editorWidth}px`)
}
