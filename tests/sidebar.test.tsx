// @vitest-environment jsdom
import { createRef, type ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from '../src/renderer/src/components/Sidebar'

type SidebarProps = ComponentProps<typeof Sidebar>

const vault = { path: 'C:\\Notes\\Roman', name: 'Roman' }

function renderSidebar(overrides: Partial<SidebarProps> = {}) {
  const props: SidebarProps = {
    vault,
    spaces: [
      { name: 'Personnages', count: 2 },
      { name: 'Chapitres', count: 3 }
    ],
    notesInInbox: 1,
    totalNotes: 6,
    activeSpace: 'Personnages',
    onSelectSpace: vi.fn(),
    onCreateSpace: vi.fn(async () => {}),
    onRenameSpace: vi.fn(async () => {}),
    onTrashSpace: vi.fn(async () => {}),
    onMoveNote: vi.fn(),
    onSwitchVault: vi.fn(),
    onReveal: vi.fn(),
    search: '',
    onSearch: vi.fn(),
    searchRef: createRef<HTMLInputElement>(),
    trashCount: 2,
    onOpenTrash: vi.fn(),
    onOpenBackups: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenTimeline: vi.fn(),
    tagStats: [
      { name: 'personnage', count: 2 },
      { name: 'chapitre', count: 3 }
    ],
    dateCounts: new Map<string, number>(),
    onTagFilter: vi.fn(),
    onDateFilter: vi.fn(),
    onRenameTag: vi.fn(async () => {}),
    onDeleteTag: vi.fn(async () => {}),
    ...overrides
  }
  render(<Sidebar {...props} />)
  return props
}

function spaceRow(name: string): HTMLElement {
  const row = screen.getByText(name).closest<HTMLElement>('[role="button"]')
  if (!row) throw new Error(`Ligne introuvable pour ${name}`)
  return row
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('Sidebar — espaces et tags', () => {
  it('rend les espaces et les tags avec la même structure de ligne', () => {
    renderSidebar()

    const space = spaceRow('Personnages')
    const tag = spaceRow('personnage')

    for (const row of [space, tag]) {
      expect(row).toHaveClass('nav-item', 'space-row')
      expect(row).toHaveAttribute('tabindex', '0')
      expect(row).toHaveAttribute('role', 'button')
    }
    expect(tag).toHaveClass('tag-row')
    expect(space).toHaveAttribute('aria-current', 'true')
    expect(spaceRow('Chapitres')).not.toHaveAttribute('aria-current')
  })

  it('affiche les compteurs des espaces, des tags et de la corbeille', () => {
    renderSidebar()

    expect(spaceRow('Personnages')).toHaveTextContent('2')
    expect(spaceRow('chapitre')).toHaveTextContent('3')
    expect(screen.getByText('Corbeille').closest('.nav-item')).toHaveTextContent('2')
  })

  it('sélectionne un espace au clic et au clavier', async () => {
    const user = userEvent.setup()
    const props = renderSidebar()

    await user.click(spaceRow('Chapitres'))
    expect(props.onSelectSpace).toHaveBeenLastCalledWith('Chapitres')

    spaceRow('Chapitres').focus()
    await user.keyboard('{Enter}')
    expect(props.onSelectSpace).toHaveBeenLastCalledWith('Chapitres')

    await user.keyboard(' ')
    expect(props.onSelectSpace).toHaveBeenLastCalledWith('Chapitres')
    expect(props.onSelectSpace).toHaveBeenCalledTimes(3)
  })

  it('filtre sur un tag au clic et au clavier', async () => {
    const user = userEvent.setup()
    const props = renderSidebar()

    await user.click(spaceRow('personnage'))
    expect(props.onTagFilter).toHaveBeenLastCalledWith('personnage')

    spaceRow('personnage').focus()
    await user.keyboard('{Enter}')
    expect(props.onTagFilter).toHaveBeenCalledTimes(2)
  })

  it("n'active pas la ligne quand on presse Entrée sur le crayon", async () => {
    const user = userEvent.setup()
    const props = renderSidebar()

    const rename = screen.getByRole('button', { name: 'Renommer Personnages' })
    rename.focus()
    await user.keyboard('{Enter}')

    expect(props.onSelectSpace).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('Personnages')).toHaveFocus()
  })

  it("n'active pas la ligne quand on presse Entrée sur la poubelle d'un tag", async () => {
    const user = userEvent.setup()
    const props = renderSidebar()

    const remove = screen.getByRole('button', { name: 'Supprimer personnage' })
    remove.focus()
    await user.keyboard('{Enter}')

    expect(props.onTagFilter).not.toHaveBeenCalled()
    expect(props.onDeleteTag).toHaveBeenCalledWith('personnage')
  })
})

describe('Sidebar — menu des dossiers', () => {
  it('liste les dossiers récents, marque le dossier courant et ouvre le bon chemin', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(
      'recentVaults',
      JSON.stringify([vault.path, 'C:\\Notes\\Autre'])
    )
    const props = renderSidebar()

    await user.click(screen.getByRole('button', { name: 'Changer de dossier' }))
    const menu = screen.getByRole('menu', { name: 'Choisir un dossier de notes' })

    expect(within(menu).getByText('Roman')).toBeInTheDocument()
    expect(within(menu).getByText('actuel')).toBeInTheDocument()
    expect(within(menu).getByTitle('C:\\Notes\\Autre')).toBeInTheDocument()

    await user.click(within(menu).getByTitle('C:\\Notes\\Autre'))
    expect(props.onSwitchVault).toHaveBeenCalledWith('C:\\Notes\\Autre')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('propose le sélecteur système quand aucun dossier récent ne convient', async () => {
    const user = userEvent.setup()
    const props = renderSidebar()

    await user.click(screen.getByRole('button', { name: 'Changer de dossier' }))
    expect(screen.getByText('Aucun dossier récent.')).toBeInTheDocument()

    await user.click(screen.getByRole('menuitem', { name: /Choisir un autre dossier/ }))
    expect(props.onSwitchVault).toHaveBeenCalledTimes(1)
    expect(props.onSwitchVault).toHaveBeenCalledWith()
  })

  it('ferme le menu avec Échap et rend le focus au bouton', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem('recentVaults', JSON.stringify([vault.path]))
    renderSidebar()

    const trigger = screen.getByRole('button', { name: 'Changer de dossier' })
    await user.click(trigger)
    await waitFor(() =>
      expect(screen.getByRole('menuitem', { name: /Roman/ })).toHaveFocus()
    )

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})

describe('Sidebar — aide', () => {
  it('affiche l’aide embarquée mise en forme', async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(screen.getByRole('button', { name: 'Aide' }))
    const dialog = screen.getByRole('dialog', { name: 'Aide Découpe' })

    expect(within(dialog).getByRole('heading', { level: 2, name: 'Aide — Découpe' })).toBeInTheDocument()
    expect(
      within(dialog).getByRole('heading', { level: 2, name: 'Changer de dossier (vault switcher)' })
    ).toBeInTheDocument()
    expect(within(dialog).getByText('recentVaults')).toHaveClass('help-code')
    expect(within(dialog).getByText(/Barre latérale au clavier/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
