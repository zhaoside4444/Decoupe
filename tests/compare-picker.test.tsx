// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComparePicker } from '../src/renderer/src/components/ComparePicker'
import type { NoteSummary } from '../src/shared/types'

const alice: NoteSummary = {
  path: 'Notes/Personnages/Alice.md',
  title: 'Alice',
  base: 'Alice',
  space: 'Personnages',
  createdAt: '2026-10-01',
  updatedAt: Date.UTC(2026, 9, 30, 10, 0),
  excerpt: 'Héroïne.',
  tags: []
}

const bob: NoteSummary = {
  path: 'Notes/Personnages/Bob.md',
  title: 'Bob',
  base: 'Bob',
  space: 'Personnages',
  createdAt: '2026-10-02',
  updatedAt: Date.UTC(2026, 9, 29, 10, 0),
  excerpt: 'Allié fidèle.',
  tags: [],
  pinned: true
}

const chapitre: NoteSummary = {
  path: 'Notes/Chapitres/Chapitre 1.md',
  title: 'Chapitre 1',
  base: 'Chapitre 1',
  space: 'Chapitres',
  createdAt: '2026-10-03',
  updatedAt: Date.UTC(2026, 9, 28, 10, 0),
  excerpt: 'Début.',
  tags: []
}

const notes = [alice, bob, chapitre]

function renderPicker(overrides: Partial<Parameters<typeof ComparePicker>[0]> = {}) {
  const props = {
    notes,
    selectedPath: alice.path,
    onPick: vi.fn(),
    onClose: vi.fn(),
    ...overrides
  }
  render(<ComparePicker {...props} />)
  return props
}

describe('ComparePicker', () => {
  it('propose les autres notes, la note active exclue', () => {
    renderPicker()

    expect(screen.getByRole('dialog', { name: 'Comparer avec une note' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Alice/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bob/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Chapitre 1/ })).toBeInTheDocument()
  })

  it('filtre sur le titre, l’espace et sans tenir compte des accents', async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.type(screen.getByRole('textbox', { name: 'Choisir une note à comparer' }), 'chapit')
    expect(screen.queryByRole('button', { name: /Bob/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Chapitre 1/ })).toBeInTheDocument()
  })

  it('choisit une note au clic', async () => {
    const user = userEvent.setup()
    const props = renderPicker()

    await user.click(screen.getByRole('button', { name: /Chapitre 1/ }))
    expect(props.onPick).toHaveBeenCalledWith(chapitre.path)
  })

  it('navigue au clavier et valide avec Entrée', async () => {
    const user = userEvent.setup()
    const props = renderPicker()
    const input = screen.getByRole('textbox', { name: 'Choisir une note à comparer' })

    await user.click(input)
    await user.keyboard('{ArrowDown}{Enter}')
    expect(props.onPick).toHaveBeenCalledWith(chapitre.path)
  })

  it('ferme sur Échap', async () => {
    const user = userEvent.setup()
    const props = renderPicker()

    await user.keyboard('{Escape}')
    expect(props.onClose).toHaveBeenCalled()
  })

  it('affiche un état vide quand il n’y a aucune autre note', async () => {
    const user = userEvent.setup()
    renderPicker({ notes: [alice] })

    expect(
      screen.getByText('Aucune autre note à comparer dans ce vault.')
    ).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Choisir une note à comparer' }), 'zzz')
    expect(screen.getByText('Aucune autre note à comparer dans ce vault.')).toBeInTheDocument()
  })
})
