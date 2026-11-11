import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { FileText, Folder, Hash, Zap } from 'lucide-react'
import type { NoteSummary, Space, TagSummary } from '@shared/types'
import { foldName, spaceOfPath } from '@shared/text'
import { moveListIndex, paletteMatches } from '@shared/nav'
import type { NoteSortMode } from '@shared/sort'
import { restoreFocusIfLost } from '../util'

interface CommandPaletteProps {
  notes: NoteSummary[]
  spaces: Space[]
  tagStats: TagSummary[]
  selectedPath: string | null
  selectedPinned: boolean | undefined
  showRelatedNotes?: boolean
  onClose: () => void
  onNewNote: () => void
  onOpenNote: (path: string) => void
  onSelectSpace: (space: string) => void
  onTagFilter: (tag: string) => void
  onTogglePinCurrent: () => void
  onTrashCurrent: () => void
  onMoveCurrent: (space: string) => void
  onOpenTrash: () => void
  onOpenBackups: () => void
  onOpenSettings: () => void
  onOpenTimeline?: () => void
  onExportPdf?: () => void
  onSortChange: (mode: NoteSortMode) => void
  manualSortAvailable?: boolean
  onToggleRelatedNotes?: () => void
  comparePath?: string | null
  onCompareWith?: () => void
  onCloseCompare?: () => void
}

interface PaletteEntry {
  id: string
  kind: 'action' | 'note' | 'space' | 'tag'
  group: string
  label: string
  hint?: string
  detail?: string
  search?: string
  run: () => void
}

const KIND_ICON = {
  action: Zap,
  note: FileText,
  space: Folder,
  tag: Hash
} as const

function makeNoteEntry(note: NoteSummary, run: () => void, recent = false): PaletteEntry {
  return {
    id: `note-${note.path}`,
    kind: 'note',
    group: recent ? 'Notes récentes' : 'Notes',
    label: note.title,
    detail: note.space,
    hint: note.pinned ? 'épinglée' : undefined,
    search: foldName(`${note.title} ${note.base} ${note.space}`),
    run
  }
}

export function CommandPalette({
  notes,
  spaces,
  tagStats,
  selectedPath,
  selectedPinned,
  showRelatedNotes = true,
  onClose,
  onNewNote,
  onOpenNote,
  onSelectSpace,
  onTagFilter,
  onTogglePinCurrent,
  onTrashCurrent,
  onMoveCurrent,
  onOpenTrash,
  onOpenBackups,
  onOpenSettings,
  onOpenTimeline,
  onExportPdf,
  onSortChange,
  manualSortAvailable = true,
  onToggleRelatedNotes,
  comparePath = null,
  onCompareWith,
  onCloseCompare
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    return () => {
      restoreFocusIfLost(previous)
    }
  }, [])

  const currentSpace = selectedPath ? spaceOfPath(selectedPath) : ''

  const actions = useMemo<PaletteEntry[]>(() => {
    const list: PaletteEntry[] = [
      {
        id: 'new-note',
        kind: 'action',
        group: 'Actions',
        label: 'Nouvelle note',
        hint: 'Ctrl+Entrée',
        run: onNewNote
      },
      {
        id: 'open-trash',
        kind: 'action',
        group: 'Actions',
        label: 'Ouvrir la corbeille',
        run: onOpenTrash
      },
      {
        id: 'open-backups',
        kind: 'action',
        group: 'Actions',
        label: 'Sauvegardes locales',
        run: onOpenBackups
      },
      {
        id: 'open-settings',
        kind: 'action',
        group: 'Actions',
        label: 'Réglages…',
        run: onOpenSettings
      },
      ...(onOpenTimeline
        ? [
            {
              id: 'open-timeline',
              kind: 'action' as const,
              group: 'Actions',
              label: 'Timeline narrative',
              run: onOpenTimeline
            }
          ]
        : []),
      ...(onExportPdf && selectedPath
        ? [
            {
              id: 'export-pdf',
              kind: 'action' as const,
              group: 'Actions',
              label: 'Exporter en PDF',
              hint: 'Ctrl+P',
              run: onExportPdf
            }
          ]
        : []),
      ...(onToggleRelatedNotes
        ? [
            {
              id: 'toggle-related-notes',
              kind: 'action' as const,
              group: 'Actions',
              label: showRelatedNotes
                ? 'Désactiver les suggestions de notes liées'
                : 'Activer les suggestions de notes liées',
              run: onToggleRelatedNotes
            }
          ]
        : []),
      {
        id: 'sort-modified',
        kind: 'action',
        group: 'Trier',
        label: 'Trier : par modification',
        run: () => onSortChange('modified')
      },
      {
        id: 'sort-created',
        kind: 'action',
        group: 'Trier',
        label: 'Trier : par création',
        run: () => onSortChange('created')
      },
      {
        id: 'sort-title',
        kind: 'action',
        group: 'Trier',
        label: 'Trier : titre A→Z',
        run: () => onSortChange('title')
      },
      ...(manualSortAvailable
        ? [
            {
              id: 'sort-manual',
              kind: 'action' as const,
              group: 'Trier',
              label: 'Trier : ordre manuel',
              run: () => onSortChange('manual')
            }
          ]
        : [])
    ]
    if (selectedPath) {
      if (onCompareWith) {
        list.push({
          id: 'compare-with',
          kind: 'action',
          group: 'Note ouverte',
          label: 'Comparer avec une autre note…',
          hint: 'Alt+clic',
          run: onCompareWith
        })
      }
      if (comparePath && onCloseCompare) {
        list.push({
          id: 'close-compare',
          kind: 'action',
          group: 'Note ouverte',
          label: 'Fermer la comparaison',
          run: onCloseCompare
        })
      }
      list.push({
        id: 'pin-current',
        kind: 'action',
        group: 'Note ouverte',
        label: selectedPinned
          ? 'Désépingler la note ouverte'
          : 'Épingler la note ouverte',
        run: onTogglePinCurrent
      })
      list.push({
        id: 'trash-current',
        kind: 'action',
        group: 'Note ouverte',
        label: 'Mettre la note ouverte à la corbeille',
        run: onTrashCurrent
      })
      for (const space of spaces) {
        if (space.name === currentSpace) continue
        list.push({
          id: `move-${space.name}`,
          kind: 'action',
          group: 'Note ouverte',
          label: `Déplacer la note ouverte vers « ${space.name} »`,
          run: () => onMoveCurrent(space.name)
        })
      }
      if (currentSpace) {
        list.push({
          id: 'move-root',
          kind: 'action',
          group: 'Note ouverte',
          label: 'Déplacer la note ouverte vers « Boîte d’entrée »',
          run: () => onMoveCurrent('')
        })
      }
    }
    return list
  }, [
    comparePath,
    currentSpace,
    manualSortAvailable,
    onCloseCompare,
    onCompareWith,
    onMoveCurrent,
    onNewNote,
    onOpenBackups,
    onOpenTrash,
    onSortChange,
    onTogglePinCurrent,
    onTrashCurrent,
    selectedPinned,
    selectedPath,
    spaces
  ])

  const filtered = useMemo(() => {
    const hasQuery = query.trim().length > 0
    const matches = (text: string): boolean => paletteMatches(text, query)

    const matchedNotes = notes.map((note) =>
      makeNoteEntry(note, () => onOpenNote(note.path))
    )

    const spaceEntries: PaletteEntry[] = spaces.map((space) => ({
      id: `space-${space.name}`,
      kind: 'space',
      group: 'Espaces',
      label: space.name,
      detail: `${space.count} note${space.count > 1 ? 's' : ''}`,
      run: () => onSelectSpace(space.name)
    }))

    const tagEntries: PaletteEntry[] = tagStats.map((tag) => ({
      id: `tag-${tag.name}`,
      kind: 'tag',
      group: 'Tags',
      label: `#${tag.name}`,
      detail: `${tag.count} note${tag.count > 1 ? 's' : ''}`,
      run: () => onTagFilter(tag.name)
    }))

    if (!hasQuery) {
      const recent = notes.slice(0, 6).map((note) => {
        const entry = makeNoteEntry(note, () => onOpenNote(note.path), true)
        return entry
      })
      return [
        ...actions,
        ...recent,
        ...spaceEntries.slice(0, 10),
        ...tagEntries.slice(0, 8)
      ]
    }

    return [
      ...actions.filter((entry) => matches(entry.label)),
      ...matchedNotes.filter((entry) =>
        matches(`${entry.label} ${entry.search ?? ''}`)
      ),
      ...spaceEntries.filter((entry) => matches(entry.label)),
      ...tagEntries.filter((entry) => matches(entry.label))
    ]
  }, [
    actions,
    notes,
    onOpenNote,
    onSelectSpace,
    onTagFilter,
    query,
    spaces,
    tagStats
  ])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('.palette-row.is-active')
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, filtered])

  function handleKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((current) => moveListIndex(current, 'next', filtered.length) ?? 0)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current) => moveListIndex(current, 'prev', filtered.length) ?? 0)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const entry = filtered[active]
      if (!entry) return
      onClose()
      entry.run()
    }
  }

  let lastGroup = ''

  return (
    <div
      className="palette-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="command-palette" role="dialog" aria-label="Palette de commandes">
        <div className="palette-head">
          <input
            ref={inputRef}
            className="palette-input"
            type="text"
            value={query}
            placeholder="Rechercher une note, un espace, un tag ou une action…"
            spellCheck={false}
            autoComplete="off"
            aria-label="Recherche dans la palette"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKey}
          />
          <kbd className="palette-esc">Esc</kbd>
        </div>
        <div className="palette-list" ref={listRef}>
          {filtered.length ? (
            filtered.map((entry, index) => {
              const showGroup = entry.group !== lastGroup
              lastGroup = entry.group
              const Icon = KIND_ICON[entry.kind]
              return (
                <div key={entry.id} className="palette-slot">
                  {showGroup ? <p className="palette-group">{entry.group}</p> : null}
                  <button
                    type="button"
                    className={`palette-row${index === active ? ' is-active' : ''}`}
                    onMouseMove={() => setActive(index)}
                    onClick={() => {
                      onClose()
                      entry.run()
                    }}
                  >
                    <span className="palette-icon" aria-hidden="true">
                      <Icon size={13} />
                    </span>
                    <span className="palette-label">{entry.label}</span>
                    {entry.detail ? (
                      <span className="palette-detail">{entry.detail}</span>
                    ) : null}
                    {entry.hint ? <kbd className="palette-kbd">{entry.hint}</kbd> : null}
                  </button>
                </div>
              )
            })
          ) : (
            <p className="palette-empty">Aucun résultat.</p>
          )}
        </div>
        <div className="palette-foot">
          <span>↑↓ naviguer</span>
          <span>Entrée exécuter</span>
          <span>Échap fermer</span>
        </div>
      </div>
    </div>
  )
}
