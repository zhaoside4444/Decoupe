// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NarrativeTimeline } from '../src/renderer/src/components/NarrativeTimeline'
import type { TimelineData } from '../src/shared/timeline'

function buildData(): TimelineData {
  return {
    characters: [
      { path: 'Notes/Personnages/Alice.md', base: 'Alice', title: 'Alice', space: 'Personnages' },
      { path: 'Notes/Personnages/Bob.md', base: 'Bob', title: 'Bob', space: 'Personnages' }
    ],
    chapters: [
      {
        path: 'Notes/Chapitres/Chapitre 1.md',
        base: 'Chapitre 1',
        title: 'Chapitre 1',
        order: 1,
        label: '1',
        snippet: 'Début.'
      },
      {
        path: 'Notes/Chapitres/Chapitre 2.md',
        base: 'Chapitre 2',
        title: 'Chapitre 2',
        order: 2,
        label: '2',
        snippet: 'Suite.'
      }
    ],
    appearances: new Map([
      ['alice', new Set([0, 1])],
      ['bob', new Set([1])]
    ]),
    relations: new Map([
      ['alice', new Map<number, Array<'link' | 'tag' | 'mention'>>([[0, ['link']], [1, ['tag']]])],
      ['bob', new Map<number, Array<'link' | 'tag' | 'mention'>>([[1, ['mention']]])]
    ])
  }
}

function renderTimeline(data = buildData()) {
  const onOpenNote = vi.fn()
  const onClose = vi.fn()
  const view = render(<NarrativeTimeline data={data} onOpenNote={onOpenNote} onClose={onClose} />)
  return { ...view, onOpenNote, onClose }
}

function timelineSvg(): HTMLElement {
  return screen.getByRole('img', { name: 'Timeline des apparitions de personnages par chapitre' })
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('NarrativeTimeline — états', () => {
  it('affiche les consignes quand il n’y a aucune donnée', () => {
    renderTimeline({
      characters: [],
      chapters: [],
      appearances: new Map(),
      relations: new Map()
    })

    expect(screen.getByText(/Aucune donnée/)).toBeInTheDocument()
    expect(screen.getByText(/Taggez les notes de personnages/)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('affiche le nombre de personnages et de chapitres visibles', () => {
    renderTimeline()
    expect(screen.getByText(/2 personnages · 2 chapitres/)).toBeInTheDocument()
  })

  it('affiche la légende avec le nombre d’apparitions', () => {
    renderTimeline()

    expect(screen.getByRole('button', { name: /Alice/ })).toHaveTextContent('2')
    expect(screen.getByRole('button', { name: /Bob/ })).toHaveTextContent('1')
    expect(screen.getByRole('group', { name: 'Légende des personnages' })).toBeInTheDocument()
  })
})

describe('NarrativeTimeline — filtres', () => {
  it('filtre les lignes par nom et les restaure', async () => {
    const user = userEvent.setup()
    renderTimeline()
    const svg = timelineSvg()

    const filter = screen.getByRole('textbox', {
      name: 'Filtrer les personnages et les chapitres'
    })
    await user.type(filter, 'Alice')

    expect(within(svg).getByText('Alice')).toBeInTheDocument()
    expect(within(svg).queryByText('Bob')).not.toBeInTheDocument()
    expect(screen.getByText(/1 personnage · 2 chapitres/)).toBeInTheDocument()
  })

  it('affiche un état vide et réinitialise les filtres', async () => {
    const user = userEvent.setup()
    renderTimeline()

    await user.type(
      screen.getByRole('textbox', { name: 'Filtrer les personnages et les chapitres' }),
      'zzz'
    )

    expect(screen.getByText(/Aucun personnage ni chapitre ne correspond à « zzz »/)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Réinitialiser les filtres' }))
    expect(timelineSvg()).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Filtrer les personnages et les chapitres' })).toHaveValue('')
  })

  it('isole une ligne depuis la légende puis tout réaffiche', async () => {
    const user = userEvent.setup()
    renderTimeline()

    const chip = screen.getByRole('button', { name: /Alice/ })
    await user.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(within(timelineSvg()).queryByText('Bob')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tout afficher' }))
    expect(within(timelineSvg()).getByText('Bob')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tout afficher' })).not.toBeInTheDocument()
  })
})

describe('NarrativeTimeline — interactions', () => {
  it('bascule le mode compact et le mémorise', async () => {
    const user = userEvent.setup()
    renderTimeline()

    const compact = screen.getByRole('button', { name: 'Mode compact' })
    expect(compact).toHaveAttribute('aria-pressed', 'false')

    await user.click(compact)
    expect(compact).toHaveAttribute('aria-pressed', 'true')
    expect(window.localStorage.getItem('decoupe.timeline.compact')).toBe('1')
  })

  it('restaure le mode compact depuis le stockage', () => {
    window.localStorage.setItem('decoupe.timeline.compact', '1')
    renderTimeline()

    expect(screen.getByRole('button', { name: 'Mode compact' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('navigue au clavier et ouvre le chapitre sélectionné', async () => {
    const user = userEvent.setup()
    const { onOpenNote } = renderTimeline()
    const svg = timelineSvg()

    await waitFor(() => expect(svg).toHaveFocus())
    // jsdom ne déclenche pas onFocus sur un SVG via .focus() : on simule l'événement
    // pour placer la sélection sur la première ligne, comme le fait le navigateur.
    fireEvent.focus(svg)
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    expect(onOpenNote).toHaveBeenCalledWith('Notes/Chapitres/Chapitre 2.md')
  })

  it('ferme la timeline avec Échap', async () => {
    const user = userEvent.setup()
    const { onClose } = renderTimeline()

    await waitFor(() => expect(timelineSvg()).toHaveFocus())
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
