export type PastelThemeId = 'paper' | 'rose' | 'mint' | 'sky' | 'lavender' | 'honey'

export interface ThemeOption {
  id: PastelThemeId
  label: string
  bg: string
  accent: string
}

export const PASTEL_THEMES: ThemeOption[] = [
  { id: 'paper', label: 'Papier naturel', bg: '#f7f4ee', accent: '#b4552f' },
  { id: 'rose', label: 'Rose poudré', bg: '#fcf4f5', accent: '#c85a70' },
  { id: 'mint', label: 'Menthe douce', bg: '#f1f7f4', accent: '#2d8a64' },
  { id: 'sky', label: 'Bleu brume', bg: '#f2f6fa', accent: '#3672b1' },
  { id: 'lavender', label: 'Lavande', bg: '#f6f4f9', accent: '#7a52aa' },
  { id: 'honey', label: 'Pêche veloutée', bg: '#fcf6ed', accent: '#d47828' }
]

export const EDITOR_WIDTH_PRESETS = [
  { value: 640, label: 'Étroit (640 px)' },
  { value: 730, label: 'Standard (730 px)' },
  { value: 850, label: 'Large (850 px)' },
  { value: 960, label: 'Très large (960 px)' }
]

export interface UiSettings {
  theme: PastelThemeId
  defaultSpace: string
  editorWidth: number
  showRelatedNotes: boolean
}

export const DEFAULT_UI_SETTINGS: UiSettings = {
  theme: 'paper',
  defaultSpace: 'auto',
  editorWidth: 730,
  showRelatedNotes: true
}

export function isPastelThemeId(value: unknown): value is PastelThemeId {
  return typeof value === 'string' && PASTEL_THEMES.some((t) => t.id === value)
}

export function parseUiSettings(raw: unknown): UiSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_UI_SETTINGS }
  const obj = raw as Record<string, unknown>

  const theme = isPastelThemeId(obj.theme) ? obj.theme : DEFAULT_UI_SETTINGS.theme
  const defaultSpace = typeof obj.defaultSpace === 'string' ? obj.defaultSpace : DEFAULT_UI_SETTINGS.defaultSpace
  
  let editorWidth = DEFAULT_UI_SETTINGS.editorWidth
  if (typeof obj.editorWidth === 'number' && Number.isFinite(obj.editorWidth)) {
    editorWidth = Math.max(500, Math.min(1200, Math.round(obj.editorWidth)))
  }

  const showRelatedNotes =
    typeof obj.showRelatedNotes === 'boolean'
      ? obj.showRelatedNotes
      : DEFAULT_UI_SETTINGS.showRelatedNotes

  return { theme, defaultSpace, editorWidth, showRelatedNotes }
}

export function resolveInitialSpace(
  defaultSpaceSetting: string,
  availableSpaces: string[],
  fallbackSpace: string
): string {
  if (defaultSpaceSetting === 'auto') return fallbackSpace
  if (defaultSpaceSetting === '' || defaultSpaceSetting === '*') return defaultSpaceSetting
  if (availableSpaces.includes(defaultSpaceSetting)) return defaultSpaceSetting
  return ''
}
