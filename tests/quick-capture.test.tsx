// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickCapture } from '../src/renderer/src/components/QuickCapture'
import { installApi } from './helpers/api'
import type { CreatedNote } from '../src/shared/types'

const created: CreatedNote = {
  path: 'Notes/Boîte d’entrée/2026-11-01.md',
  base: '2026-11-01',
  title: '2026-11-01'
}

function setupApi() {
  return installApi({
    createNote: vi.fn(async () => created),
    closeCapture: vi.fn(async () => {})
  })
}

function textarea(): HTMLTextAreaElement {
  return screen.getByPlaceholderText('Écrivez, collez, respirez…')
}

describe('QuickCapture — saisie', () => {
  it('donne le focus au champ et désactive l’enregistrement à vide', () => {
    setupApi()
    render(<QuickCapture />)

    expect(screen.getByText('Capture rapide')).toBeInTheDocument()
    expect(textarea()).toHaveFocus()
    expect(screen.getByRole('button', { name: /Enregistrer/ })).toBeDisabled()
  })

  it('enregistre le contenu nettoyé dans la boîte d’entrée', async () => {
    const api = setupApi()
    const user = userEvent.setup()
    render(<QuickCapture />)

    await user.type(textarea(), '  Une idée de scène.  ')
    expect(screen.getByText('Boîte d’entrée')).toBeInTheDocument()

    const save = screen.getByRole('button', { name: /Enregistrer/ })
    expect(save).toBeEnabled()
    await user.click(save)

    await waitFor(() =>
      expect(api.createNote).toHaveBeenCalledWith('', 'Une idée de scène.')
    )
    expect(api.closeCapture).toHaveBeenCalledTimes(1)
  })

  it('enregistre avec Ctrl+Entrée', async () => {
    const api = setupApi()
    const user = userEvent.setup()
    render(<QuickCapture />)

    await user.type(textarea(), 'Note éclair')
    await user.keyboard('{Control>}{Enter}{/Control}')

    await waitFor(() => expect(api.createNote).toHaveBeenCalledWith('', 'Note éclair'))
    expect(api.closeCapture).toHaveBeenCalledTimes(1)
  })

  it('ferme sans enregistrer avec Échap', async () => {
    const api = setupApi()
    const user = userEvent.setup()
    render(<QuickCapture />)

    await user.type(textarea(), 'Brouillon')
    await user.keyboard('{Escape}')

    expect(api.closeCapture).toHaveBeenCalledTimes(1)
    expect(api.createNote).not.toHaveBeenCalled()
  })

  it('désactive le bouton pendant l’enregistrement', async () => {
    let resolve: (note: CreatedNote) => void = () => {}
    const api = installApi({
      createNote: vi.fn(
        () =>
          new Promise<CreatedNote>((done) => {
            resolve = done
          })
      ),
      closeCapture: vi.fn(async () => {})
    })
    const user = userEvent.setup()
    render(<QuickCapture />)

    await user.type(textarea(), 'En cours')
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }))

    const save = screen.getByRole('button', { name: /Enregistrer/ })
    expect(save).toBeDisabled()

    await act(async () => resolve(created))
    await waitFor(() => expect(api.closeCapture).toHaveBeenCalledTimes(1))
  })
})
