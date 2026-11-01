// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BacklinksPanel } from '../src/renderer/src/components/BacklinksPanel'
import { formatDate } from '../src/renderer/src/util'
import type { BacklinkEntry } from '../src/shared/types'

const paris: BacklinkEntry = {
  path: 'Notes/Lieux/Paris.md',
  base: 'Paris',
  title: 'Paris',
  space: '',
  updatedAt: Date.UTC(2020, 0, 2, 10, 0),
  occurrences: 3,
  snippet: 'Au cœur de [[Paris]], la Seine.'
}

const chapitre: BacklinkEntry = {
  path: 'Notes/Chapitres/Chapitre 1.md',
  base: 'Chapitre 1',
  title: 'Chapitre 1',
  space: 'Chapitres',
  updatedAt: Date.UTC(2020, 0, 3, 10, 0),
  occurrences: 1,
  snippet: ''
}

type Props = Parameters<typeof BacklinksPanel>[0]

function renderPanel(overrides: Partial<Props> = {}) {
  const props: Props = {
    noteTitle: 'Alice',
    noteBase: 'Alice',
    entries: [paris, chapitre],
    loading: false,
    error: null,
    onOpen: vi.fn(),
    onRefresh: vi.fn(),
    onClose: vi.fn(),
    ...overrides
  }
  const view = render(<BacklinksPanel {...props} />)
  return { ...props, container: view.container }
}

describe('BacklinksPanel — contenu', () => {
  it('liste les liens entrants avec espace, date et occurrences', async () => {
    const user = userEvent.setup()
    const props = renderPanel()

    const panel = screen.getByRole('complementary', { name: 'Liens entrants' })
    expect(panel).toHaveAttribute('aria-busy', 'false')
    expect(screen.getByRole('heading', { level: 2, name: 'Liens entrants' })).toBeInTheDocument()
    expect(panel.querySelector('.backlinks-count')).toHaveTextContent('2')

    const first = screen.getByTitle(paris.path)
    expect(first).toHaveTextContent('Paris')
    expect(first).toHaveTextContent(`Boîte d’entrée · ${formatDate(paris.updatedAt)} · 3 liens`)
    expect(first).toHaveTextContent('Au cœur de [[Paris]], la Seine.')

    const second = screen.getByTitle(chapitre.path)
    expect(second).toHaveTextContent(`Chapitres · ${formatDate(chapitre.updatedAt)}`)
    expect(second).not.toHaveTextContent('liens')
    expect(second.querySelector('.backlink-snippet')).not.toBeInTheDocument()

    await user.click(first)
    expect(props.onOpen).toHaveBeenCalledWith(paris.path)
  })

  it('affiche l’état vide avec la note courante', () => {
    const { container } = renderPanel({ entries: [] })

    expect(
      screen.getByText('Aucune note ne pointe encore vers « Alice ».')
    ).toBeInTheDocument()
    expect(screen.getByText('[[Alice]]')).toBeInTheDocument()
    expect(container.querySelector('.backlinks-count')).not.toBeInTheDocument()
  })

  it('affiche un squelette pendant le premier chargement', () => {
    const { container } = renderPanel({ entries: [], loading: true })

    expect(screen.getByRole('complementary', { name: 'Liens entrants' })).toHaveAttribute(
      'aria-busy',
      'true'
    )
    expect(container.querySelector('.backlinks-skeleton')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Actualiser les liens entrants' })).toBeDisabled()
    expect(screen.queryByText(/Aucune note ne pointe/)).not.toBeInTheDocument()
  })
})

describe('BacklinksPanel — actions et erreurs', () => {
  it('actualise, ferme et réagit à Échap', async () => {
    const user = userEvent.setup()
    const props = renderPanel()

    await user.click(screen.getByRole('button', { name: 'Actualiser les liens entrants' }))
    expect(props.onRefresh).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Fermer les liens entrants' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledTimes(2)
  })

  it('affiche l’erreur et permet de réessayer', async () => {
    const user = userEvent.setup()
    const props = renderPanel({ entries: [], error: 'Lecture impossible.' })

    expect(screen.getByText('Lecture impossible.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(props.onRefresh).toHaveBeenCalledTimes(1)
  })
})
