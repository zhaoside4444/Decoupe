// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RelatedNotes } from '../src/renderer/src/components/RelatedNotes'
import { formatDate } from '../src/renderer/src/util'
import type { RelatedNote } from '../src/shared/related'

const bob: RelatedNote = {
  path: 'Notes/Personnages/Bob.md',
  title: 'Bob',
  base: 'Bob',
  space: 'Personnages',
  updatedAt: Date.UTC(2020, 0, 2, 10, 0),
  excerpt: 'Allié fidèle.',
  score: 12,
  sharedTags: ['personnage', 'roman'],
  sharedLinks: [],
  isDirectLink: false
}

const paris: RelatedNote = {
  path: 'Notes/Lieux/Paris.md',
  title: 'Paris',
  base: 'Paris',
  space: '',
  updatedAt: Date.UTC(2020, 0, 3, 10, 0),
  excerpt: '',
  score: 4,
  sharedTags: [],
  sharedLinks: [],
  isDirectLink: true
}

type Props = Parameters<typeof RelatedNotes>[0]

function renderRelated(overrides: Partial<Props> = {}) {
  const props: Props = {
    related: [bob, paris],
    onOpenNote: vi.fn(),
    onTagFilter: vi.fn(),
    ...overrides
  }
  const view = render(<RelatedNotes {...props} />)
  return { ...props, container: view.container }
}

function card(title: string): HTMLElement {
  const element = screen.getByText(title).closest('.related-note-card')
  if (!element) throw new Error(`Carte ${title} introuvable`)
  return element as HTMLElement
}

describe('RelatedNotes — contenu', () => {
  it('affiche les notes liées, leur raison et leurs métadonnées', () => {
    renderRelated()

    const section = screen.getByRole('region', { name: 'Notes liées' })
    expect(within(section).getByText('2')).toBeInTheDocument()
    expect(within(section).getByText('Bob')).toBeInTheDocument()
    expect(within(section).getByText('Allié fidèle.')).toBeInTheDocument()
    expect(within(section).getByText('Personnages')).toBeInTheDocument()
    expect(within(section).getByText(formatDate(bob.updatedAt))).toBeInTheDocument()
    expect(
      within(section).getByText('2 tags en commun (#personnage, #roman)')
    ).toBeInTheDocument()

    expect(within(section).getByText('Paris')).toBeInTheDocument()
    expect(within(section).getByText('Boîte d’entrée')).toBeInTheDocument()
    expect(within(section).getByText('Lien direct')).toBeInTheDocument()
    expect(within(card('Paris')).queryByText(/^#/)).not.toBeInTheDocument()
    expect(card('Paris').querySelector('.related-card-excerpt')).toBeNull()
  })

  it('ne rend rien sans note liée', () => {
    const { container } = renderRelated({ related: [] })
    expect(container).toBeEmptyDOMElement()
  })
})

describe('RelatedNotes — interactions', () => {
  it('ouvre une note au clic', async () => {
    const user = userEvent.setup()
    const props = renderRelated()

    await user.click(screen.getByText('Bob'))
    expect(props.onOpenNote).toHaveBeenCalledWith(bob.path)
  })

  it('filtre par tag sans ouvrir la note', async () => {
    const user = userEvent.setup()
    const props = renderRelated()

    const chip = screen.getByRole('button', { name: '#roman' })
    await user.click(chip)

    expect(props.onTagFilter).toHaveBeenCalledWith('roman')
    expect(props.onOpenNote).not.toHaveBeenCalled()
  })

  it('masque les tags sans gestionnaire de filtre', () => {
    renderRelated({ onTagFilter: undefined })
    expect(screen.queryByRole('button', { name: '#roman' })).not.toBeInTheDocument()
  })

  it('replie et déplie la liste', async () => {
    const user = userEvent.setup()
    renderRelated()

    const section = screen.getByRole('region', { name: 'Notes liées' })
    const collapse = within(section).getByRole('button', { name: 'Replier les notes liées' })
    expect(collapse).toHaveAttribute('aria-expanded', 'true')

    await user.click(collapse)
    expect(
      within(section).getByRole('button', { name: 'Déplier les notes liées' })
    ).toHaveAttribute('aria-expanded', 'false')
    expect(within(section).queryByRole('list')).not.toBeInTheDocument()

    await user.click(within(section).getByRole('button', { name: 'Déplier les notes liées' }))
    expect(within(section).getByRole('list')).toBeInTheDocument()
  })
})
