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
  spaces: Space[]
  keyNavIndex?: number | null
  comparePath?: string | null
  onSelect: (path: string) => void
  onCompare?: (path: string) => void
  onSortChange: (mode: NoteSortMode) => void
  onTogglePin: (path: string) => void
  onBatchMove: (paths: string[], space: string) => Promise<boolean>
  onBatchTag: (paths: string[], tags: string) => Promise<boolean>
  onBatchTrash: (paths: string[]) => Promise<boolean>
  onNew: () => void
  onMerge: (sourcePath: string, targetPath: string) => void
  onClearSearch: () => void
  onRemoveFilter: (kind: SearchFilterKind, value?: string) => void
  onTagClick: (tag: string) => void
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
  spaces,
  keyNavIndex = null,
  comparePath = null,
  onSelect,
  onCompare,
  onSortChange,
  onTogglePin,
  onBatchMove,
  onBatchTag,
  onBatchTrash,
  onNew,
  onMerge,
  onClearSearch,
  onRemoveFilter,
  onTagClick
}: NoteListProps) {
  const [hover, setHover] = useState<string | null>(null)
  const [selection, setSelection] = useState<string[]>([])
  const [anchor, setAnchor] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [batchSpace, setBatchSpace] = useState('')
  const [batchTagDraft, setBatchTagDraft] = useState('')
  const [batchBusy, setBatchBusy] = useState(false)
  const parsedSearch = parseSearchQuery(search)
  const searchActive = search.trim().length > 0
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
  }, [title, search])

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

  function dragOver(event: DragEvent, targetPath: string): void {
    if (!event.dataTransfer.types.includes('text/decoupe-note')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setHover(targetPath)
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
                <option key={mode} value={mode}>
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
              hover === note.path ? 'is-drop' : ''
            } ${note.pinned ? 'is-pinned' : ''} ${
              note.path === comparePath ? 'is-compared' : ''
            } ${
              activeSelection.includes(note.path) ? 'is-checked' : ''
            } ${keyNavIndex === index ? 'is-keynav' : ''}`}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('text/decoupe-note', note.path)
              event.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(event) => dragOver(event, note.path)}
            onDragLeave={() => setHover((current) => (current === note.path ? null : current))}
            onDrop={(event) => {
              const source = event.dataTransfer.getData('text/decoupe-note')
              setHover(null)
              if (!source || source === note.path) return
              event.preventDefault()
              onMerge(source, note.path)
            }}
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
    </section>
  )
}
