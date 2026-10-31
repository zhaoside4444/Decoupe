// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrashDialog } from '../src/renderer/src/components/TrashDialog'
import type { TrashItem } from '../src/shared/types'

const noteItem: TrashItem = {
  path: '.decoupe/corbeille/2026-10-30-Alice.md',
  kind: 'note',
  name: '2026-10-30-Alice.md',
  title: 'Alice',
  originalPath: 'Notes/Personnages/Alice.md',
  deletedAt: Date.UTC(2026, 9, 30, 12, 0)
}

const spaceItem: TrashItem = {
  path: '.decoupe/corbeille/2026-10-30-Lieux',
  kind: 'space',
  name: '2026-10-30-Lieux',
  title: 'Lieux',
  originalPath: null,
  deletedAt: Date.UTC(2026, 9, 30, 13, 0)
}

function renderTrash(items: TrashItem[] = [noteItem, spaceItem]) {
  const onClose = vi.fn()
  const onRestore = vi.fn(async (_item: TrashItem) => {})
  const onDelete = vi.fn(async (_item: TrashItem) => {})
  render(<TrashDialog items={items} onClose={onClose} onRestore={onRestore} onDelete={onDelete} />)
  return { onClose, onRestore, onDelete }
}

describe('TrashDialog — contenu', () => {
  it('affiche l’état vide', () => {
    renderTrash([])

    expect(screen.getByRole('dialog', { name: 'Corbeille' })).toBeInTheDocument()
    expect(screen.getByText('La corbeille est vide.')).toBeInTheDocument()
    expect(screen.getByText('Aucun élément supprimé')).toBeInTheDocument()
  })

  it('liste les notes et les dossiers avec leur emplacement', () => {
    renderTrash()

    expect(screen.getByText('2 éléments supprimés')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText(/Note · Personnages ·/)).toBeInTheDocument()
    expect(screen.getByText(/Dossier ·/)).toBeInTheDocument()
  })
})

describe('TrashDialog — actions', () => {
  it('restaure un élément', async () => {
    const user = userEvent.setup()
    const { onRestore } = renderTrash([noteItem])

    await user.click(screen.getByRole('button', { name: 'Restaurer' }))
    expect(onRestore).toHaveBeenCalledWith(noteItem)
  })

  it('demande confirmation avant une suppression définitive', async () => {
    const user = userEvent.setup()
    const { onDelete } = renderTrash([noteItem])

    await user.click(
      screen.getByRole('button', { name: 'Supprimer définitivement Alice' })
    )
    expect(screen.getByText('Définitivement ?')).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByText('Définitivement ?')).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Supprimer définitivement Alice' })
    )
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(noteItem))
  })

  it('ferme avec Échap, le bouton de fermeture et le clic sur le fond', async () => {
    const user = userEvent.setup()
    const { onClose } = renderTrash()

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Fermer la corbeille' }))
    expect(onClose).toHaveBeenCalledTimes(2)

    await user.click(document.querySelector('.trash-overlay') as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
