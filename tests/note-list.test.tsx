// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, createEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NoteList } from '../src/renderer/src/components/NoteList'
import type { NoteSummary, Space } from '../src/shared/types'

const alice: NoteSummary = {
  path: 'Notes/Personnages/Alice.md',
  title: 'Alice',
  base: 'Alice',
  space: 'Personnages',
  createdAt: '2026-10-01',
  updatedAt: Date.UTC(2026, 9, 30, 10, 0),
  excerpt: 'Héroïne du roman.',
  tags: ['personnage', 'roman']
}

const bob: NoteSummary = {
  path: 'Notes/Personnages/Bob.md',
  title: 'Bob',
  base: 'Bob',
  space: 'Personnages',
  createdAt: '2026-10-02',
  updatedAt: Date.UTC(2026, 9, 29, 10, 0),
  excerpt: 'Allié fidèle.',
  tags: ['personnage'],
  pinned: true
}

const chapitre: NoteSummary = {
  path: 'Notes/Chapitres/Chapitre 1.md',
  title: 'Chapitre 1',
  base: 'Chapitre 1',
  space: 'Chapitres',
  createdAt: '2026-10-03',
  updatedAt: Date.UTC(2026, 9, 28, 10, 0),
  excerpt: 'Le début.',
  tags: []
}

const notes = [alice, bob, chapitre]

const spaces: Space[] = [
  { name: 'Personnages', count: 2 },
  { name: 'Chapitres', count: 1 }
]

type Props = Parameters<typeof NoteList>[0]

function renderList(overrides: Partial<Props> = {}) {
  const props: Props = {
    title: 'Personnages',
    count: 3,
    notes,
    selectedPath: alice.path,
    search: '',
    sortMode: 'modified',
    spaces,
    onSelect: vi.fn(),
    onSortChange: vi.fn(),
    onReorder: vi.fn(),
    onMoveNote: vi.fn(),
    onTogglePin: vi.fn(),
    onBatchMove: vi.fn(async () => true),
    onBatchTag: vi.fn(async () => true),
    onBatchTrash: vi.fn(async () => true),
    onNew: vi.fn(),
    onMerge: vi.fn(),
    onClearSearch: vi.fn(),
    onRemoveFilter: vi.fn(),
    onTagClick: vi.fn(),
    onCollapse: vi.fn(),
    ...overrides
  }
  render(<NoteList {...props} />)
  return props
}

function card(title: string): HTMLElement {
  const heading = screen.getByRole('heading', { name: new RegExp(title) })
  const article = heading.closest('article')
  if (!article) throw new Error(`Carte ${title} introuvable`)
  return article
}

function selectWithCtrl(element: HTMLElement): void {
  fireEvent.click(element, { ctrlKey: true })
}

function fakeDataTransfer() {
  const data = new Map<string, string>()
  return {
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? '',
    get types() {
      return Array.from(data.keys())
    },
    effectAllowed: '',
    dropEffect: ''
  }
}

type DragKind = 'dragOver' | 'drop'
type DragInit = { altKey?: boolean; clientY?: number }

/** jsdom ne fournit pas DragEvent : on ajoute les propriétés utiles à la main. */
function fireDrag(
  element: HTMLElement,
  kind: DragKind,
  dataTransfer: ReturnType<typeof fakeDataTransfer>,
  init: DragInit = {}
): void {
  const event =
    kind === 'dragOver'
      ? createEvent.dragOver(element, { dataTransfer })
      : createEvent.drop(element, { dataTransfer })
  Object.defineProperty(event, 'altKey', { value: !!init.altKey })
  Object.defineProperty(event, 'clientY', { value: init.clientY ?? 0 })
  fireEvent(element, event)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('NoteList — en-tête et cartes', () => {
  it('affiche le titre, le compteur et le tri courant', async () => {
    const user = userEvent.setup()
    const props = renderList()

    expect(screen.getByRole('heading', { level: 2, name: 'Personnages' })).toBeInTheDocument()
    expect(screen.getByText('3 notes')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Trier les notes' })).toHaveValue('modified')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Trier les notes' }), 'title')
    expect(props.onSortChange).toHaveBeenCalledWith('title')

    await user.click(screen.getByRole('button', { name: /Nouvelle note/ }))
    expect(props.onNew).toHaveBeenCalledTimes(1)
  })

  it('sélectionne une note au clic et marque la note courante', async () => {
    const user = userEvent.setup()
    const props = renderList()

    expect(card('Alice')).toHaveClass('is-selected')
    await user.click(card('Bob'))

    expect(props.onSelect).toHaveBeenCalledWith(bob.path)
  })

  it('épingle sans ouvrir la note', async () => {
    const user = userEvent.setup()
    const props = renderList()

    await user.click(screen.getByRole('button', { name: 'Épingler Alice' }))
    expect(props.onTogglePin).toHaveBeenCalledWith(alice.path)
    expect(props.onSelect).not.toHaveBeenCalled()

    expect(card('Bob')).toHaveClass('is-pinned')
    expect(screen.getByRole('button', { name: 'Désépingler Bob' })).toBeInTheDocument()
  })

  it('filtre sur un tag sans ouvrir la note', async () => {
    const user = userEvent.setup()
    const props = renderList()

    await user.click(screen.getByRole('button', { name: '#roman' }))
    expect(props.onTagClick).toHaveBeenCalledWith('roman')
    expect(props.onSelect).not.toHaveBeenCalled()
  })

  it('affiche les états vides selon la recherche', () => {
    renderList({ notes: [], count: 0, selectedPath: null })
    expect(screen.getByText(/Rien par ici pour l’instant/)).toBeInTheDocument()
  })

  it('affiche l’état vide de recherche', () => {
    renderList({ notes: [], count: 0, selectedPath: null, search: 'introuvable' })
    expect(screen.getByText('Aucune note ne correspond.')).toBeInTheDocument()
  })
})

describe('NoteList — recherche', () => {
  it('affiche les filtres, les correspondances et surligne les termes', async () => {
    const user = userEvent.setup()
    const props = renderList({
      search: '#roman date:2026-10-01 Alice',
      notes: [
        {
          ...alice,
          match: { field: 'title', occurrences: 2, snippet: 'Alice ouvre la porte.' }
        }
      ],
      count: 1
    })

    expect(screen.getByText('1 résultat · 2 correspondances')).toBeInTheDocument()
    expect(document.querySelectorAll('mark.search-hit').length).toBeGreaterThan(0)
    expect(screen.getByText('« Alice »')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Supprimer le filtre #roman' }))
    expect(props.onRemoveFilter).toHaveBeenCalledWith('tag', 'roman')

    await user.click(
      screen.getByRole('button', { name: /Supprimer le filtre Créée le/ })
    )
    expect(props.onRemoveFilter).toHaveBeenCalledWith('date', undefined)

    await user.click(screen.getByRole('button', { name: 'Supprimer le filtre « Alice »' }))
    expect(props.onRemoveFilter).toHaveBeenCalledWith('text', 'Alice')

    await user.click(screen.getByRole('button', { name: 'Tout afficher' }))
    expect(props.onClearSearch).toHaveBeenCalledTimes(1)
  })
})

describe('NoteList — sélection multiple', () => {
  it('sélectionne avec Ctrl et déplace la sélection', async () => {
    const user = userEvent.setup()
    const props = renderList()

    selectWithCtrl(card('Alice'))
    selectWithCtrl(card('Bob'))

    const toolbar = screen.getByRole('toolbar', { name: 'Actions sur la sélection' })
    expect(toolbar).toHaveTextContent('2 sélectionnées')
    expect(props.onSelect).not.toHaveBeenCalled()

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Déplacer vers le dossier' }),
      'Chapitres'
    )

    await waitFor(() =>
      expect(props.onBatchMove).toHaveBeenCalledWith([alice.path, bob.path], 'Chapitres')
    )
    await waitFor(() =>
      expect(screen.queryByRole('toolbar', { name: 'Actions sur la sélection' })).not.toBeInTheDocument()
    )
  })

  it('sélectionne une plage avec Maj et laisse terminer', async () => {
    const user = userEvent.setup()
    const props = renderList()

    await user.click(card('Alice'))
    fireEvent.click(card('Chapitre 1'), { shiftKey: true })

    expect(
      screen.getByRole('toolbar', { name: 'Actions sur la sélection' })
    ).toHaveTextContent('3 sélectionnées')
    expect(props.onSelect).toHaveBeenCalledWith(alice.path)

    await user.click(screen.getByRole('button', { name: 'Terminer' }))
    expect(
      screen.queryByRole('toolbar', { name: 'Actions sur la sélection' })
    ).not.toBeInTheDocument()
  })

  it('coche une note avec la case dédiée', async () => {
    const user = userEvent.setup()
    renderList()

    const checkbox = screen.getByRole('checkbox', { name: 'Sélectionner Alice' })
    expect(checkbox).toHaveAttribute('aria-checked', 'false')

    await user.click(checkbox)
    expect(checkbox).toHaveAttribute('aria-checked', 'true')
    expect(
      screen.getByRole('toolbar', { name: 'Actions sur la sélection' })
    ).toHaveTextContent('1 sélectionnée')
  })

  it('ajoute des tags à la sélection avec Entrée', async () => {
    const user = userEvent.setup()
    const props = renderList()

    selectWithCtrl(card('Alice'))
    await user.type(screen.getByRole('textbox', { name: 'Tags à ajouter' }), 'perso, lieu')
    await user.keyboard('{Enter}')

    await waitFor(() =>
      expect(props.onBatchTag).toHaveBeenCalledWith([alice.path], 'perso, lieu')
    )
  })

  it('met la sélection à la corbeille après confirmation', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const props = renderList()

    selectWithCtrl(card('Alice'))
    selectWithCtrl(card('Bob'))
    await user.click(screen.getByRole('button', { name: 'Corbeille' }))

    expect(confirm).toHaveBeenCalledWith('Mettre 2 notes à la corbeille ?')
    await waitFor(() =>
      expect(props.onBatchTrash).toHaveBeenCalledWith([alice.path, bob.path])
    )
  })

  it('annule la mise à la corbeille quand la confirmation est refusée', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const props = renderList()

    selectWithCtrl(card('Alice'))
    await user.click(screen.getByRole('button', { name: 'Corbeille' }))

    expect(props.onBatchTrash).not.toHaveBeenCalled()
    expect(
      screen.getByRole('toolbar', { name: 'Actions sur la sélection' })
    ).toBeInTheDocument()
  })
})

describe('NoteList — glisser-déposer et navigation', () => {
  it('fusionne une note avec Alt + glisser', () => {
    const props = renderList()
    const dataTransfer = fakeDataTransfer()

    fireEvent.dragStart(card('Alice'), { dataTransfer })
    fireDrag(card('Bob'), 'dragOver', dataTransfer, { altKey: true })
    fireDrag(card('Bob'), 'drop', dataTransfer, { altKey: true })

    expect(props.onMerge).toHaveBeenCalledWith(alice.path, bob.path)
  })

  it('ne fusionne pas avec un glisser simple hors ordre manuel', () => {
    const props = renderList({ notes: [alice, chapitre] })
    const dataTransfer = fakeDataTransfer()

    fireEvent.dragStart(card('Alice'), { dataTransfer })
    fireDrag(card('Chapitre 1'), 'dragOver', dataTransfer)
    fireDrag(card('Chapitre 1'), 'drop', dataTransfer)

    expect(props.onMerge).not.toHaveBeenCalled()
    expect(props.onReorder).not.toHaveBeenCalled()
  })

  it('réordonne les cartes en ordre manuel', () => {
    const props = renderList({ notes: [alice, chapitre], sortMode: 'manual' })
    const dataTransfer = fakeDataTransfer()

    fireEvent.dragStart(card('Alice'), { dataTransfer })
    fireDrag(card('Chapitre 1'), 'dragOver', dataTransfer, { clientY: 20 })
    fireDrag(card('Chapitre 1'), 'drop', dataTransfer, { clientY: 20 })

    expect(props.onReorder).toHaveBeenCalledWith([chapitre.path, alice.path])
    expect(props.onMerge).not.toHaveBeenCalled()
  })

  it('désactive le réordonnancement pendant une recherche', () => {
    const props = renderList({
      notes: [alice, chapitre],
      sortMode: 'manual',
      search: 'Alice'
    })
    const dataTransfer = fakeDataTransfer()

    fireEvent.dragStart(card('Alice'), { dataTransfer })
    fireDrag(card('Chapitre 1'), 'dragOver', dataTransfer, { clientY: 20 })
    fireDrag(card('Chapitre 1'), 'drop', dataTransfer, { clientY: 20 })

    expect(props.onReorder).not.toHaveBeenCalled()
  })

  it('empêche de sortir une note de son groupe épinglé par glisser', () => {
    const props = renderList({
      notes: [bob, alice, chapitre],
      sortMode: 'manual'
    })
    const dataTransfer = fakeDataTransfer()

    fireEvent.dragStart(card('Bob'), { dataTransfer })
    fireDrag(card('Alice'), 'dragOver', dataTransfer, { clientY: 20 })
    fireDrag(card('Alice'), 'drop', dataTransfer, { clientY: 20 })

    expect(props.onReorder).not.toHaveBeenCalled()
  })

  it('désactive Monter quand la cible change de groupe', () => {
    renderList({ notes: [bob, alice], sortMode: 'manual' })

    fireEvent.contextMenu(card('Alice'), { clientX: 12, clientY: 24 })

    expect(screen.getByRole('menuitem', { name: 'Monter' })).toBeDisabled()
  })

  it('propose Monter et Descendre dans le menu contextuel', async () => {
    const user = userEvent.setup()
    const props = renderList({ notes: [alice, chapitre], sortMode: 'manual' })

    fireEvent.contextMenu(card('Chapitre 1'), { clientX: 12, clientY: 24 })
    await user.click(screen.getByRole('menuitem', { name: 'Monter' }))

    expect(props.onMoveNote).toHaveBeenCalledWith(chapitre.path, -1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('désactive « Ordre manuel » dans la vue Tous les espaces', () => {
    renderList({ manualSortDisabled: true })
    expect(screen.getByRole('option', { name: 'Ordre manuel' })).toBeDisabled()
  })

  it('met en évidence la carte atteinte au clavier', () => {
    renderList({ keyNavIndex: 1 })
    expect(card('Bob')).toHaveClass('is-keynav')
  })

  it('masque la liste depuis une poignée sur le bord', () => {
    const props = renderList()

    fireEvent.click(screen.getByRole('button', { name: 'Masquer la liste des notes' }))
    expect(props.onCollapse).toHaveBeenCalledTimes(1)
  })
})

describe('NoteList — comparaison', () => {
  it('compare une note avec Alt + clic sans l’ouvrir', () => {
    const props = renderList({ onCompare: vi.fn() })

    fireEvent.click(card('Bob'), { altKey: true })

    expect(props.onCompare).toHaveBeenCalledWith(bob.path)
    expect(props.onSelect).not.toHaveBeenCalled()
  })

  it('signale la note affichée en comparaison', () => {
    renderList({ comparePath: bob.path, onCompare: vi.fn() })

    expect(card('Bob')).toHaveClass('is-compared')
    expect(screen.getByText('Comparée')).toBeInTheDocument()
  })
})
