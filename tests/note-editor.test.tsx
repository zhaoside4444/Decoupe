// @vitest-environment jsdom
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NoteEditor, type NoteEditorHandle } from '../src/renderer/src/components/NoteEditor'
import type { NoteSummary } from '../src/shared/types'

// Milkdown/ProseMirror a besoin d'un vrai moteur de rendu : on neutralise la création
// de l'éditeur pour tester l'interface autour (en-tête, tags, mentions, notes liées).
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

const initialContent = `---
tags: [personnage, roman]
---

Alice rencontre [[Bob]]. Brunehaut observe.`

const bob: NoteSummary = {
  path: 'Notes/Personnages/Bob.md',
  title: 'Bob',
  base: 'Bob',
  space: 'Personnages',
  createdAt: '2026-10-02',
  updatedAt: Date.UTC(2026, 9, 30, 9, 0),
  excerpt: 'Allié fidèle.',
  tags: ['personnage']
}

const brunehaut: NoteSummary = {
  path: 'Notes/Personnages/Brunehaut.md',
  title: 'Brunehaut',
  base: 'Brunehaut',
  space: 'Personnages',
  createdAt: '2026-10-03',
  updatedAt: Date.UTC(2026, 9, 29, 9, 0),
  excerpt: 'Observatrice.',
  tags: []
}

type Props = Parameters<typeof NoteEditor>[0]

function renderEditor(overrides: Partial<Props> = {}) {
  const props: Props = {
    path: 'Notes/Personnages/Alice.md',
    spaceName: 'Personnages',
    title: 'Alice',
    initialContent,
    onSave: vi.fn(async () => {}),
    onExtract: vi.fn(async () => null),
    onSplit: vi.fn(async () => null),
    onTrash: vi.fn(),
    onOpenLink: vi.fn(),
    onCreateLink: vi.fn(async () => null),
    onError: vi.fn(),
    notes: [bob, brunehaut],
    tagSuggestions: ['personnage', 'roman', 'nouveau'],
    onTagFilter: vi.fn(),
    externalChange: false,
    backlinksOpen: false,
    backlinkCount: 2,
    onToggleBacklinks: vi.fn(),
    onExportPdf: vi.fn(),
    onOpenTimeline: vi.fn(),
    showRelatedNotes: true,
    onOpenNote: vi.fn(),
    ...overrides
  }
  const ref = createRef<NoteEditorHandle>()
  const view = render(<NoteEditor ref={ref} {...props} />)
  return { ...props, ref, container: view.container }
}

describe('NoteEditor — en-tête', () => {
  it('affiche le fil d’Ariane, l’état et les actions', () => {
    renderEditor()

    expect(screen.getByTitle('Personnages / Alice')).toHaveTextContent('Personnages/Alice')
    expect(screen.getByText('Enregistré')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Liens entrants (2)' })
    ).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Mentions à lier (1)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exporter en PDF' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Timeline narrative' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mettre à la corbeille' })).toBeInTheDocument()
  })

  it('déclenche les actions de l’en-tête', async () => {
    const user = userEvent.setup()
    const props = renderEditor({ backlinksOpen: true })

    expect(
      screen.getByRole('button', { name: 'Liens entrants (2)' })
    ).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Liens entrants (2)' }))
    await user.click(screen.getByRole('button', { name: 'Exporter en PDF' }))
    await user.click(screen.getByRole('button', { name: 'Timeline narrative' }))
    await user.click(screen.getByRole('button', { name: 'Mettre à la corbeille' }))

    expect(props.onToggleBacklinks).toHaveBeenCalledTimes(1)
    expect(props.onExportPdf).toHaveBeenCalledTimes(1)
    expect(props.onOpenTimeline).toHaveBeenCalledTimes(1)
    expect(props.onTrash).toHaveBeenCalledTimes(1)
  })

  it('masque les actions optionnelles absentes', () => {
    renderEditor({ onOpenTimeline: undefined })

    expect(screen.getByRole('button', { name: 'Exporter en PDF' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Timeline narrative' })).not.toBeInTheDocument()
  })
})

describe('NoteEditor — tags', () => {
  it('affiche les tags du frontmatter et les filtre au clic', async () => {
    const user = userEvent.setup()
    const props = renderEditor()
    const tagBar = document.querySelector('.tag-bar') as HTMLElement

    expect(within(tagBar).getByRole('button', { name: '#personnage' })).toBeInTheDocument()
    await user.click(within(tagBar).getByRole('button', { name: '#personnage' }))
    expect(props.onTagFilter).toHaveBeenCalledWith('personnage')

    await user.click(screen.getByRole('button', { name: 'Retirer le tag roman' }))
    expect(within(tagBar).queryByRole('button', { name: '#roman' })).not.toBeInTheDocument()
  })

  it('ajoute un tag avec Entrée et propose les suggestions restantes', async () => {
    const user = userEvent.setup()
    const { container } = renderEditor()

    await user.click(screen.getByRole('button', { name: 'Tag' }))
    const input = screen.getByLabelText('Nouveau tag')

    const suggestions = Array.from(
      container.querySelectorAll<HTMLOptionElement>('#decoupe-tag-suggestions option')
    ).map((option) => option.value)
    expect(suggestions).toContain('nouveau')
    expect(suggestions).not.toContain('personnage')

    await user.type(input, 'nouveau')
    await user.keyboard('{Enter}')

    expect(screen.getByRole('button', { name: '#nouveau' })).toBeInTheDocument()
  })

  it('valide le tag à la perte du focus', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Tag' }))
    await user.type(screen.getByLabelText('Nouveau tag'), 'intrigue')
    await user.click(screen.getByText('Enregistré'))

    expect(screen.getByRole('button', { name: '#intrigue' })).toBeInTheDocument()
  })

  it('annule avec Échap et retire le dernier tag avec Retour arrière', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Tag' }))
    await user.type(screen.getByLabelText('Nouveau tag'), 'brouillon')
    await user.keyboard('{Escape}')

    expect(screen.queryByLabelText('Nouveau tag')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '#brouillon' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tag' }))
    await user.keyboard('{Backspace}')
    const tagBar = document.querySelector('.tag-bar') as HTMLElement
    expect(within(tagBar).queryByRole('button', { name: '#roman' })).not.toBeInTheDocument()
    expect(within(tagBar).getByRole('button', { name: '#personnage' })).toBeInTheDocument()
  })
})

describe('NoteEditor — mentions', () => {
  it('liste les titres cités sans lien et se ferme', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Mentions à lier (1)' }))
    const dialog = screen.getByRole('dialog', { name: 'Mentions à lier' })

    expect(within(dialog).getByText('Brunehaut')).toBeInTheDocument()
    expect(within(dialog).getByText('[[Brunehaut]]')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Convertir' })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Fermer les mentions' }))
    expect(screen.queryByRole('dialog', { name: 'Mentions à lier' })).not.toBeInTheDocument()
  })

  it('ferme les mentions avec Échap', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Mentions à lier (1)' }))
    expect(screen.getByRole('dialog', { name: 'Mentions à lier' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Mentions à lier' })).not.toBeInTheDocument()
    )
  })
})

describe('NoteEditor — notes liées', () => {
  it('affiche les notes liées, les ouvre et les replie', async () => {
    const user = userEvent.setup()
    const props = renderEditor()

    const section = screen.getByRole('region', { name: 'Notes liées' })
    expect(within(section).getByText('Bob')).toBeInTheDocument()
    expect(within(section).getByText('Allié fidèle.')).toBeInTheDocument()

    await user.click(within(section).getByText('Bob'))
    expect(props.onOpenNote).toHaveBeenCalledWith(bob.path)

    const collapse = within(section).getByRole('button', { name: 'Replier les notes liées' })
    await user.click(collapse)
    expect(collapse).toHaveAttribute('aria-expanded', 'false')
    expect(within(section).queryByRole('list')).not.toBeInTheDocument()

    await user.click(within(section).getByRole('button', { name: 'Déplier les notes liées' }))
    expect(within(section).getByRole('list')).toBeInTheDocument()
  })

  it('masque la section quand les suggestions sont désactivées', () => {
    renderEditor({ showRelatedNotes: false })
    expect(screen.queryByRole('region', { name: 'Notes liées' })).not.toBeInTheDocument()
  })
})

describe('NoteEditor — mise en forme et contenu', () => {
  it('expose la barre de mise en forme et le champ de lien', async () => {
    const user = userEvent.setup()
    renderEditor()

    expect(screen.getByRole('toolbar', { name: 'Mise en forme' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Style de texte' })).toHaveValue('0')

    await user.click(screen.getByRole('button', { name: 'Gras (Ctrl+B)' }))

    await user.click(screen.getByRole('button', { name: 'Lien' }))
    const input = screen.getByRole('textbox', { name: 'Adresse du lien' })
    expect(input).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('textbox', { name: 'Adresse du lien' })).not.toBeInTheDocument()
  })

  it('expose le contenu et l’état via la référence', async () => {
    const { ref, onSave } = renderEditor()

    expect(ref.current?.getContent()).toBe(initialContent)

    ref.current?.markSaved(initialContent)
    expect(screen.getByText('Enregistré')).toBeInTheDocument()

    await ref.current?.flush()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('ouvre le sélecteur de tableau et annonce la taille survolée', async () => {
    const user = userEvent.setup()
    renderEditor()

    const trigger = screen.getByRole('button', { name: 'Insérer un tableau' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const dialog = screen.getByRole('dialog', { name: 'Insérer un tableau' })
    expect(within(dialog).getAllByRole('button')).toHaveLength(36)
    expect(within(dialog).getByText('3 colonnes × 3 lignes')).toBeInTheDocument()

    await user.hover(
      within(dialog).getByRole('button', { name: 'Insérer un tableau de 4 colonnes et 2 lignes' })
    )
    expect(within(dialog).getByText('4 colonnes × 2 lignes')).toBeInTheDocument()

    fireEvent.focus(
      within(dialog).getByRole('button', { name: 'Insérer un tableau de 5 colonnes et 1 ligne' })
    )
    expect(within(dialog).getByText('5 colonnes × 1 ligne')).toBeInTheDocument()
  })

  it('insère la taille choisie puis referme le sélecteur', async () => {
    const user = userEvent.setup()
    renderEditor()

    const trigger = screen.getByRole('button', { name: 'Insérer un tableau' })
    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Insérer un tableau' })

    await user.click(
      within(dialog).getByRole('button', { name: 'Insérer un tableau de 2 colonnes et 4 lignes' })
    )

    expect(screen.queryByRole('dialog', { name: 'Insérer un tableau' })).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('ferme le sélecteur avec Échap et rend le focus au bouton', async () => {
    const user = userEvent.setup()
    renderEditor()

    const trigger = screen.getByRole('button', { name: 'Insérer un tableau' })
    await user.click(trigger)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Insérer un tableau' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('ferme le sélecteur au clic extérieur', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Insérer un tableau' }))
    expect(screen.getByRole('dialog', { name: 'Insérer un tableau' })).toBeInTheDocument()

    await user.click(screen.getByText('Enregistré'))
    expect(screen.queryByRole('dialog', { name: 'Insérer un tableau' })).not.toBeInTheDocument()
  })

  it('reste enregistré quand une modification externe est signalée', () => {
    renderEditor({ externalChange: true })
    expect(screen.getByText('Enregistré')).toBeInTheDocument()
    expect(screen.getByText(/Glisser une note sur une autre pour fusionner/)).toBeInTheDocument()
  })
})

describe('NoteEditor — recherche dans la note', () => {
  it('ouvre la barre de recherche depuis la mise en forme', async () => {
    const user = userEvent.setup()
    renderEditor()

    expect(screen.queryByRole('search')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Rechercher dans la note (Ctrl+F)' }))

    const bar = screen.getByRole('search', { name: 'Rechercher dans la note' })
    expect(bar).toBeInTheDocument()
    const input = within(bar).getByRole('textbox', { name: 'Rechercher dans la note' })
    await waitFor(() => expect(input).toHaveFocus())
  })

  it('s’ouvre avec Ctrl+F et se referme avec Échap', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.keyboard('{Control>}f{/Control}')

    const input = await screen.findByRole('textbox', { name: 'Rechercher dans la note' })
    await waitFor(() => expect(input).toHaveFocus())

    await user.type(input, 'Alice')
    expect(screen.getByText('Aucun résultat')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('search')).not.toBeInTheDocument()
  })

  it('propose les occurrences suivante et précédente et se ferme au bouton', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole('button', { name: 'Rechercher dans la note (Ctrl+F)' }))
    const bar = screen.getByRole('search', { name: 'Rechercher dans la note' })
    expect(within(bar).getByRole('button', { name: 'Occurrence suivante' })).toBeDisabled()
    expect(within(bar).getByRole('button', { name: 'Occurrence précédente' })).toBeDisabled()

    await user.click(within(bar).getByRole('button', { name: 'Fermer la recherche' }))
    expect(screen.queryByRole('search')).not.toBeInTheDocument()
  })
})
