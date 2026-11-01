// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Onboarding } from '../src/renderer/src/components/Onboarding'
import { installApi } from './helpers/api'
import type { VaultInfo } from '../src/shared/types'

const vault: VaultInfo = { path: 'C:\\Decoupe\\Mes notes', name: 'Mes notes' }

type Props = Parameters<typeof Onboarding>[0]

function renderOnboarding(overrides: Partial<Props> = {}) {
  const props: Props = {
    onReady: vi.fn(async () => {}),
    onError: vi.fn(),
    ...overrides
  }
  render(<Onboarding {...props} />)
  return props
}

describe('Onboarding — présentation', () => {
  it('présente l’application et ses principes', () => {
    installApi()
    renderOnboarding()

    expect(screen.getByRole('heading', { level: 1, name: 'Decoupe' })).toBeInTheDocument()
    expect(screen.getByText(/Prenez des notes sans réfléchir/)).toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText(/Fichiers Markdown rangés sur votre disque/)).toBeInTheDocument()
  })
})

describe('Onboarding — ouverture d’un dossier', () => {
  it('crée un dossier puis prévient l’application', async () => {
    const api = installApi({
      createVault: vi.fn(async () => vault),
      openVault: vi.fn(async () => null)
    })
    const user = userEvent.setup()
    const props = renderOnboarding()

    await user.click(screen.getByRole('button', { name: /Créer un dossier de notes/ }))

    await waitFor(() => expect(props.onReady).toHaveBeenCalledWith(vault))
    expect(api.createVault).toHaveBeenCalledTimes(1)
    expect(api.openVault).not.toHaveBeenCalled()
  })

  it('ouvre un dossier existant', async () => {
    const api = installApi({
      createVault: vi.fn(async () => null),
      openVault: vi.fn(async () => vault)
    })
    const user = userEvent.setup()
    const props = renderOnboarding()

    await user.click(screen.getByRole('button', { name: /Ouvrir un dossier existant/ }))

    await waitFor(() => expect(props.onReady).toHaveBeenCalledWith(vault))
    expect(api.openVault).toHaveBeenCalledTimes(1)
    expect(api.createVault).not.toHaveBeenCalled()
  })

  it('ne fait rien quand la sélection est annulée', async () => {
    installApi({ createVault: vi.fn(async () => null) })
    const user = userEvent.setup()
    const props = renderOnboarding()

    await user.click(screen.getByRole('button', { name: /Créer un dossier de notes/ }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Créer un dossier de notes/ })).toBeEnabled()
    )
    expect(props.onReady).not.toHaveBeenCalled()
    expect(props.onError).not.toHaveBeenCalled()
  })

  it('remonte le message d’erreur', async () => {
    installApi({
      openVault: vi.fn(async () => {
        throw new Error('Accès refusé')
      })
    })
    const user = userEvent.setup()
    const props = renderOnboarding()

    await user.click(screen.getByRole('button', { name: /Ouvrir un dossier existant/ }))

    await waitFor(() => expect(props.onError).toHaveBeenCalledWith('Accès refusé'))
    expect(props.onReady).not.toHaveBeenCalled()
  })

  it('désactive les deux actions pendant l’ouverture', async () => {
    let resolve: (info: VaultInfo | null) => void = () => {}
    installApi({
      createVault: vi.fn(
        () =>
          new Promise<VaultInfo | null>((done) => {
            resolve = done
          })
      )
    })
    const user = userEvent.setup()
    renderOnboarding()

    const create = screen.getByRole('button', { name: /Créer un dossier de notes/ })
    await user.click(create)

    expect(create).toBeDisabled()
    expect(screen.getByRole('button', { name: /Ouvrir un dossier existant/ })).toBeDisabled()

    await act(async () => resolve(vault))
    await waitFor(() => expect(create).toBeEnabled())
  })
})
