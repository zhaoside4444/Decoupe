// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BackupDialog } from '../src/renderer/src/components/BackupDialog'
import { installApi, sampleBackup, sampleOverview } from './helpers/api'

function renderBackup() {
  const onClose = vi.fn()
  const onRestore = vi.fn(async () => {})
  const onNotice = vi.fn()
  const onError = vi.fn()
  render(
    <BackupDialog
      onClose={onClose}
      onRestore={onRestore}
      onNotice={onNotice}
      onError={onError}
    />
  )
  return { onClose, onRestore, onNotice, onError }
}

let api: ReturnType<typeof installApi>

beforeEach(() => {
  api = installApi()
})

describe('BackupDialog — chargement', () => {
  it('affiche les sauvegardes, les réglages et le dossier', async () => {
    renderBackup()

    expect(await screen.findByText('Sauvegarde manuelle')).toBeInTheDocument()
    expect(screen.getByText('1 sauvegarde locale')).toBeInTheDocument()
    expect(screen.getByText(/·/)).toHaveTextContent('2 Ko')
    expect(screen.getByRole('button', { name: /Sauvegarder maintenant/ })).toBeEnabled()
    expect(
      screen.getByRole('checkbox', { name: /Sauvegarde automatique/ })
    ).toBeChecked()
    expect(screen.getByRole('combobox', { name: 'Fréquence' })).toHaveValue('24')
    expect(screen.getByRole('combobox', { name: 'Conserver' })).toHaveValue('10')
    expect(screen.getByText('C:\\Decoupe\\backups')).toBeInTheDocument()
  })

  it('affiche un état vide quand aucune sauvegarde n’existe', async () => {
    installApi({
      backupOverview: vi.fn(async () => ({ ...sampleOverview, entries: [] }))
    })
    renderBackup()

    expect(
      await screen.findByText('Aucune sauvegarde pour le moment.')
    ).toBeInTheDocument()
    expect(screen.getByText('0 sauvegarde locale')).toBeInTheDocument()
  })

  it('signale une erreur de chargement et propose de réessayer', async () => {
    installApi({
      backupOverview: vi.fn(async () => {
        throw new Error('Dossier inaccessible')
      })
    })
    const { onError } = renderBackup()

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Dossier inaccessible'))
    expect(await screen.findByText('Sauvegardes indisponibles.')).toBeInTheDocument()
  })
})

describe('BackupDialog — actions', () => {
  it('crée une sauvegarde manuelle puis recharge la liste', async () => {
    const user = userEvent.setup()
    const { onNotice } = renderBackup()
    await screen.findByText('Sauvegarde manuelle')

    await user.click(screen.getByRole('button', { name: /Sauvegarder maintenant/ }))

    await waitFor(() =>
      expect(api.createBackup).toHaveBeenCalledWith('Sauvegarde manuelle')
    )
    expect(api.backupOverview).toHaveBeenCalledTimes(2)
    expect(onNotice).toHaveBeenCalledWith('Sauvegarde créée.')
  })

  it('exporte le vault et signale la destination', async () => {
    const user = userEvent.setup()
    api.exportVault.mockResolvedValue('D:\\Exports\\Roman')
    const { onNotice } = renderBackup()
    await screen.findByText('Sauvegarde manuelle')

    await user.click(screen.getByRole('button', { name: /Exporter le vault/ }))

    await waitFor(() => expect(api.exportVault).toHaveBeenCalledTimes(1))
    expect(onNotice).toHaveBeenCalledWith('Vault exporté vers D:\\Exports\\Roman')
  })

  it('enregistre les réglages de sauvegarde automatique', async () => {
    const user = userEvent.setup()
    renderBackup()
    await screen.findByText('Sauvegarde manuelle')

    await user.click(screen.getByRole('checkbox', { name: /Sauvegarde automatique/ }))
    await waitFor(() =>
      expect(api.updateBackupSettings).toHaveBeenLastCalledWith({
        ...sampleOverview.settings,
        enabled: false
      })
    )

    await user.click(screen.getByRole('checkbox', { name: /Sauvegarde automatique/ }))
    await waitFor(() =>
      expect(api.updateBackupSettings).toHaveBeenLastCalledWith({
        ...sampleOverview.settings,
        enabled: true
      })
    )

    await user.selectOptions(screen.getByRole('combobox', { name: 'Fréquence' }), '12')
    await waitFor(() =>
      expect(api.updateBackupSettings).toHaveBeenLastCalledWith({
        ...sampleOverview.settings,
        intervalHours: 12
      })
    )

    await user.selectOptions(screen.getByRole('combobox', { name: 'Conserver' }), '20')
    await waitFor(() =>
      expect(api.updateBackupSettings).toHaveBeenLastCalledWith({
        ...sampleOverview.settings,
        intervalHours: 12,
        retention: 20
      })
    )
  })

  it('restaure une sauvegarde après confirmation', async () => {
    const user = userEvent.setup()
    const { onRestore } = renderBackup()
    await screen.findByText('Sauvegarde manuelle')

    await user.click(screen.getByRole('button', { name: 'Restaurer' }))
    expect(screen.getByText('Remplacer le vault ?')).toBeInTheDocument()
    expect(onRestore).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Restaurer' }))
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith(sampleBackup))
  })

  it('supprime une sauvegarde après confirmation', async () => {
    const user = userEvent.setup()
    const { onNotice } = renderBackup()
    await screen.findByText('Sauvegarde manuelle')

    await user.click(screen.getByRole('button', { name: 'Supprimer cette sauvegarde' }))
    expect(screen.getByText('Supprimer ?')).toBeInTheDocument()
    expect(api.deleteBackup).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByText('Supprimer ?')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Supprimer cette sauvegarde' }))
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(api.deleteBackup).toHaveBeenCalledWith('backup-1'))
    expect(onNotice).toHaveBeenCalledWith('Sauvegarde supprimée.')
  })
})

describe('BackupDialog — fermeture', () => {
  it('ferme avec Échap, le bouton et le clic sur le fond', async () => {
    const user = userEvent.setup()
    const { onClose } = renderBackup()
    await screen.findByText('Sauvegarde manuelle')

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Fermer les sauvegardes' }))
    expect(onClose).toHaveBeenCalledTimes(2)

    await user.click(document.querySelector('.trash-overlay') as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
