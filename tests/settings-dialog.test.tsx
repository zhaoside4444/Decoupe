// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsDialog } from '../src/renderer/src/components/SettingsDialog'
import { DEFAULT_UI_SETTINGS } from '../src/shared/settings'
import { installApi, sampleOverview } from './helpers/api'

const spaces = [
  { name: 'Personnages', count: 2 },
  { name: 'Chapitres', count: 3 }
]

function renderSettings() {
  const onUpdateSettings = vi.fn()
  const onClose = vi.fn()
  const onNotice = vi.fn()
  const onError = vi.fn()
  render(
    <SettingsDialog
      settings={DEFAULT_UI_SETTINGS}
      spaces={spaces}
      onUpdateSettings={onUpdateSettings}
      onClose={onClose}
      onNotice={onNotice}
      onError={onError}
    />
  )
  return { onUpdateSettings, onClose, onNotice, onError }
}

let api: ReturnType<typeof installApi>

beforeEach(() => {
  api = installApi()
})

describe('SettingsDialog — réglages', () => {
  it('change le thème', async () => {
    const user = userEvent.setup()
    const { onUpdateSettings } = renderSettings()

    await user.click(screen.getByRole('button', { name: /Rose poudré/ }))
    expect(onUpdateSettings).toHaveBeenCalledWith({ ...DEFAULT_UI_SETTINGS, theme: 'rose' })
  })

  it('change la largeur via un préréglage et le curseur', async () => {
    const user = userEvent.setup()
    const { onUpdateSettings } = renderSettings()

    await user.click(screen.getByRole('button', { name: 'Large (850 px)' }))
    expect(onUpdateSettings).toHaveBeenLastCalledWith({
      ...DEFAULT_UI_SETTINGS,
      editorWidth: 850
    })

    const slider = screen.getByRole('slider', { name: "Largeur de l'éditeur en pixels" })
    // user-event ne sait pas piloter un input range : on simule le changement natif.
    fireEvent.change(slider, { target: { value: '900' } })
    expect(onUpdateSettings).toHaveBeenLastCalledWith({
      ...DEFAULT_UI_SETTINGS,
      editorWidth: 900
    })
  })

  it('change l’espace d’ouverture par défaut', async () => {
    const user = userEvent.setup()
    const { onUpdateSettings } = renderSettings()

    await user.selectOptions(
      screen.getByRole('combobox', { name: "Espace d'ouverture par défaut" }),
      'Chapitres'
    )
    expect(onUpdateSettings).toHaveBeenCalledWith({
      ...DEFAULT_UI_SETTINGS,
      defaultSpace: 'Chapitres'
    })
  })

  it('active ou désactive les suggestions de notes liées', async () => {
    const user = userEvent.setup()
    const { onUpdateSettings } = renderSettings()

    const toggle = screen.getByRole('checkbox', {
      name: /Activer les suggestions de notes liées/
    })
    expect(toggle).toBeChecked()

    await user.click(toggle)
    expect(onUpdateSettings).toHaveBeenCalledWith({
      ...DEFAULT_UI_SETTINGS,
      showRelatedNotes: false
    })
  })

  it('ajuste la rétention des sauvegardes via l’API', async () => {
    const user = userEvent.setup()
    const { onNotice } = renderSettings()

    const select = await screen.findByRole('combobox', {
      name: 'Nombre de sauvegardes à conserver'
    })
    await user.selectOptions(select, '20')

    await waitFor(() =>
      expect(api.updateBackupSettings).toHaveBeenCalledWith({
        ...sampleOverview.settings,
        retention: 20
      })
    )
    expect(onNotice).toHaveBeenCalledWith('Rétention des sauvegardes ajustée à 20.')
  })

  it('signale une erreur de rétention sans fermer', async () => {
    const user = userEvent.setup()
    installApi({
      updateBackupSettings: vi.fn(async () => {
        throw new Error('Disque plein')
      })
    })
    const { onError, onClose } = renderSettings()

    const select = await screen.findByRole('combobox', {
      name: 'Nombre de sauvegardes à conserver'
    })
    await user.selectOptions(select, '3')

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Disque plein'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('SettingsDialog — fermeture', () => {
  it('ferme avec Échap, le bouton et le fond', async () => {
    const user = userEvent.setup()
    const { onClose } = renderSettings()

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Fermer les réglages' }))
    expect(onClose).toHaveBeenCalledTimes(2)

    await user.click(document.querySelector('.trash-overlay') as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
