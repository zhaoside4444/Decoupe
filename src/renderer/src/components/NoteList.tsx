import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type JSX,
  type MouseEvent as ReactMouseEvent
} from 'react'
import {
  ArrowDownWideNarrow,
  CalendarDays,
  Check,
  Clock,
  Columns2,
  FolderInput,
  PanelLeftClose,
  Pin,
  PinOff,
  Plus,
  SearchX,
  Tags,
  Trash2,
  X
} from 'lucide-react'
import type { NoteSummary, Space } from '@shared/types'
import { parseSearchQuery, type SearchFilterKind } from '@shared/text'
import { SORT_LABELS, SORT_MODES, type NoteSortMode } from '@shared/sort'
import { formatDate, formatDateKey } from '../util'

interface NoteListProps {
  title: string
  count: number
  notes: NoteSummary[]
  selectedPath: string | null
  search: string
  sortMode: NoteSortMode
  manualSortDisabled?: boolean
  spaces: Space[]
  keyNavIndex?: number | null
  comparePath?: string | null
  onSelect: (path: string) => void
  onCompare?: (path: string) => void
  onSortChange: (mode: NoteSortMode) => void
  onReorder: (paths: string[]) => void
  onMoveNote: (path: string, direction: -1 | 1) => void
  onTogglePin: (path: string) => void
  onBatchMove: (paths: string[], space: string) => Promise<boolean>
  onBatchTag: (paths: string[], tags: string) => Promise<boolean>
  onBatchTrash: (paths: string[]) => Promise<boolean>
  onNew: () => void
  onMerge: (sourcePath: string, targetPath: string) => void
  onClearSearch: () => void
  onRemoveFilter: (kind: SearchFilterKind, value?: string) => void
  onTagClick: (tag: string) => void
  onCollapse?: () => void
}

interface SearchFilterChip {
  kind: SearchFilterKind
  value?: string
  label: string
  title: string
}

function filterDateLabel(date: string, dateEnd: string | null): SearchFilterChip {
  if (dateEnd && dateEnd !== date) {
    return {
      kind: 'date',
      label: `Créée du ${formatDateKey(date)} au ${formatDateKey(dateEnd)}`,
      title: `Créée du ${formatDateKey(date, true)} au ${formatDateKey(dateEnd, true)}`
    }
  }
  return {
    kind: 'date',
    label: `Créée le ${formatDateKey(date)}`,
    title: `Créée le ${formatDateKey(date, true)}`
  }
}

function Highlight({ text, terms }: { text: string; terms: string[] }): JSX.Element {
  const needles = Array.from(
    new Set(terms.map((term) => term.trim()).filter(Boolean))
  ).sort((a, b) => b.length - a.length)
  if (!needles.length) return <>{text}</>

  const haystack = text.toLowerCase()
  const parts: { text: string; hit: boolean }[] = []
  let cursor = 0
  while (cursor < text.length) {
    let next = -1
    let length = 0
    for (const needle of needles) {
      const found = haystack.indexOf(needle.toLowerCase(), cursor)
      if (found !== -1 && (next === -1 || found < next)) {
        next = found
        length = needle.length
      }
    }
    if (next === -1) {
      parts.push({ text: text.slice(cursor), hit: false })
      break
    }
    if (next > cursor) parts.push({ text: text.slice(cursor, next), hit: false })
    parts.push({ text: text.slice(next, next + length), hit: true })
    cursor = next + length
  }

  return (
    <>
      {parts.map((part, index) =>
        part.hit ? (
          <mark key={index} className="search-hit">
            {part.text}
          </mark>
        ) : (
          part.text
        )
      )}
    </>
  )
}

export function NoteList({
  title,
  count,
  notes,
  selectedPath,
  search,
  sortMode,
  manualSortDisabled = false,
  spaces,
  keyNavIndex = null,
  comparePath = null,
  onSelect,
  onCompare,
  onSortChange,
  onReorder,
  onMoveNote,
  onTogglePin,
  onBatchMove,
  onBatchTag,
  onBatchTrash,
  onNew,
  onMerge,
  onClearSearch,
  onRemoveFilter,
  onTagClick,
  onCollapse
}: NoteListProps) {
  const [mergeHover, setMergeHover] = useState<string | null>(null)
  const [dropLine, setDropLine] = useState<{ path: string; after: boolean } | null>(null)
  const [dragSource, setDragSource] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ path: string; x: number; y: number } | null>(null)
  const [selection, setSelection] = useState<string[]>([])
  const [anchor, setAnchor] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [batchSpace, setBatchSpace] = useState('')
  const [batchTagDraft, setBatchTagDraft] = useState('')
  const [batchBusy, setBatchBusy] = useState(false)
  const parsedSearch = parseSearchQuery(search)
  const searchActive = search.trim().length > 0
  const canReorder = sortMode === 'manual' && !searchActive
  const searchTerms = parsedSearch.text.split(/\s+/).filter(Boolean)

  const activeSelection = useMemo(
    () =>
      selection.filter((path, index, all) =>
        all.indexOf(path) === index && notes.some((note) => note.path === path)
      ),
    [selection, notes]
  )

  useEffect(() => {
    setSelection([])
    setMenu(null)
  }, [title, search])

  useEffect(() => {
    if (!menu) return
    const close = (): void => setMenu(null)
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('click', close)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    const scroller = listRef.current
    scroller?.addEventListener('scroll', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
      scroller?.removeEventListener('scroll', close)
    }
  }, [menu])

  useEffect(() => {
    if (keyNavIndex === null) return
    const card = listRef.current?.querySelector<HTMLElement>(
      `[data-key-index="${keyNavIndex}"]`
    )
    card?.scrollIntoView?.({ block: 'nearest' })
  }, [keyNavIndex, notes])

  const filters: SearchFilterChip[] = [
    ...parsedSearch.tags.map((tag) => ({
      kind: 'tag' as const,
      value: tag,
      label: `#${tag}`,
      title: `Filtrer avec #${tag}`
    })),
    ...(parsedSearch.date
      ? [filterDateLabel(parsedSearch.date, parsedSearch.dateEnd)]
      : []),
    ...(parsedSearch.text
      ? [
          {
            kind: 'text' as const,
            value: parsedSearch.text,
            label: `« ${parsedSearch.text} »`,
            title: `Recherche : ${parsedSearch.text}`
          }
        ]
      : [])
  ]
  const occurrences = notes.reduce(
    (total, note) => total + (note.match?.occurrences ?? 0),
    0
  )

  function clearDrag(): void {
    setDragSource(null)
    setMergeHover(null)
    setDropLine(null)
  }

  function handleDragStart(event: DragEvent, path: string): void {
    event.dataTransfer.setData('text/decoupe-note', path)
    event.dataTransfer.effectAllowed = 'move'
    setDragSource(path)
    setMenu(null)
  }

  function handleDragOver(event: DragEvent, note: NoteSummary): void {
    if (!event.dataTransfer.types.includes('text/decoupe-note')) return
    if (dragSource === note.path) {
      setDropLine(null)
      setMergeHover(null)
      return
    }
    if (event.altKey) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setMergeHover(note.path)
      setDropLine(null)
      return
    }
    if (!canReorder) {
      event.dataTransfer.dropEffect = 'none'
      setDropLine(null)
      setMergeHover(null)
      return
    }
    const source = notes.find((entry) => entry.path === dragSource)
    if (!source || !!source.pinned !== !!note.pinned) {
      event.dataTransfer.dropEffect = 'none'
      setDropLine(null)
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const rect = event.currentTarget.getBoundingClientRect()
    const after = event.clientY > rect.top + rect.height / 2
    setMergeHover(null)
    setDropLine((current) =>
      current?.path === note.path && current.after === after
        ? current
        : { path: note.path, after }
    )
  }

  function handleDrop(event: DragEvent, note: NoteSummary): void {
    const source = event.dataTransfer.getData('text/decoupe-note')
    const line = dropLine
    const merging = event.altKey
    clearDrag()
    if (!source || source === note.path) return
    event.preventDefault()
    if (merging) {
      onMerge(source, note.path)
      return
    }
    if (!canReorder || !line || line.path !== note.path) return
    const sourceNote = notes.find((entry) => entry.path === source)
    if (!sourceNote || !!sourceNote.pinned !== !!note.pinned) return
    const paths = notes.map((entry) => entry.path)
    const from = paths.indexOf(source)
    if (from === -1) return
    const next = [...paths]
    next.splice(from, 1)
    const insertAt = next.indexOf(note.path) + (line.after ? 1 : 0)
    if (insertAt === from) return
    next.splice(insertAt, 0, source)
    onReorder(next)
  }

  function canMove(path: string, direction: -1 | 1): boolean {
    const index = notes.findIndex((note) => note.path === path)
    if (index === -1) return false
    const target = index + direction
    if (target < 0 || target >= notes.length) return false
    return !!notes[index].pinned === !!notes[target].pinned
  }

  function handleContextMenu(event: ReactMouseEvent<HTMLElement>, note: NoteSummary): void {
    if (!canReorder) return
    event.preventDefault()
    setMenu({
      path: note.path,
      x: Math.min(event.clientX, Math.max(8, window.innerWidth - 170)),
      y: Math.min(event.clientY, Math.max(8, window.innerHeight - 84))
    })
  }

  function runBatch(action: () => Promise<boolean>): void {
    if (batchBusy || !activeSelection.length) return
    setBatchBusy(true)
    void action()
      .then((done) => {
        if (done) clearSelection()
      })
      .finally(() => setBatchBusy(false))
  }

  function handleCardClick(
    event: ReactMouseEvent<HTMLElement>,
    index: number
  ): void {
    const path = notes[index].path
    if (event.altKey && onCompare) {
      event.preventDefault()
      onCompare(path)
      return
    }
    if (event.ctrlKey || event.metaKey) {
      setAnchor(index)
      setSelection((current: string[]) =>
        current.includes(path)
          ? current.filter((item) => item !== path)
          : [...current, path]
      )
      return
    }
    if (event.shiftKey) {
      const from = anchor === null ? index : Math.min(anchor, index)
      const to = anchor === null ? index : Math.max(anchor, index)
      setSelection(notes.slice(from, to + 1).map((note) => note.path))
      return
    }
    setAnchor(index)
    if (selection.length) {
      setSelection([])
      return
    }
    onSelect(path)
  }

  function handleSelectionToggle(
    event: ReactMouseEvent<HTMLElement>,
    path: string
  ): void {
    event.stopPropagation()
    setSelection((current: string[]) =>
      current.includes(path)
        ? current.filter((item) => item !== path)
        : [...current, path]
    )
  }

  function clearSelection(): void {
    setSelection([])
    setBatchSpace('')
    setBatchTagDraft('')
  }

  function handleBatchMove(event: ChangeEvent<HTMLSelectElement>): void {
    const space = event.target.value
    setBatchSpace('')
    runBatch(() => onBatchMove([...activeSelection], space))
  }

  function handleBatchTag(): void {
    setBatchTagDraft('')
    runBatch(() => onBatchTag([...activeSelection], batchTagDraft))
  }

  function handleBatchTrash(): void {
    const count = activeSelection.length
    if (!window.confirm(`Mettre ${count} note${count > 1 ? 's' : ''} à la corbeille ?`)) {
      return
    }
    runBatch(() => onBatchTrash([...activeSelection]))
  }

  return (
    <section className="note-list">
      <header className="list-head">
        <div>
          <h2>{title}</h2>
          <p>
            {searchActive
              ? `${count} résultat${count > 1 ? 's' : ''}${
                  occurrences
                    ? ` · ${occurrences} correspondance${occurrences > 1 ? 's' : ''}`
                    : ''
                }`
              : `${count} note${count > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="list-head-tools">
          <label className="sort-wrap" title="Trier les notes">
            <ArrowDownWideNarrow size={13} aria-hidden />
            <select
              className="sort-select"
              value={sortMode}
              aria-label="Trier les notes"
              onChange={(event) => onSortChange(event.target.value as NoteSortMode)}
            >
              {SORT_MODES.map((mode) => (
                <option
                  key={mode}
                  value={mode}
                  disabled={mode === 'manual' && manualSortDisabled}
                >
                  {SORT_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="icon-btn accent" title="Nouvelle note (Ctrl+Entrée)" onClick={onNew}>
            <Plus size={17} />
          </button>
        </div>
      </header>

      {onCollapse ? (
        <button
          type="button"
          className="list-collapse"
          title="Masquer la liste des notes (Ctrl+Maj+L)"
          aria-label="Masquer la liste des notes"
          onClick={onCollapse}
        >
          <PanelLeftClose size={14} />
        </button>
      ) : null}

      <div className="list-scroll" ref={listRef}>
        {activeSelection.length ? (
          <div className="batch-bar" role="toolbar" aria-label="Actions sur la sélection">
            <div className="batch-bar-main">
              <span className="batch-count">
                {activeSelection.length} sélectionnée{activeSelection.length > 1 ? 's' : ''}
              </span>
              <label className="batch-action batch-move" title="Déplacer dans un dossier">
                <FolderInput size={12} aria-hidden />
                <select
                  className="batch-select"
                  value={batchSpace}
                  disabled={batchBusy}
                  aria-label="Déplacer vers le dossier"
                  onChange={handleBatchMove}
                >
                  <option value="">Déplacer vers…</option>
                  <option value="">Boîte d’entrée</option>
                  {spaces.map((space) => (
                    <option key={space.name} value={space.name}>
                      {space.name}
                    </option>
                  ))}
                </select>
              </label>
              <span className="batch-action batch-tag">
                <Tags size={12} aria-hidden />
                <input
                  className="batch-input"
                  type="text"
                  placeholder="Taguer… (séparés par ,)"
                  value={batchTagDraft}
                  disabled={batchBusy}
                  aria-label="Tags à ajouter"
                  onChange={(event) => setBatchTagDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && batchTagDraft.trim()) {
                      event.preventDefault()
                      handleBatchTag()
                    }
                  }}
                />
              </span>
              <button
                type="button"
                className="batch-action batch-tag-add"
                disabled={batchBusy || !batchTagDraft.trim()}
                onClick={handleBatchTag}
              >
                Ajouter
              </button>
            </div>
            <div className="batch-bar-secondary">
              <button
                type="button"
                className="batch-action batch-trash"
                disabled={batchBusy}
                onClick={handleBatchTrash}
              >
                <Trash2 size={12} />
                Corbeille
              </button>
              <button
                type="button"
                className="batch-action batch-cancel"
                disabled={batchBusy}
                onClick={clearSelection}
              >
                <Check size={12} />
                Terminer
              </button>
            </div>
          </div>
        ) : null}

        {searchActive && (
          <div className="search-filters">
            {filters.map((filter) => (
              <span
                key={`${filter.kind}:${filter.value ?? ''}`}
                className={`search-filter search-filter-${filter.kind}`}
                title={filter.title}
              >
                <span className="search-filter-label">{filter.label}</span>
                <button
                  type="button"
                  className="search-filter-remove"
                  aria-label={`Supprimer le filtre ${filter.label}`}
                  onClick={() => onRemoveFilter(filter.kind, filter.value)}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            <button type="button" className="search-reset" onClick={onClearSearch}>
              Tout afficher
            </button>
          </div>
        )}

        {notes.map((note, index) => (
          <article
            key={note.path}
            data-key-index={index}
            className={`note-card ${note.path === selectedPath ? 'is-selected' : ''} ${
              mergeHover === note.path ? 'is-drop' : ''
            } ${
              dropLine?.path === note.path
                ? dropLine.after
                  ? 'is-drop-after'
                  : 'is-drop-before'
                : ''
            } ${note.pinned ? 'is-pinned' : ''} ${
              note.path === comparePath ? 'is-compared' : ''
            } ${
              activeSelection.includes(note.path) ? 'is-checked' : ''
            } ${keyNavIndex === index ? 'is-keynav' : ''} ${
              canReorder ? 'is-reorderable' : ''
            }`}
            draggable
            onDragStart={(event) => handleDragStart(event, note.path)}
            onDragOver={(event) => handleDragOver(event, note)}
            onDragLeave={() => {
              setMergeHover((current) => (current === note.path ? null : current))
              setDropLine((current) => (current?.path === note.path ? null : current))
            }}
            onDrop={(event) => handleDrop(event, note)}
            onDragEnd={clearDrag}
            onContextMenu={(event) => handleContextMenu(event, note)}
            onClick={(event) => handleCardClick(event, index)}
          >
            <span
              className={`note-check${activeSelection.includes(note.path) ? ' is-on' : ''}`}
              title="Sélectionner (Ctrl+clic, Maj+clic)"
              aria-label={`Sélectionner ${note.title}`}
              role="checkbox"
              aria-checked={activeSelection.includes(note.path)}
              onClick={(event) => handleSelectionToggle(event, note.path)}
            >
              {activeSelection.includes(note.path) ? <Check size={10} /> : null}
            </span>
            <h3>
              {note.pinned ? (
                <span className="note-pin" title="Note épinglée">
                  <Pin size={11} />
                </span>
              ) : null}
              <Highlight text={note.title} terms={searchTerms} />
            </h3>
            <button
              type="button"
              className={`pin-btn${note.pinned ? ' is-on' : ''}`}
              title={note.pinned ? 'Désépingler' : 'Épingler'}
              aria-label={note.pinned ? `Désépingler ${note.title}` : `Épingler ${note.title}`}
              onClick={(event) => {
                event.stopPropagation()
                onTogglePin(note.path)
              }}
            >
              {note.pinned ? <PinOff size={11} /> : <Pin size={11} />}
            </button>
            {note.match?.snippet || note.excerpt ? (
              <p className="excerpt">
                <Highlight text={note.match?.snippet || note.excerpt} terms={searchTerms} />
              </p>
            ) : null}
            {note.tags.length ? (
              <div className="note-tags">
                {note.tags.slice(0, 4).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="tag-pill"
                    draggable={false}
                    title={`Filtrer avec #${tag}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onTagClick(tag)
                    }}
                  >
                    #{tag}
                  </button>
                ))}
                {note.tags.length > 4 ? (
                  <span className="tag-more" title={note.tags.slice(4).join(', ')}>
                    +{note.tags.length - 4}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="note-meta">
              <span className="note-date" title={`Créée le ${formatDateKey(note.createdAt, true)}`}>
                <CalendarDays size={10} />
                {formatDateKey(note.createdAt)}
              </span>
              <span className="note-date" title={`Modifiée le ${formatDate(note.updatedAt)}`}>
                <Clock size={10} />
                {formatDate(note.updatedAt)}
              </span>
              {note.match ? (
                <span
                  className="note-matches"
                  title={`${note.match.occurrences} correspondance${
                    note.match.occurrences > 1 ? 's' : ''
                  }`}
                >
                  {note.match.occurrences}
                </span>
              ) : null}
              {note.space && !searchActive ? <span className="note-space">{note.space}</span> : null}
              {note.path === comparePath ? (
                <span className="note-compare-badge" title="Affichée dans le panneau de comparaison">
                  <Columns2 size={10} />
                  Comparée
                </span>
              ) : null}
            </div>
          </article>
        ))}

        {!notes.length && (
          <div className="list-empty">
            <SearchX size={20} />
            <p>
              {searchActive
                ? 'Aucune note ne correspond.'
                : 'Rien par ici pour l’instant. Créez une note, elle atterrit ici.'}
            </p>
          </div>
        )}
      </div>

      {menu ? (
        <div
          className="card-menu"
          role="menu"
          aria-label="Actions de la note"
          style={{ left: menu.x, top: menu.y }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            role="menuitem"
            disabled={!canMove(menu.path, -1)}
            onClick={() => {
              const path = menu.path
              setMenu(null)
              onMoveNote(path, -1)
            }}
          >
            Monter
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!canMove(menu.path, 1)}
            onClick={() => {
              const path = menu.path
              setMenu(null)
              onMoveNote(path, 1)
            }}
          >
            Descendre
          </button>
        </div>
      ) : null}
    </section>
  )
}
