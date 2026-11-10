import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Columns2, FileText } from 'lucide-react'
import type { NoteSummary } from '@shared/types'
import { moveListIndex, paletteMatches } from '@shared/nav'
import { sortNotes } from '@shared/sort'
import { restoreFocusIfLost } from '../util'

interface ComparePickerProps {
  notes: NoteSummary[]
  selectedPath: string | null
  onPick: (path: string) => void
  onClose: () => void
}

/** Choix de la note à afficher en lecture seule à côté de la note active. */
export function ComparePicker({ notes, selectedPath, onPick, onClose }: ComparePickerProps) {
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

  const choices = useMemo(
    () =>
      sortNotes(
        notes.filter((note) => note.path !== selectedPath),
        'title'
      ),
    [notes, selectedPath]
  )

  const filtered = useMemo(
    () =>
      choices.filter((note) =>
        paletteMatches(`${note.title} ${note.base} ${note.space}`, query)
      ),
    [choices, query]
  )

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
      onPick(entry.path)
    }
  }

  return (
    <div
      className="palette-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="command-palette compare-picker"
        role="dialog"
        aria-label="Comparer avec une note"
      >
        <div className="palette-head">
          <Columns2 size={15} aria-hidden="true" />
          <input
            ref={inputRef}
            className="palette-input"
            type="text"
            value={query}
            placeholder="Comparer avec…"
            spellCheck={false}
            autoComplete="off"
            aria-label="Choisir une note à comparer"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKey}
          />
          <kbd className="palette-esc">Esc</kbd>
        </div>
        <div className="palette-list" ref={listRef}>
          {filtered.length ? (
            filtered.map((note, index) => (
              <button
                key={note.path}
                type="button"
                className={`palette-row compare-picker-row${index === active ? ' is-active' : ''}`}
                onMouseMove={() => setActive(index)}
                onClick={() => onPick(note.path)}
              >
                <span className="palette-icon" aria-hidden="true">
                  <FileText size={13} />
                </span>
                <span className="palette-label">{note.title}</span>
                <span className="palette-detail">{note.space || 'Boîte d’entrée'}</span>
              </button>
            ))
          ) : (
            <p className="palette-empty">
              {choices.length
                ? 'Aucune note ne correspond.'
                : 'Aucune autre note à comparer dans ce vault.'}
            </p>
          )}
        </div>
        <div className="palette-foot">
          <span>↑↓ naviguer</span>
          <span>Entrée comparer</span>
          <span>Échap fermer</span>
        </div>
      </div>
    </div>
  )
}
