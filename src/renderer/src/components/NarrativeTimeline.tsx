import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Rows2, Rows3, Save, Search, Users, X, FileText } from 'lucide-react'
import { strongestRelation, type TimelineData, type TimelineRelation } from '@shared/timeline'
import { foldName } from '@shared/text'

interface NarrativeTimelineProps {
  data: TimelineData
  onOpenNote: (path: string) => void
  onClose: () => void
}

const ROW_HEIGHT = 28
const COMPACT_ROW_HEIGHT = 17
const COL_WIDTH = 60
const LABEL_WIDTH = 160
const HEADER_HEIGHT = 60
const MARGIN = 16
const COMPACT_KEY = 'decoupe.timeline.compact'
/** Délai avant qu'un clic simple sur un nom isole sa ligne (le double-clic ouvre la note). */
const ISOLATE_DELAY = 200

/** Libellés des types de relation, du plus fort au plus faible. */
const RELATION_META: Array<{ id: TimelineRelation; label: string }> = [
  { id: 'link', label: 'Lien wiki' },
  { id: 'tag', label: 'Tag partagé' },
  { id: 'mention', label: 'Mention' }
]

function relationLabel(relation: TimelineRelation): string {
  return RELATION_META.find((entry) => entry.id === relation)?.label ?? relation
}

interface Tooltip {
  x: number
  y: number
  text: string
}

function loadCompact(): boolean {
  try {
    return window.localStorage.getItem(COMPACT_KEY) === '1'
  } catch {
    return false
  }
}

function shorten(value: string, max: number): string {
  return value.length > max ? value.slice(0, max - 1) + '\u2026' : value
}

export function NarrativeTimeline({ data, onOpenNote, onClose }: NarrativeTimelineProps) {
  const { characters, chapters, appearances } = data
  const relations = data.relations ?? new Map<string, Map<number, TimelineRelation[]>>()

  const svgRef = useRef<SVGSVGElement | null>(null)
  const isolateTimer = useRef<number | null>(null)

  const [hoveredChar, setHoveredChar] = useState<string | null>(null)
  const [hoveredChapter, setHoveredChapter] = useState<number | null>(null)
  const [focusedChar, setFocusedChar] = useState<number | null>(null)
  const [focusedChapter, setFocusedChapter] = useState<number | null>(null)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const [search, setSearch] = useState('')
  const [compact, setCompact] = useState(loadCompact)
  const [isolated, setIsolated] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panDrag = useRef<{ active: boolean; startX: number; startY: number; panX: number; panY: number }>({ active: false, startX: 0, startY: 0, panX: 0, panY: 0 })

  const isEmpty = characters.length === 0 || chapters.length === 0
  const rowHeight = compact ? COMPACT_ROW_HEIGHT : ROW_HEIGHT

  /** Lignes et colonnes réellement affichées, après filtre texte et isolation. */
  const view = useMemo(() => {
    const allRows = characters.map((character, sourceIndex) => ({ character, sourceIndex }))
    const allColumns = chapters.map((chapter, sourceIndex) => ({ chapter, sourceIndex }))
    const query = foldName(search)

    let rows = isolated ? allRows.filter((row) => row.character.base.toLowerCase() === isolated) : allRows
    let columns = allColumns
    if (!query) return { rows, columns }

    const matches = (value: string): boolean => foldName(value).includes(query)
    const rowsByName = rows.filter(
      (row) => matches(row.character.title) || matches(row.character.base)
    )
    const columnsByTitle = columns.filter(
      (column) =>
        matches(column.chapter.title) || matches(column.chapter.label) || matches(column.chapter.base)
    )

    if (rowsByName.length > 0) {
      rows = rowsByName
    } else if (columnsByTitle.length > 0) {
      const found = new Set(columnsByTitle.map((column) => column.sourceIndex))
      rows = rows.filter((row) =>
        Array.from(appearances.get(row.character.base.toLowerCase()) ?? []).some((index) =>
          found.has(index)
        )
      )
    } else {
      rows = []
    }

    if (columnsByTitle.length > 0) {
      columns = columnsByTitle
    } else {
      const needed = new Set<number>()
      for (const row of rows) {
        appearances.get(row.character.base.toLowerCase())?.forEach((index) => needed.add(index))
      }
      columns = allColumns.filter((column) => needed.has(column.sourceIndex))
    }

    if (rows.length === 0) columns = []
    return { rows, columns }
  }, [characters, chapters, appearances, search, isolated])

  /** Positions (dans les colonnes visibles) des apparitions d'un personnage. */
  const positionsFor = useCallback(
    (base: string): number[] => {
      const indices = appearances.get(base.toLowerCase())
      if (!indices || indices.size === 0) return []
      const positions: number[] = []
      view.columns.forEach((column, position) => {
        if (indices.has(column.sourceIndex)) positions.push(position)
      })
      return positions
    },
    [appearances, view.columns]
  )

  const relationsFor = useCallback(
    (base: string, chapterIndex: number): TimelineRelation[] =>
      relations.get(base.toLowerCase())?.get(chapterIndex) ?? [],
    [relations]
  )

  /** Types de relation réellement visibles, pour n'afficher que les entrées utiles de la légende. */
  const usedRelations = useMemo(() => {
    const visible = new Set(view.columns.map((column) => column.sourceIndex))
    const used = new Set<TimelineRelation>()
    for (const row of view.rows) {
      relations.get(row.character.base.toLowerCase())?.forEach((list, chapterIndex) => {
        if (!visible.has(chapterIndex)) return
        for (const relation of list) used.add(relation)
      })
    }
    return used
  }, [view, relations])

  const showPan = view.columns.length > 50

  const resetView = () => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    if (!showPan || !(event.ctrlKey || event.metaKey)) return
    event.preventDefault()
    const delta = event.deltaY > 0 ? -0.15 : 0.15
    setScale((prev) => {
      const next = Math.round((prev + delta) * 10) / 10
      return Math.min(3, Math.max(0.6, next))
    })
  }

  const handleMouseDown = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!showPan || event.button !== 0) return
    panDrag.current = { active: true, startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y }
  }

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!panDrag.current.active || !showPan) return
    setPan({
      x: panDrag.current.panX + event.clientX - panDrag.current.startX,
      y: panDrag.current.panY + event.clientY - panDrag.current.startY
    })
  }

  const handleMouseUp = () => {
    panDrag.current.active = false
  }

  const toggleIsolation = (base: string): void => {
    setIsolated((previous) => (previous === base ? null : base))
  }

  const scheduleIsolation = (base: string): void => {
    if (isolateTimer.current) window.clearTimeout(isolateTimer.current)
    isolateTimer.current = window.setTimeout(() => {
      isolateTimer.current = null
      toggleIsolation(base)
    }, ISOLATE_DELAY)
  }

  const openNow = (path: string): void => {
    if (isolateTimer.current) {
      window.clearTimeout(isolateTimer.current)
      isolateTimer.current = null
    }
    onOpenNote(path)
  }

  const moveRow = (index: number): void => {
    if (view.rows.length === 0) return
    const next = Math.min(Math.max(index, 0), view.rows.length - 1)
    setFocusedChar(next)
    const positions = positionsFor(view.rows[next].character.base)
    setFocusedChapter(positions.length > 0 ? positions[0] : null)
  }

  // Mémorise le mode compact d'une session à l'autre.
  useEffect(() => {
    try {
      window.localStorage.setItem(COMPACT_KEY, compact ? '1' : '0')
    } catch {
      // Stockage indisponible : le choix tient pour la session.
    }
  }, [compact])

  // Donne le focus au SVG à l'ouverture pour activer la navigation clavier.
  useEffect(() => {
    if (isEmpty) return
    svgRef.current?.focus()
  }, [isEmpty])

  // Les filtres changent la liste affichée : on repart d'une sélection neutre.
  useEffect(() => {
    setFocusedChar(null)
    setFocusedChapter(null)
    setHoveredChar(null)
    setHoveredChapter(null)
    setTooltip(null)
  }, [search, isolated])

  useEffect(() => {
    return () => {
      if (isolateTimer.current) window.clearTimeout(isolateTimer.current)
    }
  }, [])

  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>): void => {
    if (isEmpty) return
    const rowIndex = focusedChar
    const row = rowIndex !== null ? view.rows[rowIndex] : undefined
    const positions = row ? positionsFor(row.character.base) : []
    const currentPosition = focusedChapter !== null ? positions.indexOf(focusedChapter) : -1

    switch (event.key) {
      case 'ArrowLeft': {
        if (positions.length === 0) return
        event.preventDefault()
        const next =
          currentPosition <= 0 ? positions[positions.length - 1] : positions[currentPosition - 1]
        setFocusedChapter(next)
        break
      }
      case 'ArrowRight': {
        if (positions.length === 0) return
        event.preventDefault()
        const next =
          currentPosition === -1 || currentPosition >= positions.length - 1
            ? positions[0]
            : positions[currentPosition + 1]
        setFocusedChapter(next)
        break
      }
      case 'ArrowUp': {
        if (view.rows.length === 0) return
        event.preventDefault()
        moveRow(rowIndex === null ? 0 : rowIndex - 1)
        break
      }
      case 'ArrowDown': {
        if (view.rows.length === 0) return
        event.preventDefault()
        moveRow(rowIndex === null ? 0 : rowIndex + 1)
        break
      }
      case 'Enter': {
        if (!row) return
        event.preventDefault()
        const column = focusedChapter !== null ? view.columns[focusedChapter] : undefined
        onOpenNote(column ? column.chapter.path : row.character.path)
        break
      }
      case 'Escape': {
        event.preventDefault()
        onClose()
        break
      }
      default:
        break
    }
  }

  if (isEmpty) {
    return (
      <div
        className="timeline-overlay"
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div className="timeline-dialog" role="dialog" aria-label="Timeline narrative">
          <header className="timeline-head">
            <div>
              <h2>Timeline narrative</h2>
              <p>Aucune donnée. Taggez des notes avec #personnage et #chapitre.</p>
            </div>
            <button type="button" className="icon-btn" aria-label="Fermer" onClick={onClose}>
              <X size={15} />
            </button>
          </header>
          <div className="timeline-empty">
            <Users size={32} />
            <p>Pour utiliser la timeline :</p>
            <ul>
              <li>
                Taggez les notes de personnages avec <code>#personnage</code>
              </li>
              <li>
                Taggez les notes de chapitres avec <code>#chapitre</code>
              </li>
              <li>
                Référencez les personnages dans les chapitres via <code>[[Nom]]</code>
              </li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  const svgWidth = LABEL_WIDTH + view.columns.length * COL_WIDTH + MARGIN * 2
  const svgHeight = HEADER_HEIGHT + view.rows.length * rowHeight + MARGIN * 2
  const totalAppearances = view.rows.reduce(
    (sum, row) => sum + positionsFor(row.character.base).length,
    0
  )
  const filtered = view.rows.length !== characters.length || view.columns.length !== chapters.length
  const nothingToShow = view.rows.length === 0 || view.columns.length === 0

  return (
    <div
      className="timeline-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="timeline-dialog" role="dialog" aria-label="Timeline narrative">
        <header className="timeline-head">
          <div>
            <h2>Timeline narrative</h2>
            <p>
              {view.rows.length} personnage{view.rows.length > 1 ? 's' : ''} · {view.columns.length}{' '}
              chapitre{view.columns.length > 1 ? 's' : ''}
              {filtered ? ` · ${characters.length} et ${chapters.length} au total` : ''}
            </p>
          </div>
          <div className="timeline-tools">
            <label className="search timeline-search">
              <Search size={12} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Escape') return
                  e.preventDefault()
                  if (search) setSearch('')
                  else onClose()
                }}
                placeholder="Filtrer…"
                aria-label="Filtrer les personnages et les chapitres"
                spellCheck={false}
              />
              {search && (
                <button
                  type="button"
                  className="search-clear"
                  aria-label="Effacer le filtre"
                  onClick={() => setSearch('')}
                >
                  <X size={11} />
                </button>
              )}
            </label>
            <button
              type="button"
              className={`icon-btn ${compact ? 'is-active' : ''}`}
              aria-pressed={compact}
              aria-label="Mode compact"
              title={compact ? 'Revenir à l’affichage normal' : 'Mode compact (lignes réduites)'}
              onClick={() => setCompact((value) => !value)}
            >
              {compact ? <Rows3 size={15} /> : <Rows2 size={15} />}
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Exporter en PNG"
              title="Exporter la timeline en PNG"
              onClick={() => {
                const svg = svgRef.current
                if (!svg) return
                const clone = svg.cloneNode(true) as SVGSVGElement
                clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
                const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
                bgRect.setAttribute('x', '0')
                bgRect.setAttribute('y', '0')
                bgRect.setAttribute('width', String(Math.round(parseFloat(svg.getAttribute('width') ?? '600') * 1.3)))
                bgRect.setAttribute('height', svg.getAttribute('height') ?? '100%')
                bgRect.setAttribute('fill', '#fff7f0')
                clone.insertBefore(bgRect, clone.firstChild)
                const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
                styleEl.textContent = 'text{font-family:sans-serif}.timeline-chapter-label{fill:#2a2322;font-size:9px}.timeline-chapter-label.is-hovered,.timeline-chapter-label.is-focused{fill:#c45a2a;font-weight:700}.timeline-chapter-order{fill:#6e6a68;font-size:8px;font-weight:600}.timeline-row-bg{fill:transparent}.timeline-row-bg.is-hovered,.timeline-row-bg.is-focused{fill:#f0ebe6}.timeline-char-label{fill:#2a2322;font-size:10.5px}.timeline-char-label.is-hovered,.timeline-char-label.is-focused{fill:#c45a2a;font-weight:700}.timeline-dot.is-link{fill:#c45a2a}.timeline-dot.is-tag{fill:#d4966a}.timeline-dot.is-mention{fill:none;stroke:#9a9593;stroke-width:1.5}.timeline-dot.is-highlighted,.timeline-dot.is-focused{fill:#8a3f1d;stroke:none;filter:none}.timeline-connect-line{stroke:#e0d5cf;stroke-width:1.5;stroke-dasharray:3 3;opacity:0.8}.timeline-grid-line{stroke:#dcd8d4;stroke-width:0.5;opacity:0.7}'
                clone.appendChild(styleEl)
                const serializer = new XMLSerializer()
                const svgString = serializer.serializeToString(clone)
                const base64 = btoa(unescape(encodeURIComponent(svgString)))
                const dataUrl = `data:image/svg+xml;base64,${base64}`
                const stamp = new Date().toISOString().replace(/[:.]/g, '-')
                const suggested = `timeline-${stamp}.png`
                void window.api.exportImage(dataUrl, suggested).then((path) => {
                  if (path) alert('Timeline exportée : ' + path)
                }).catch((error) => alert('Erreur export : ' + (error?.message ?? error)))
              }}
            >
              <Save size={15} />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Exporter en PDF"
              title="Exporter la timeline en PDF"
              onClick={() => {
                const svg = svgRef.current
                if (!svg) return
                const clone = svg.cloneNode(true) as SVGSVGElement
                clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
                const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
                bgRect.setAttribute('x', '0')
                bgRect.setAttribute('y', '0')
                bgRect.setAttribute('width', String(Math.round(parseFloat(svg.getAttribute('width') ?? '600') * 1.3)))
                bgRect.setAttribute('height', svg.getAttribute('height') ?? '100%')
                bgRect.setAttribute('fill', '#fff7f0')
                clone.insertBefore(bgRect, clone.firstChild)
                const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
                styleEl.textContent = 'text{font-family:sans-serif}.timeline-chapter-label{fill:#2a2322;font-size:9px}.timeline-chapter-label.is-hovered,.timeline-chapter-label.is-focused{fill:#c45a2a;font-weight:700}.timeline-chapter-order{fill:#6e6a68;font-size:8px;font-weight:600}.timeline-row-bg{fill:transparent}.timeline-row-bg.is-hovered,.timeline-row-bg.is-focused{fill:#f0ebe6}.timeline-char-label{fill:#2a2322;font-size:10.5px}.timeline-char-label.is-hovered,.timeline-char-label.is-focused{fill:#c45a2a;font-weight:700}.timeline-dot.is-link{fill:#c45a2a}.timeline-dot.is-tag{fill:#d4966a}.timeline-dot.is-mention{fill:none;stroke:#9a9593;stroke-width:1.5}.timeline-dot.is-highlighted,.timeline-dot.is-focused{fill:#8a3f1d;stroke:none;filter:none}.timeline-connect-line{stroke:#e0d5cf;stroke-width:1.5;stroke-dasharray:3 3;opacity:0.8}.timeline-grid-line{stroke:#dcd8d4;stroke-width:0.5;opacity:0.7}'
                clone.appendChild(styleEl)
                const serializer = new XMLSerializer()
                const svgString = serializer.serializeToString(clone)
                const html = `<html><head><meta charset="utf-8"><title>Timeline narrative</title><style>body{margin:0;padding:20px;background:#fff7f0;font-family:sans-serif;}h2{margin:0 0 8px;font-size:16px;color:#2a2322;}</style></head><body><h2>Timeline narrative</h2><div style="width:max-content;">${svgString}</div></body></html>`
                const stamp = new Date().toISOString().replace(/[:.]/g, '-')
                const suggested = `timeline-${stamp}.pdf`
                void window.api.exportPdf(html, suggested).then((path) => {
                  if (path) alert('Timeline exportée : ' + path)
                }).catch((error) => alert('Erreur export : ' + (error?.message ?? error)))
              }}
            >
              <FileText size={15} />
            </button>
            <button type="button" className="icon-btn" aria-label="Fermer" onClick={onClose}>
              <X size={15} />
            </button>
          </div>
        </header>

        <div className="timeline-legend" role="group" aria-label="Légende des personnages">
          <span className="timeline-legend-label">Légende</span>
          {characters.map((character) => {
            const base = character.base.toLowerCase()
            const active = isolated === base
            const count = appearances.get(base)?.size ?? 0
            return (
              <button
                key={character.path}
                type="button"
                className={`timeline-chip ${active ? 'is-active' : ''} ${count === 0 ? 'is-empty' : ''}`}
                aria-pressed={active}
                onClick={() => toggleIsolation(base)}
                title={`Isoler la ligne de ${character.title} (${count} apparition${count > 1 ? 's' : ''})`}
              >
                <span className="timeline-chip-label">{character.title}</span>
                <span className="timeline-chip-count">{count}</span>
              </button>
            )
          })}
          {isolated && (
            <button
              type="button"
              className="timeline-legend-clear"
              onClick={() => setIsolated(null)}
            >
              Tout afficher
            </button>
          )}
        </div>

        {nothingToShow ? (
          <div className="timeline-empty">
            <Search size={28} />
            <p>
              {view.rows.length === 0
                ? `Aucun personnage ni chapitre ne correspond à « ${search.trim()} ».`
                : 'Aucune apparition à afficher pour ce filtre.'}
            </p>
            <button
              type="button"
              className="timeline-reset"
              onClick={() => {
                setSearch('')
                setIsolated(null)
              }}
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="timeline-scroll">
            <svg
              ref={svgRef}
              width={svgWidth}
              height={svgHeight}
              className={`timeline-svg ${compact ? 'is-compact' : ''} ${showPan ? 'is-pan' : ''}`}
              role="img"
              aria-label="Timeline des apparitions de personnages par chapitre"
              tabIndex={0}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (focusedChar === null) moveRow(0)
              }}
              onWheel={handleWheel}
            >
              <g
                transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ cursor: showPan ? 'grab' : 'default' }}
              >
              {/* En-tête : colonnes de chapitres */}
              {view.columns.map((column, position) => {
                const x = LABEL_WIDTH + position * COL_WIDTH + COL_WIDTH / 2 + MARGIN
                const isHovered = hoveredChapter === position
                const isFocused = focusedChapter === position
                return (
                  <g key={column.chapter.path} className="timeline-chapter-header">
                    <text
                      x={x}
                      y={HEADER_HEIGHT - 8}
                      textAnchor="middle"
                      className={`timeline-chapter-label ${isHovered ? 'is-hovered' : ''} ${
                        isFocused ? 'is-focused' : ''
                      }`}
                      onClick={() => onOpenNote(column.chapter.path)}
                      onMouseEnter={(event) => {
                        setHoveredChapter(position)
                        setTooltip({
                          x: event.clientX,
                          y: event.clientY,
                          text: [column.chapter.title, column.chapter.snippet]
                            .filter(Boolean)
                            .join('\n')
                        })
                      }}
                      onMouseLeave={() => {
                        setHoveredChapter(null)
                        setTooltip(null)
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {shorten(column.chapter.label, compact ? 9 : 12)}
                    </text>
                    {column.chapter.order > 0 && (
                      <text
                        x={x}
                        y={HEADER_HEIGHT - 22}
                        textAnchor="middle"
                        className="timeline-chapter-order"
                      >
                        {column.chapter.order}
                      </text>
                    )}
                  </g>
                )
              })}

              {/* Lignes : un personnage par ligne */}
              {view.rows.map((row, rowIndex) => {
                const base = row.character.base.toLowerCase()
                const y = HEADER_HEIGHT + rowIndex * rowHeight + rowHeight / 2 + MARGIN
                const positions = positionsFor(row.character.base)
                const isHovered = hoveredChar === base
                const isFocused = focusedChar === rowIndex
                const points = positions
                  .map((position) => `${LABEL_WIDTH + position * COL_WIDTH + COL_WIDTH / 2 + MARGIN},${y}`)
                  .join(' ')

                return (
                  <g key={row.character.path} className="timeline-row">
                    <rect
                      x={MARGIN}
                      y={HEADER_HEIGHT + rowIndex * rowHeight + MARGIN}
                      width={svgWidth - MARGIN * 2}
                      height={rowHeight}
                      className={`timeline-row-bg ${isHovered ? 'is-hovered' : ''} ${
                        isFocused ? 'is-focused' : ''
                      }`}
                    />
                    <text
                      x={LABEL_WIDTH - 8 + MARGIN}
                      y={y}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className={`timeline-char-label ${isHovered ? 'is-hovered' : ''} ${
                        isFocused ? 'is-focused' : ''
                      }`}
                      onClick={() => scheduleIsolation(base)}
                      onDoubleClick={() => openNow(row.character.path)}
                      onMouseEnter={(event) => {
                        setHoveredChar(base)
                        setFocusedChar(rowIndex)
                        setTooltip({
                          x: event.clientX,
                          y: event.clientY,
                          text: row.character.title
                        })
                      }}
                      onMouseLeave={() => {
                        setHoveredChar(null)
                        setTooltip(null)
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <title>Cliquer pour isoler · double-clic pour ouvrir la note</title>
                      {shorten(row.character.title, 18)}
                    </text>

                    {positions.map((position) => {
                      const x = LABEL_WIDTH + position * COL_WIDTH + COL_WIDTH / 2 + MARGIN
                      const column = view.columns[position]
                      const isChapterHovered = hoveredChapter === position
                      const isChapterFocused = focusedChapter === position
                      const chapterRelations = relationsFor(
                        row.character.base,
                        column.sourceIndex
                      )
                      const strongest = strongestRelation(chapterRelations)
                      return (
                        <circle
                          key={`${row.character.base}-${column.chapter.path}`}
                          cx={x}
                          cy={y}
                          r={isHovered || isChapterHovered || isChapterFocused ? 6 : 4.5}
                          className={`timeline-dot ${strongest ? `is-${strongest}` : ''} ${
                            isHovered || isChapterHovered ? 'is-highlighted' : ''
                          } ${isChapterFocused ? 'is-focused' : ''}`}
                          onClick={() => {
                            setFocusedChar(rowIndex)
                            setFocusedChapter(position)
                            onOpenNote(column.chapter.path)
                          }}
                          onMouseEnter={(event) => {
                            setHoveredChar(base)
                            setHoveredChapter(position)
                            setFocusedChar(rowIndex)
                            setFocusedChapter(position)
                            setTooltip({
                              x: event.clientX,
                              y: event.clientY,
                              text: [
                                column.chapter.title,
                                chapterRelations.map(relationLabel).join(' · '),
                                column.chapter.snippet
                              ]
                                .filter(Boolean)
                                .join('\n')
                            })
                          }}
                          onMouseLeave={() => {
                            setHoveredChar(null)
                            setHoveredChapter(null)
                            setTooltip(null)
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                      )
                    })}

                    {positions.length > 1 && (
                      <polyline points={points} className="timeline-connect-line" fill="none" />
                    )}
                  </g>
                )
              })}

              {/* Quadrillage vertical */}
              {view.columns.map((column, position) => {
                const x = LABEL_WIDTH + position * COL_WIDTH + MARGIN
                return (
                  <line
                    key={`grid-${column.chapter.path}`}
                    x1={x}
                    y1={HEADER_HEIGHT + MARGIN}
                    x2={x}
                    y2={svgHeight - MARGIN}
                    className="timeline-grid-line"
                  />
                )
              })}
              </g>
            </svg>

            {tooltip && tooltip.text && (
              <div
                className="timeline-tooltip"
                style={{
                  position: 'fixed',
                  left: Math.max(8, Math.min(tooltip.x + 12, window.innerWidth - 300)),
                  top: Math.max(8, Math.min(tooltip.y + 12, window.innerHeight - 150)),
                  zIndex: 1000
                }}
              >
                <div className="tooltip-content">{tooltip.text}</div>
              </div>
            )}

            <footer className="timeline-foot">
              <span className="timeline-relations">
                {RELATION_META.filter((entry) => usedRelations.has(entry.id)).map((entry) => (
                  <span key={entry.id} className="timeline-relation">
                    <span className={`timeline-swatch is-${entry.id}`} aria-hidden="true" />
                    {entry.label}
                  </span>
                ))}
                {showPan ? (
                  <span className="timeline-relation">
                    {' · '}
                    <span>Zoom {Math.round(scale * 100)}%</span>
                    <button type="button" className="timeline-reset" onClick={resetView}>
                      Réinitialiser
                    </button>
                  </span>
                ) : null}
              </span>
              <span className="timeline-foot-hint">
                Cliquez sur un nom pour isoler sa ligne · double-clic pour ouvrir la note.
                {showPan ? ' · Molette + Ctrl = zoom · Glisser = déplacer' : ''}
              </span>
              <span>{totalAppearances} apparitions au total.</span>
            </footer>
          </div>
        )}
      </div>
    </div>
  )
}
