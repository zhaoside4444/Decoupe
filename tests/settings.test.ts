import { describe, expect, it } from 'vitest'
import {
  DEFAULT_UI_SETTINGS,
  isPastelThemeId,
  parseUiSettings,
  PASTEL_THEMES,
  resolveInitialSpace
} from '../src/shared/settings'

describe('validation et parsing des réglages UI', () => {
  it('identifie correctement les identifiants de thèmes pastels', () => {
    expect(isPastelThemeId('paper')).toBe(true)
    expect(isPastelThemeId('rose')).toBe(true)
    expect(isPastelThemeId('mint')).toBe(true)
    expect(isPastelThemeId('dark')).toBe(false)
    expect(isPastelThemeId(null)).toBe(false)
  })

  it('retourne les réglages par défaut pour un objet invalide ou vide', () => {
    expect(parseUiSettings(null)).toEqual(DEFAULT_UI_SETTINGS)
    expect(parseUiSettings({})).toEqual(DEFAULT_UI_SETTINGS)
    expect(parseUiSettings('invalid')).toEqual(DEFAULT_UI_SETTINGS)
  })

  it('valide et recadre les paramètres personnalisés', () => {
    const parsed = parseUiSettings({
      theme: 'mint',
      defaultSpace: 'Projet',
      editorWidth: 850,
      showRelatedNotes: false,
      sidebarCollapsed: true,
      listCollapsed: true
    })
    expect(parsed).toEqual({
      theme: 'mint',
      defaultSpace: 'Projet',
      editorWidth: 850,
      showRelatedNotes: false,
      sidebarCollapsed: true,
      listCollapsed: true
    })

    const clamped = parseUiSettings({
      theme: 'unknown',
      editorWidth: 2000
    })
    expect(clamped.theme).toBe('paper')
    expect(clamped.editorWidth).toBe(1200)
    expect(clamped.showRelatedNotes).toBe(true)
    expect(clamped.sidebarCollapsed).toBe(false)
    expect(clamped.listCollapsed).toBe(false)
  })

  it('ignore les états de panneaux non booléens', () => {
    const parsed = parseUiSettings({ sidebarCollapsed: 'oui', listCollapsed: 1 })
    expect(parsed.sidebarCollapsed).toBe(false)
    expect(parsed.listCollapsed).toBe(false)
  })

  it('inclut 6 thèmes pastels carnets de notes', () => {
    expect(PASTEL_THEMES).toHaveLength(6)
    expect(PASTEL_THEMES.map((t) => t.id)).toEqual([
      'paper',
      'rose',
      'mint',
      'sky',
      'lavender',
      'honey'
    ])
  })

  it('résout l espace d ouverture par défaut', () => {
    const spaces = ['Projet', 'Perso']
    expect(resolveInitialSpace('auto', spaces, 'Perso')).toBe('Perso')
    expect(resolveInitialSpace('', spaces, 'Perso')).toBe('')
    expect(resolveInitialSpace('*', spaces, 'Perso')).toBe('*')
    expect(resolveInitialSpace('Projet', spaces, 'Perso')).toBe('Projet')
    expect(resolveInitialSpace('Inexistant', spaces, 'Perso')).toBe('')
  })
})
