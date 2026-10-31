// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExternalChangeDialog } from '../src/renderer/src/components/ExternalChangeDialog'
import type { ExternalChange } from '../src/shared/external'

function renderChange(change: ExternalChange) {
  const onReload = vi.fn(async () => {})
  const onKeepLocal = vi.fn(async () => {})
  const onOpenMoved = vi.fn(async () => {})
  const onCloseNote = vi.fn(async () => {})
  render(
    <ExternalChangeDialog
      change={change}
      onReload={onReload}
      onKeepLocal={onKeepLocal}
      onOpenMoved={onOpenMoved}
      onCloseNote={onCloseNote}
    />
  )
  return { onReload, onKeepLocal, onOpenMoved, onCloseNote }
}

describe('ExternalChangeDialog — note modifiée', () => {
  it('propose de recharger ou de conserver la version locale', async () => {
    const user = userEvent.setup()
    const { onReload, onKeepLocal } = renderChange({
      kind: 'modified',
      path: 'Notes/Personnages/Alice.md'
    })

    const dialog = screen.getByRole('alertdialog', { name: 'Modification externe' })
    expect(dialog).toHaveAccessibleDescription(/« Alice » a été modifiée en dehors de Decoupe/)
    expect(screen.getByText(/L’enregistrement automatique est suspendu/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Recharger' }))
    await waitFor(() => expect(onReload).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'Conserver ma version' }))
    await waitFor(() => expect(onKeepLocal).toHaveBeenCalledTimes(1))
  })
})

describe('ExternalChangeDialog — note déplacée', () => {
  it('ouvre la note déplacée ou la conserve ici', async () => {
    const user = userEvent.setup()
    const { onOpenMoved, onKeepLocal } = renderChange({
      kind: 'moved',
      path: 'Notes/Personnages/Alice.md',
      movedTo: 'Notes/Lieux/Alice.md'
    })

    expect(
      screen.getByRole('alertdialog', { name: 'Note déplacée' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/« Alice » a été déplacée vers « Notes\/Lieux\/Alice.md »/)
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ouvrir la note déplacée' }))
    await waitFor(() => expect(onOpenMoved).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'Conserver ici' }))
    await waitFor(() => expect(onKeepLocal).toHaveBeenCalledTimes(1))
  })
})

describe('ExternalChangeDialog — note supprimée', () => {
  it('recrée la note ou la ferme', async () => {
    const user = userEvent.setup()
    const { onKeepLocal, onCloseNote } = renderChange({
      kind: 'deleted',
      path: 'Notes/Personnages/Alice.md'
    })

    expect(screen.getByRole('alertdialog', { name: 'Note supprimée' })).toBeInTheDocument()
    expect(screen.getByText(/a été supprimée ou déplacée hors de Decoupe/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Recréer la note' }))
    await waitFor(() => expect(onKeepLocal).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'Fermer la note' }))
    await waitFor(() => expect(onCloseNote).toHaveBeenCalledTimes(1))
  })
})

describe('ExternalChangeDialog — traitement', () => {
  it('désactive les deux actions pendant le traitement', async () => {
    const user = userEvent.setup()
    let resolveReload: () => void = () => {}
    const onReload = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveReload = resolve
        })
    )
    render(
      <ExternalChangeDialog
        change={{ kind: 'modified', path: 'Notes/Personnages/Alice.md' }}
        onReload={onReload}
        onKeepLocal={vi.fn(async () => {})}
        onOpenMoved={vi.fn(async () => {})}
        onCloseNote={vi.fn(async () => {})}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Recharger' }))

    const pending = screen.getByRole('button', { name: 'Traitement…' })
    expect(pending).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Conserver ma version' })).toBeDisabled()

    await act(async () => {
      resolveReload()
    })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Recharger' })).toBeEnabled()
    )
    expect(screen.getByRole('button', { name: 'Conserver ma version' })).toBeEnabled()
  })
})
