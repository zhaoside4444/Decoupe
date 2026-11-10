// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NoteComparePane } from '../src/renderer/src/components/NoteComparePane'

// Même neutralisation que pour NoteEditor : pas de vrai moteur ProseMirror en jsdom.
vi.mock('@milkdown/kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@milkdown/kit/core')>()
  type Builder = {
    config: (callback: unknown) => Builder
    use: (plugin: unknown) => Builder
    create: () => Promise<never>
  }
  const builder: Builder = {
    config: () => builder,
    use: () => builder,
    create: () => new Promise<never>(() => {})
  }
  return { ...actual, Editor: { make: () => builder } }
})

function renderPane(overrides: Partial<Parameters<typeof NoteComparePane>[0]> = {}) {
  const props = {
    title: 'Bob',
    space: 'Personnages',
    content: '---\ntags: [personnage]\n---\n\nBob rencontre [[Alice]].',
    loading: false,
    error: null,
    ratio: 0.46,
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onLink: vi.fn(),
    ...overrides
  }
  const view = render(<NoteComparePane {...props} />)
  return { ...props, container: view.container }
}

describe('NoteComparePane', () => {
  it('affiche le fil d’Ariane, la mention lecture seule et les actions', () => {
    renderPane()

    expect(screen.getByRole('complementary', { name: 'Comparaison avec Bob' })).toBeInTheDocument()
    expect(screen.getByText('Personnages')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Lecture seule')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ouvrir Bob dans l’éditeur' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fermer la comparaison' })).toBeInTheDocument()
  })

  it('appelle les actions Ouvrir et Fermer', async () => {
    const user = userEvent.setup()
    const props = renderPane()

    await user.click(screen.getByRole('button', { name: 'Ouvrir Bob dans l’éditeur' }))
    expect(props.onOpen).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Fermer la comparaison' }))
    expect(props.onClose).toHaveBeenCalled()
  })

  it('affiche le chargement puis l’erreur', () => {
    const { container } = renderPane({ loading: true })
    expect(screen.getByText('Chargement de la note…')).toBeInTheDocument()

    container.remove()
    renderPane({ error: 'Fichier introuvable' })
    expect(screen.getByText('Fichier introuvable')).toBeInTheDocument()
  })

  it('ouvre un wiki-lien cliqué dans le panneau comparé', () => {
    const props = renderPane()
    const root = props.container.querySelector('.compare-root')
    if (!root) throw new Error('Racine de comparaison introuvable')

    const link = document.createElement('span')
    link.className = 'wiki-link'
    link.dataset.target = 'Alice'
    root.appendChild(link)

    fireEvent.click(link)
    expect(props.onLink).toHaveBeenCalledWith('Alice')
  })
})
