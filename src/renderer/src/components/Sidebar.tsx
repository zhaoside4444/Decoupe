import { useEffect, useRef, useState, type DragEvent, type ReactNode, type RefObject } from 'react'
import {
  Archive,
  BookOpen,
  CalendarDays,
  Folder,
  FolderOpen,
  Inbox,
  Layers,
  Pencil,
  Plus,
  Scissors,
  Search,
  Settings,
  Tag,
  Trash2,
  HelpCircle,
  X
} from 'lucide-react'
import type { Space, TagSummary, VaultInfo } from '@shared/types'
import { vaultBaseName } from '@shared/vaults'
import { parseHelpInline, parseHelpMarkdown } from '@shared/help'
import helpMarkdown from '../../../../AIDE.md?raw'
import { parseSearchQuery } from '@shared/text'
import { NoteCalendar } from './NoteCalendar'
import { restoreFocusIfLost } from '../util'

const helpDocument = parseHelpMarkdown(helpMarkdown)

function renderHelpText(text: string): ReactNode {
  return parseHelpInline(text).map((token, index) => {
    if (token.code) {
      return (
        <code key={index} className="help-code">
          {token.text}
        </code>
      )
    }
    if (token.strong) return <strong key={index}>{token.text}</strong>
    return <span key={index}>{token.text}</span>
  })
}

interface SidebarProps {
  vault: VaultInfo
  spaces: Space[]
  notesInInbox: number
  totalNotes: number
  activeSpace: string
  onSelectSpace: (space: string) => void
  onCreateSpace: (name: string) => Promise<void>
  onRenameSpace: (from: string, to: string) => Promise<void>
  onTrashSpace: (name: string) => Promise<void>
  onMoveNote: (path: string, space: string) => void
  onSwitchVault: (root?: string) => void
  onReveal: () => void
  search: string
  onSearch: (value: string) => void
  searchRef: RefObject<HTMLInputElement | null>
  trashCount: number
  onOpenTrash: () => void
  onOpenBackups: () => void
  onOpenSettings: () => void
  onOpenTimeline?: () => void
  tagStats: TagSummary[]
  dateCounts: Map<string, number>
  onTagFilter: (tag: string) => void
  onDateFilter: (date: string | null) => void
  onRenameTag: (from: string, to: string) => Promise<void>
  onDeleteTag: (tag: string) => Promise<void>
}

export function Sidebar({
  vault,
  spaces,
  notesInInbox,
  totalNotes,
  activeSpace,
  onSelectSpace,
  onCreateSpace,
  onRenameSpace,
  onTrashSpace,
  onMoveNote,
  onSwitchVault,
  onReveal,
  search,
  onSearch,
  searchRef,
  trashCount,
  onOpenTrash,
  onOpenBackups,
  onOpenSettings,
  onOpenTimeline,
  tagStats,
  dateCounts,
  onTagFilter,
  onDateFilter,
  onRenameTag,
  onDeleteTag
}: SidebarProps) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [creatingBusy, setCreatingBusy] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameBusy, setRenameBusy] = useState(false)
  const [renamingTag, setRenamingTag] = useState<string | null>(null)
  const [renameTagValue, setRenameTagValue] = useState('')
  const [renameTagBusy, setRenameTagBusy] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [vaultMenuOpen, setVaultMenuOpen] = useState(false)
  const [recentVaults, setRecentVaults] = useState<string[]>([])
  const vaultMenuRef = useRef<HTMLDivElement>(null)
  const vaultMenuListRef = useRef<HTMLDivElement>(null)
  const vaultButtonRef = useRef<HTMLButtonElement>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  )
  const calendarRef = useRef<HTMLDivElement>(null)
  const parsedSearch = parseSearchQuery(search)
  const activeTags = new Set(parsedSearch.tags.map((tag) => tag.toLowerCase()))
  const activeDate = parsedSearch.date

  useEffect(() => {
    if (!vaultMenuOpen) return
    try {
      const raw = window.localStorage.getItem('recentVaults')
      setRecentVaults(raw ? (JSON.parse(raw) as string[]) : [])
    } catch {
      setRecentVaults([])
    }
    const focusTimer = window.setTimeout(() => {
      vaultMenuListRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    }, 0)
    function handlePointer(event: MouseEvent): void {
      const target = event.target as Node
      if (vaultMenuRef.current?.contains(target)) return
      if (vaultMenuListRef.current?.contains(target)) return
      setVaultMenuOpen(false)
    }
    function handleKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setVaultMenuOpen(false)
        vaultButtonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [vaultMenuOpen])

  useEffect(() => {
    if (!calendarOpen) return
    function handlePointer(event: MouseEvent): void {
      if (!calendarRef.current?.contains(event.target as Node)) setCalendarOpen(false)
    }
    function handleKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') setCalendarOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [calendarOpen])

  useEffect(() => {
    if (!calendarOpen) return
    const previous = document.activeElement as HTMLElement | null
    return () => {
      restoreFocusIfLost(previous)
    }
  }, [calendarOpen])

  function toggleCalendar(): void {
    if (!calendarOpen) {
      const date = activeDate ? activeDate.split('-').map(Number) : null
      const base = date
        ? new Date(date[0], date[1] - 1, 1)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      setCalendarMonth(base)
    }
    setCalendarOpen((open) => !open)
  }

  function selectDate(date: string | null): void {
    onDateFilter(date)
    setCalendarOpen(false)
  }

  function startRename(name: string): void {
    setRenaming(name)
    setRenameValue(name)
  }

  function cancelRename(): void {
    if (renameBusy) return
    setRenaming(null)
    setRenameValue('')
  }

  async function submitRename(): Promise<void> {
    const from = renaming
    if (!from || renameBusy) return
    const name = renameValue.trim()
    if (!name || name === from) {
      setRenaming(null)
      setRenameValue('')
      return
    }
    setRenameBusy(true)
    try {
      await onRenameSpace(from, name)
      setRenaming(null)
      setRenameValue('')
    } catch {
      // L'erreur est signalée par l'application ; le champ reste ouvert.
    } finally {
      setRenameBusy(false)
    }
  }

  async function submitSpace(): Promise<void> {
    const name = newName.trim()
    if (!name || creatingBusy) return
    setCreatingBusy(true)
    try {
      await onCreateSpace(name)
      setNewName('')
      setCreating(false)
    } catch {
      // L'erreur est signalée par l'application ; le champ reste ouvert.
    } finally {
      setCreatingBusy(false)
    }
  }

  function startTagRename(name: string): void {
    setRenamingTag(name)
    setRenameTagValue(name)
  }

  function cancelTagRename(): void {
    if (renameTagBusy) return
    setRenamingTag(null)
    setRenameTagValue('')
  }

  async function submitTagRename(): Promise<void> {
    const from = renamingTag
    if (!from || renameTagBusy) return
    const name = renameTagValue.trim()
    if (!name || name === from) {
      setRenamingTag(null)
      setRenameTagValue('')
      return
    }
    setRenameTagBusy(true)
    try {
      await onRenameTag(from, name)
      setRenamingTag(null)
      setRenameTagValue('')
    } catch {
      // L'erreur est signalée par l'application ; le champ reste ouvert.
    } finally {
      setRenameTagBusy(false)
    }
  }

  function dropProps(target: string): {
    onDragOver: (event: DragEvent) => void
    onDragLeave: () => void
    onDrop: (event: DragEvent) => void
  } {
    return {
      onDragOver: (event) => {
        if (!event.dataTransfer.types.includes('text/decoupe-note')) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setDragOver(target)
      },
      onDragLeave: () => setDragOver((current) => (current === target ? null : current)),
      onDrop: (event) => {
        const source = event.dataTransfer.getData('text/decoupe-note')
        setDragOver(null)
        if (!source) return
        event.preventDefault()
        onMoveNote(source, target)
      }
    }
  }

  const inboxDrop = dropProps('')

  return (
    <>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Scissors size={15} strokeWidth={2.2} />
          </span>
          <span className="brand-text">
            <strong>Decoupe</strong>
            <span className="brand-vault" title={vault.path}>
              {vault.name}
            </span>
          </span>
          <div className="brand-vault-switch" ref={vaultMenuRef}>
            <button
              ref={vaultButtonRef}
              type="button"
              className="icon-btn"
              title="Changer de dossier"
              aria-label="Changer de dossier"
              aria-haspopup="menu"
              aria-expanded={vaultMenuOpen}
              onClick={() => setVaultMenuOpen((open) => !open)}
            >
              <FolderOpen size={15} />
            </button>
            {vaultMenuOpen && (
              <div
                className="vault-menu"
                role="menu"
                aria-label="Choisir un dossier de notes"
                ref={vaultMenuListRef}
              >
                <p className="vault-menu-head">Dossiers récents</p>
                {recentVaults.length ? (
                  recentVaults.map((recentPath) => {
                    const current = recentPath === vault.path
                    return (
                      <button
                        key={recentPath}
                        type="button"
                        role="menuitem"
                        className={`vault-menu-item${current ? ' is-current' : ''}`}
                        title={recentPath}
                        onClick={() => {
                          setVaultMenuOpen(false)
                          if (!current) onSwitchVault(recentPath)
                        }}
                      >
                        <span className="vault-menu-row">
                          <span className="vault-menu-name">{vaultBaseName(recentPath)}</span>
                          {current ? <span className="vault-menu-badge">actuel</span> : null}
                        </span>
                        <span className="vault-menu-path">{recentPath}</span>
                      </button>
                    )
                  })
                ) : (
                  <p className="vault-menu-empty">Aucun dossier récent.</p>
                )}
                <button
                  type="button"
                  role="menuitem"
                  className="vault-menu-item vault-menu-browse"
                  onClick={() => {
                    setVaultMenuOpen(false)
                    onSwitchVault()
                  }}
                >
                  <FolderOpen size={13} />
                  <span>Choisir un autre dossier…</span>
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="icon-btn brand-switch"
            title="Aide"
            aria-label="Aide"
            onClick={() => setHelpOpen(true)}
          >
            <HelpCircle size={15} />
          </button>
        </div>

        {onOpenTimeline ? (
          <button
            type="button"
            className="nav-item"
            title="Timeline narrative des personnages (Ctrl+Shift+T)"
            onClick={onOpenTimeline}
            style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontWeight: 600 }}
          >
            <BookOpen size={16} />
            <span className="nav-label">Timeline narrative</span>
          </button>
        ) : null}

        <div className="search-wrap" ref={calendarRef}>
          <label className="search" htmlFor="decoupe-search">
            <Search size={14} />
            <input
              id="decoupe-search"
              ref={searchRef}
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Rechercher, #tag ou date"
              spellCheck={false}
              autoComplete="off"
            />
            <button
              type="button"
              className={`search-calendar ${activeDate ? 'is-active' : ''}`}
              aria-label="Ouvrir le calendrier"
              aria-expanded={calendarOpen}
              title="Rechercher par date de création"
              onClick={toggleCalendar}
            >
              <CalendarDays size={14} />
            </button>
            {search ? (
              <button
                type="button"
                className="search-clear"
                aria-label="Effacer la recherche"
                onClick={() => {
                  onSearch('')
                  setCalendarOpen(false)
                }}
              >
                <X size={13} />
              </button>
            ) : (
              <kbd>Ctrl K</kbd>
            )}
          </label>
          {calendarOpen ? (
            <NoteCalendar
              month={calendarMonth}
              activeDate={activeDate}
              counts={dateCounts}
              onMonthChange={(offset) =>
                setCalendarMonth(
                  (current) =>
                    new Date(current.getFullYear(), current.getMonth() + offset, 1)
                )
              }
              onSelect={selectDate}
              onClose={() => setCalendarOpen(false)}
            />
          ) : null}
        </div>

        <nav className="nav">
          <button
            type="button"
            className={`nav-item ${activeSpace === '' ? 'is-active' : ''} ${
              dragOver === '' ? 'is-drop' : ''
            }`}
            onClick={() => onSelectSpace('')}
            {...inboxDrop}
          >
            <Inbox size={16} />
            <span className="nav-label">Boîte d'entrée</span>
            <span className="count">{notesInInbox || ''}</span>
          </button>
          <button
            type="button"
            className={`nav-item ${activeSpace === '*' ? 'is-active' : ''}`}
            onClick={() => onSelectSpace('*')}
          >
            <Layers size={16} />
            <span className="nav-label">Toutes les notes</span>
            <span className="count">{totalNotes || ''}</span>
          </button>
        </nav>

        <div className="section-label">
          <span>Espaces</span>
        </div>

        <div className="spaces">
          {spaces.map((space) =>
            renaming === space.name ? (
              <div className="space-create" key={space.name}>
                <Folder size={16} />
                <input
                  autoFocus
                  value={renameValue}
                  disabled={renameBusy}
                  spellCheck={false}
                  onChange={(event) => setRenameValue(event.target.value)}
                  onBlur={cancelRename}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void submitRename()
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      setRenaming(null)
                      setRenameValue('')
                    }
                  }}
                />
              </div>
            ) : (
              <div
                className={`nav-item space-row ${activeSpace === space.name ? 'is-active' : ''} ${
                  dragOver === space.name ? 'is-drop' : ''
                }`}
                key={space.name}
                role="button"
                tabIndex={0}
                aria-current={activeSpace === space.name ? 'true' : undefined}
                onClick={() => onSelectSpace(space.name)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectSpace(space.name)
                  }
                }}
                {...dropProps(space.name)}
                title={`${space.name} (${space.count} note${space.count > 1 ? 's' : ''})`}
              >
                <Folder size={16} />
                <span className="nav-label">{space.name}</span>
                <span className="count">{space.count}</span>
                <span className="space-actions">
                  <button
                    type="button"
                    className="space-action"
                    title="Renommer le dossier"
                    aria-label={`Renommer ${space.name}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      startRename(space.name)
                    }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    className="space-action danger"
                    title="Envoyer le dossier à la corbeille"
                    aria-label={`Supprimer ${space.name}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      void onTrashSpace(space.name)
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              </div>
            )
          )}

          {creating && (
            <div className="space-create">
              <Folder size={16} />
              <input
                autoFocus
                value={newName}
                placeholder="Nom du dossier"
                onChange={(event) => setNewName(event.target.value)}
                onBlur={() => {
                  if (!newName.trim()) setCreating(false)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void submitSpace()
                  }
                  if (event.key === 'Escape') {
                    setNewName('')
                    setCreating(false)
                  }
                }}
              />
            </div>
          )}

          {!spaces.length && !creating && (
            <p className="spaces-empty">Glissez une note ici après avoir créé un dossier.</p>
          )}
        </div>

        <div className="tags-section">
          <div className="section-label">
            <span>Tags</span>
            <span className="count">{tagStats.length || ''}</span>
          </div>
          <div className="tags-nav">
            {tagStats.map((tag) =>
              renamingTag === tag.name ? (
                <div className="space-create tag-rename" key={tag.name}>
                  <Tag size={15} />
                  <input
                    autoFocus
                    value={renameTagValue}
                    disabled={renameTagBusy}
                    spellCheck={false}
                    onChange={(event) => setRenameTagValue(event.target.value)}
                    onBlur={cancelTagRename}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void submitTagRename()
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        setRenamingTag(null)
                        setRenameTagValue('')
                      }
                    }}
                  />
                </div>
              ) : (
                <div
                  key={tag.name}
                  role="button"
                  tabIndex={0}
                  className={`nav-item space-row tag-row ${activeTags.has(tag.name.toLowerCase()) ? 'is-active' : ''}`}
                  title={`Filtrer avec #${tag.name}`}
                  onClick={() => onTagFilter(tag.name)}
                  onDoubleClick={() => startTagRename(tag.name)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onTagFilter(tag.name)
                    }
                  }}
                >
                  <Tag size={15} />
                  <span className="nav-label">{tag.name}</span>
                  <span className="count">{tag.count}</span>
                  <span className="space-actions">
                    <button
                      type="button"
                      className="space-action"
                      title="Renommer le tag dans toutes les notes"
                      aria-label={`Renommer ${tag.name}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        startTagRename(tag.name)
                      }}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      className="space-action danger"
                      title="Supprimer le tag de toutes les notes"
                      aria-label={`Supprimer ${tag.name}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        void onDeleteTag(tag.name)
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                </div>
              )
            )}
            {!tagStats.length && !renamingTag && (
              <p className="tags-empty">Les tags des notes apparaîtront ici.</p>
            )}
          </div>
        </div>

        <button
          type="button"
          className="nav-item trash-entry"
          title="Ouvrir la corbeille"
          onClick={onOpenTrash}
        >
          <Trash2 size={16} />
          <span className="nav-label">Corbeille</span>
          <span className="count">{trashCount || ''}</span>
        </button>

        <button
          type="button"
          className="nav-item trash-entry backup-entry"
          title="Ouvrir les sauvegardes locales"
          onClick={onOpenBackups}
        >
          <Archive size={16} />
          <span className="nav-label">Sauvegardes</span>
        </button>

        <button
          type="button"
          className="nav-item trash-entry backup-entry"
          title="Ouvrir les réglages"
          onClick={onOpenSettings}
        >
          <Settings size={16} />
          <span className="nav-label">Réglages</span>
        </button>

        <div className="sidebar-foot">
          <button type="button" className="link-btn" onClick={onReveal}>
            <FolderOpen size={12} /> Ouvrir le dossier des notes
          </button>
          <span className="vault-path" title={vault.path}>
            {vault.path}
          </span>
        </div>
      </aside>

      {helpOpen && (
        <div
          className="timeline-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Aide Découpe"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="timeline-dialog"
            role="document"
            style={{ maxWidth: 520, width: '92vw', padding: '20px 22px', overflowY: 'auto', maxHeight: '88vh', fontSize: '11.5px', lineHeight: 1.55 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>{helpDocument.title}</h2>
              <button type="button" className="icon-btn" aria-label="Fermer" onClick={() => setHelpOpen(false)}>
                <X size={15} />
              </button>
            </header>
            <div className="help-body">
              {helpDocument.blocks.map((block, index) => {
                if (block.kind === 'heading') {
                  const Heading = block.level === 3 ? 'h3' : 'h2'
                  return (
                    <Heading key={index} className={`help-heading help-heading-${block.level}`}>
                      {renderHelpText(block.text)}
                    </Heading>
                  )
                }
                if (block.kind === 'list') {
                  return (
                    <ul key={index} className="help-list">
                      {block.items.map((item, itemIndex) => (
                        <li key={itemIndex}>{renderHelpText(item)}</li>
                      ))}
                    </ul>
                  )
                }
                if (block.kind === 'rule') return <hr key={index} className="help-rule" />
                return (
                  <p key={index} className="help-paragraph">
                    {renderHelpText(block.text)}
                  </p>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}