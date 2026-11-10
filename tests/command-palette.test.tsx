// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommandPalette } from '../src/renderer/src/components/CommandPalette'
import type { NoteSummary, Space, TagSummary } from '../src/shared/types'

const notes: NoteSummary[] = [
  {
    path: 'Notes/Personnages/Alice.md',
    title: 'Alice',
    base: 'Alice',
    space: 'Personnages',
    createdAt: '2026-10-01',
    updatedAt: 1,
    excerpt: 'Héroïne.',
    tags: ['personnage']
  },
  {
    path: 'Notes/Chapitres/Chapitre 1.md',
    title: 'Chapitre 1',
    base: 'Chapitre 1',
    space: 'Chapitres',
    createdAt: '2026-10-02',
    updatedAt: 2,
    excerpt: 'Début.',
    tags: ['chapitre']
  }
]

const spaces: Space[] = [
  { name: 'Personnages', count: 1 },
  { name: 'Chapitres', count: 1 }
]

const tagStats: TagSummary[] = [{ name: 'personnage', count: 1 }]

function renderPalette(overrides: Partial<Parameters<typeof CommandPalette>[0]> = {}) {
  const props = {
    notes,
    spaces,
    tagStats,
    selectedPath: 'Notes/Personnages/Alice.md',
    selectedPinned: false,
    onClose: vi.fn(),
    onNewNote: vi.fn(),
    onOpenNote: vi.fn(),
    onSelectSpace: vi.fn(),
    onTagFilter: vi.fn(),
    onTogglePinCurrent: vi.fn(),
    onTrashCurrent: vi.fn(),
    onMoveCurrent: vi.fn(),
    onOpenTrash: vi.fn(),
    onOpenBackups: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenTimeline: vi.fn(),
    onExportPdf: vi.fn(),
    onSortChange: vi.fn(),
    onToggleRelatedNotes: vi.fn(),
    ...overrides
  }
  render(<CommandPalette {...props} />)
  return props
}

function paletteInput(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Recherche dans la palette' })
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('CommandPalette', () => {
  it('ouvre la palette avec le focus et ferme avec Échap', async () => {
    const user = userEvent.setup()
    const props = renderPalette()

    expect(screen.getByRole('dialog', { name: 'Palette de commandes' })).toBeInTheDocument()
    await waitFor(() => expect(paletteInput()).toHaveFocus())
    expect(screen.getByText('Nouvelle note')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('filtre les entrées et exécute un espace au clic', async () => {
    const user = userEvent.setup()
    const props = renderPalette()

    await user.type(paletteInput(), 'chapitres')
    const row = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.startsWith('Chapitres'))
    if (!row) throw new Error('Entrée espace introuvable')
    expect(row).toHaveTextContent('1 note')

    await user.click(row)
    expect(props.onClose).toHaveBeenCalledTimes(1)
    expect(props.onSelectSpace).toHaveBeenCalledWith('Chapitres')
  })

  it('filtre une note et l’ouvre au clic', async () => {
    const user = userEvent.setup()
    const props = renderPalette()

    await user.type(paletteInput(), 'Alice')
    await user.click(screen.getByRole('button', { name: /Alice/ }))

    expect(props.onOpenNote).toHaveBeenCalledWith('Notes/Personnages/Alice.md')
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('navigue avec les flèches et exécute l’entrée active', async () => {
    const user = userEvent.setup()
    const props = renderPalette()

    await user.type(paletteInput(), 'Trier')
    expect(screen.getAllByRole('button')).toHaveLength(3)

    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    expect(props.onSortChange).toHaveBeenCalledWith('created')
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('affiche l’état vide et ignore Entrée', async () => {
    const user = userEvent.setup()
    const props = renderPalette()

    await user.type(paletteInput(), 'introuvable')
    expect(screen.getByText('Aucun résultat.')).toBeInTheDocument()

    await user.keyboard('{Enter}')
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('propose de comparer la note ouverte', async () => {
    const user = userEvent.setup()
    const props = renderPalette({ onCompareWith: vi.fn() })

    await user.type(paletteInput(), 'Comparer avec')
    await user.click(screen.getByRole('button', { name: /Comparer avec une autre note/ }))

    expect(props.onCompareWith).toHaveBeenCalled()
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('propose de fermer la comparaison en cours', async () => {
    const user = userEvent.setup()
    const props = renderPalette({
      comparePath: 'Notes/Chapitres/Chapitre 1.md',
      onCloseCompare: vi.fn()
    })

    await user.type(paletteInput(), 'Fermer la comparaison')
    await user.click(screen.getByRole('button', { name: 'Fermer la comparaison' }))

    expect(props.onCloseCompare).toHaveBeenCalled()
  })
})
