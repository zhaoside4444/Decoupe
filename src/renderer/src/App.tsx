import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  BacklinkEntry,
  BackupEntry,
  NoteSummary,
  SelectionInfo,
  Space,
  SplitParts,
  TagSummary,
  TrashItem,
  VaultInfo
} from '@shared/types'
import {
  baseFromPath,
  excerptFromMarkdown,
  mergeNoteMarkdown,
  normalizeTag,
  pinnedFromFrontmatter,
  rewriteWikiLinks,
  removeSearchFilter,
  setPinned,
  spaceOfPath,
  stripFrontmatter,
  tagsFromFrontmatter,
  titleFromMarkdown,
  uniqueTags,
  wikiLink,
  withTags
} from '@shared/text'
import { isNoteSortMode, sortNotes, type NoteSortMode } from '@shared/sort'
import { moveListIndex } from '@shared/nav'
import { DEFAULT_UI_SETTINGS, PASTEL_THEMES, resolveInitialSpace, type UiSettings } from '@shared/settings'
import { loadUiSettings, saveUiSettings, applyUiThemeAndWidth } from './settings'
import { buildPdfDocumentHtml } from '@shared/markdown-html'
import { findRelatedNotes } from '@shared/related'
import type { FullNoteContent } from '@shared/markdown-html'
import type { RelatedNote } from '@shared/related'
import { buildTimelineData } from '@shared/timeline'
import { updateRecentVaults } from '@shared/vaults'
import { detectExternalChange, type ExternalChange } from '@shared/external'
import { Sidebar } from './components/Sidebar'
import { NoteList } from './components/NoteList'
import { NoteEditor, type NoteEditorHandle } from './components/NoteEditor'
import { BacklinksPanel } from './components/BacklinksPanel'
import { Onboarding } from './components/Onboarding'
import { EmptyEditor } from './components/EmptyEditor'
import { QuickCapture } from './components/QuickCapture'
import { BackupDialog } from './components/BackupDialog'
import { ExternalChangeDialog } from './components/ExternalChangeDialog'
import { TrashDialog } from './components/TrashDialog'
import { createRoot } from 'react-dom/client'
import { CommandPalette } from './components/CommandPalette'
import { SettingsDialog } from './components/SettingsDialog'
import { PdfExportDialog } from './components/PdfExportDialog'
import { NarrativeTimeline } from './components/NarrativeTimeline'
import { Toast, type ToastAction, type ToastState } from './components/Toast'
import { errorMessage, formatDateTime } from './util'
import type { SearchFilterKind } from '@shared/text'

function tagFilterValue(token: string): string | null {
  if (token.startsWith('#')) return normalizeTag(token)
  if (/^tag:/i.test(token)) return normalizeTag(token.slice(4))
  return null
}

function replaceTagFilter(query: string, from: string, to: string | null): string {
  const key = normalizeTag(from).toLowerCase()
  if (!key) return query
  const target = to === null ? null : normalizeTag(to)
  const tokens = query.trim().split(/\s+/).filter(Boolean)
  const next: string[] = []
  for (const token of tokens) {
    const value = tagFilterValue(token)
    if (value?.toLowerCase() !== key) {
      next.push(token)
      continue
    }
    if (target) next.push(`${/^tag:/i.test(token) ? 'tag:' : '#'}${target}`)
  }
  return next.join(' ')
}

function linksMayHaveChanged(
  previous: NoteSummary[],
  next: NoteSummary[],
  selectedPath: string | null
): boolean {
  const previousByPath = new Map(previous.map((note) => [note.path, note]))
  const nextPaths = new Set(next.map((note) => note.path))
  if (
    previous.some(
      (note) => note.path !== selectedPath && !nextPaths.has(note.path)
    )
  ) {
    return true
  }
  for (const note of next) {
    if (note.path === selectedPath) continue
    if (previousByPath.get(note.path)?.updatedAt !== note.updatedAt) return true
  }
  return false
}

export default function App() {
  if (window.location.hash.startsWith('#/capture')) return <QuickCapture />
  return <MainApp />
}

function MainApp() {
  const [vault, setVault] = useState<VaultInfo | null>(null)
  const [ready, setReady] = useState(false)
  const [notes, setNotes] = useState<NoteSummary[]>([])
  const [spaces, setSpaces] = useState<Space[]>([])
  const [activeSpace, setActiveSpace] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [selectedContent, setSelectedContent] = useState('')
  const [editorNonce, setEditorNonce] = useState(0)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<NoteSummary[] | null>(null)
  const [sortMode, setSortMode] = useState<NoteSortMode>(() => {
    try {
      const stored = window.localStorage.getItem('decoupe.sort')
      return isNoteSortMode(stored) ? stored : 'modified'
    } catch {
      return 'modified'
    }
  })
  const [trashItems, setTrashItems] = useState<TrashItem[]>([])
  const [trashOpen, setTrashOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [externalChange, setExternalChange] = useState<ExternalChange | null>(null)
  const [backlinks, setBacklinks] = useState<BacklinkEntry[]>([])
  const [backlinksOpen, setBacklinksOpen] = useState(
    () => window.matchMedia('(min-width: 1321px)').matches
  )
  const [backlinksLoading, setBacklinksLoading] = useState(false)
  const [backlinksError, setBacklinksError] = useState<string | null>(null)
  const [backlinksRevision, setBacklinksRevision] = useState(0)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [keyIndex, setKeyIndex] = useState<number | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<UiSettings>(() => loadUiSettings())
  const [pdfExportOpen, setPdfExportOpen] = useState(false)

  const keyIndexRef = useRef<number | null>(null)

  useEffect(() => {
    keyIndexRef.current = keyIndex
  }, [keyIndex])

  useEffect(() => {
    setKeyIndex(null)
  }, [activeSpace, search])

  const searchRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<NoteEditorHandle>(null)
  const selectedPathRef = useRef<string | null>(null)
  const notesRef = useRef<NoteSummary[]>([])
  const diskContentRef = useRef<{ path: string; content: string } | null>(null)
  const externalChangeRef = useRef<ExternalChange | null>(null)
  const changeBusyRef = useRef(false)
  const changePendingRef = useRef(false)

  useEffect(() => {
    selectedPathRef.current = selectedPath
  }, [selectedPath])

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  useEffect(() => {
    externalChangeRef.current = externalChange
  }, [externalChange])

  useEffect(() => {
    setBacklinks([])
    setBacklinksError(null)
  }, [selectedPath])

  useEffect(() => {
    if (!selectedPath) {
      setBacklinksLoading(false)
      return
    }
    let cancelled = false
    setBacklinksLoading(true)
    setBacklinksError(null)
    const timer = window.setTimeout(() => {
      window.api
        .listBacklinks(selectedPath)
        .then((entries) => {
          if (cancelled) return
          setBacklinks(entries)
          setBacklinksLoading(false)
        })
        .catch((error) => {
          if (cancelled) return
          setBacklinksError(errorMessage(error))
          setBacklinksLoading(false)
        })
    }, 100)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [selectedPath, backlinksRevision])

  const showToast = useCallback((message: string, action?: ToastAction) => {
    setToast({ id: Date.now() + Math.random(), message, action })
  }, [])

  const closeToast = useCallback(() => setToast(null), [])

  const raiseExternalChange = useCallback((change: ExternalChange | null): void => {
    externalChangeRef.current = change
    setExternalChange(change)
  }, [])

  const reloadSelected = useCallback(async (paths: string[]): Promise<void> => {
    const selected = selectedPathRef.current
    if (!selected || !paths.length) return
    if (!paths.some((path) => path.toLowerCase() === selected.toLowerCase())) return
    try {
      const content = await window.api.readNote(selected)
      diskContentRef.current = { path: selected, content }
      setSelectedContent(content)
      setEditorNonce((value) => value + 1)
      raiseExternalChange(null)
    } catch {
      // La note a pu être déplacée entre-temps ; le rafraîchissement s'en charge.
    }
  }, [raiseExternalChange])

  const refresh = useCallback(async (preserveOrder = false): Promise<NoteSummary[]> => {
    const [nextNotes, nextSpaces, nextTrash] = await Promise.all([
      window.api.listNotes(),
      window.api.listSpaces(),
      window.api.listTrash()
    ])
    setSpaces(nextSpaces)
    setTrashItems(nextTrash)
    setNotes((previous) => {
      if (!preserveOrder || !previous.length) return nextNotes
      const byPath = new Map(nextNotes.map((note) => [note.path, note]))
      const kept = previous.flatMap((note) => {
        const fresh = byPath.get(note.path)
        return fresh ? [fresh] : []
      })
      const keptPaths = new Set(kept.map((note) => note.path))
      const added = nextNotes.filter((note) => !keptPaths.has(note.path))
      return [...added, ...kept]
    })
    return nextNotes
  }, [])

  const changeSortMode = useCallback((mode: NoteSortMode): void => {
    setSortMode(mode)
    try {
      window.localStorage.setItem('decoupe.sort', mode)
    } catch {
      // Stockage indisponible : le choix tient pour la session.
    }
  }, [])

  useEffect(() => {
    applyUiThemeAndWidth(settings)
  }, [settings])

  const changeSettings = useCallback((next: UiSettings): void => {
    setSettings(next)
    saveUiSettings(next)
    applyUiThemeAndWidth(next)
  }, [])

  const timelineRootRef = useRef<ReturnType<typeof createRoot> | null>(null)
  const timelineContainerRef = useRef<HTMLDivElement | null>(null)

  const openTimeline = async (): Promise<void> => {
    try {
      const contents = new Map<string, string>()
      await Promise.all(
        notes.map(async (note) => {
          try {
            const content = await window.api.readNote(note.path)
            contents.set(note.path, content)
          } catch {
            // Note illisible : ignorée.
          }
        })
      )
      const data = buildTimelineData(notes, contents)

      // Remove existing overlay
      if (timelineContainerRef.current) {
        timelineRootRef.current?.unmount()
        timelineContainerRef.current.remove()
        timelineContainerRef.current = null
        timelineRootRef.current = null
      }

      // Create new overlay
      const container = document.createElement('div')
      container.style.cssText = 'position:fixed;inset:0;z-index:99999;'
      document.body.appendChild(container)
      timelineContainerRef.current = container

      const root = createRoot(container)
      timelineRootRef.current = root

      root.render(
        <NarrativeTimeline
          data={data}
          onOpenNote={(path) => {
            root.unmount()
            container.remove()
            timelineContainerRef.current = null
            timelineRootRef.current = null
            void openNote(path)
          }}
          onClose={() => {
            root.unmount()
            container.remove()
            timelineContainerRef.current = null
            timelineRootRef.current = null
          }}
        />
      )
    } catch (error) {
      showToast('ERREUR: ' + errorMessage(error))
    }
  }

  const handlePdfExport = useCallback(
    async (options: {
      relatedMode: 'none' | 'summary' | 'full'
      selectedRelatedPaths: string[]
      themeMode: 'pastel' | 'monochrome'
      includeMetadata: boolean
    }): Promise<void> => {
      if (!selectedPath) return
      try {
        await editorRef.current?.flush()
        const content = editorRef.current?.getContent() ?? selectedContent
        const summary = notes.find((n) => n.path === selectedPath)
        if (!summary) return

        const pastelTheme = PASTEL_THEMES.find((t) => t.id === settings.theme) ?? PASTEL_THEMES[0]

        let relatedSummaries: RelatedNote[] | undefined
        let relatedFullNotes: FullNoteContent[] | undefined

        if (options.relatedMode !== 'none') {
          const related = findRelatedNotes({
            currentPath: selectedPath,
            currentBase: summary.base,
            currentTags: summary.tags,
            currentLinks: summary.links ?? [],
            notes,
            maxResults: 8
          })
          const filtered = related.filter((r) =>
            options.relatedMode === 'full'
              ? options.selectedRelatedPaths.includes(r.path)
              : true
          )

          if (options.relatedMode === 'summary') {
            relatedSummaries = filtered.slice(0, 6)
          } else {
            relatedFullNotes = []
            for (const r of filtered) {
              try {
                const md = await window.api.readNote(r.path)
                const rSummary = notes.find((n) => n.path === r.path)
                relatedFullNotes.push({
                  path: r.path,
                  title: r.title,
                  space: r.space,
                  createdAt: rSummary?.createdAt ?? '',
                  updatedAt: r.updatedAt,
                  tags: rSummary?.tags ?? [],
                  markdown: md
                })
              } catch {
                // Note illisible : ignorée.
              }
            }
          }
        }

        const html = buildPdfDocumentHtml({
          title: summary.title || summary.base,
          space: summary.space,
          createdAt: summary.createdAt,
          updatedAt: summary.updatedAt,
          tags: summary.tags,
          markdown: content,
          themeMode: options.themeMode,
          themeBg: options.themeMode === 'pastel' ? pastelTheme.bg : undefined,
          themeAccent: options.themeMode === 'pastel' ? pastelTheme.accent : undefined,
          includeMetadata: options.includeMetadata,
          relatedMode: options.relatedMode,
          relatedSummaries,
          relatedFullNotes,
          vaultRoot: vault?.path
        })

        const suggestedName = `${summary.title || summary.base}.pdf`
        const savedPath = await window.api.exportPdf(html, suggestedName)
        if (savedPath) {
          showToast('PDF exporté.', {
            label: 'Ouvrir',
            run: () => {
              void window.api.openPath(savedPath)
            }
          })
        }
      } catch (error) {
        showToast(errorMessage(error))
      }
    },
    [editorRef, notes, selectedPath, selectedContent, settings.theme, vault?.path, showToast]
  )

  const togglePin = useCallback(
    async (path: string): Promise<void> => {
      try {
        if (selectedPathRef.current === path) await editorRef.current?.flush()
        const current = await window.api.readNote(path)
        const pinned = pinnedFromFrontmatter(stripFrontmatter(current).frontmatter)
        const stored = await window.api.writeNote(path, setPinned(current, !pinned))
        if (selectedPathRef.current === path) {
          diskContentRef.current = { path, content: stored }
        }
        await refresh(true)
        await reloadSelected([path])
        showToast(pinned ? 'Note désépinglée.' : 'Note épinglée.')
      } catch (error) {
        showToast(errorMessage(error))
      }
    },
    [refresh, reloadSelected, showToast]
  )

  const syncSearchResults = useCallback(async (query: string): Promise<void> => {
    if (!query.trim()) {
      setSearchResults(null)
      return
    }
    try {
      setSearchResults(await window.api.searchNotes(query))
    } catch {
      setSearchResults([])
    }
  }, [])

  const restoreTagChanges = useCallback(
    async (changes: { path: string; content: string }[]): Promise<void> => {
      const stored = new Map<string, string>()
      for (const change of changes) {
        stored.set(change.path, await window.api.writeNote(change.path, change.content))
      }
      const selected = selectedPathRef.current
      if (selected && stored.has(selected)) {
        diskContentRef.current = { path: selected, content: stored.get(selected)! }
      }
      await refresh(true)
      await reloadSelected(changes.map((change) => change.path))
    },
    [reloadSelected, refresh]
  )

  const renameTag = useCallback(
    async (from: string, to: string): Promise<void> => {
      const source = normalizeTag(from)
      const target = normalizeTag(to)
      if (!source || !target || source === target) return
      try {
        await editorRef.current?.flush()
        const changes = await window.api.renameTag(source, target)
        if (!changes.length) {
          showToast(`Aucune note ne porte #${source}.`)
          return
        }
        const selected = selectedPathRef.current
        if (selected && changes.some((change) => change.path === selected)) {
          const content = await window.api.readNote(selected).catch(() => null)
          if (content !== null) diskContentRef.current = { path: selected, content }
        }
        await refresh(true)
        await reloadSelected(changes.map((change) => change.path))
        const nextSearch = replaceTagFilter(search, source, target)
        setSearch(nextSearch)
        await syncSearchResults(nextSearch)
        showToast(
          `#${source} renommé en #${target} dans ${changes.length} note${
            changes.length > 1 ? 's' : ''
          }.`,
          {
            label: 'Annuler',
            run: async () => {
              try {
                await restoreTagChanges(changes)
                setSearch(search)
                await syncSearchResults(search)
              } catch (error) {
                showToast(errorMessage(error))
              }
            }
          }
        )
      } catch (error) {
        showToast(errorMessage(error))
      }
    },
    [reloadSelected, refresh, restoreTagChanges, search, showToast, syncSearchResults]
  )

  const deleteTag = useCallback(
    async (tag: string): Promise<void> => {
      const source = normalizeTag(tag)
      if (!source) return
      try {
        await editorRef.current?.flush()
        const changes = await window.api.deleteTag(source)
        if (!changes.length) {
          showToast(`Aucune note ne porte #${source}.`)
          return
        }
        const selected = selectedPathRef.current
        if (selected && changes.some((change) => change.path === selected)) {
          const content = await window.api.readNote(selected).catch(() => null)
          if (content !== null) diskContentRef.current = { path: selected, content }
        }
        await refresh(true)
        await reloadSelected(changes.map((change) => change.path))
        const nextSearch = replaceTagFilter(search, source, null)
        setSearch(nextSearch)
        await syncSearchResults(nextSearch)
        showToast(
          `#${source} supprimé de ${changes.length} note${
            changes.length > 1 ? 's' : ''
          }.`,
          {
            label: 'Annuler',
            run: async () => {
              try {
                await restoreTagChanges(changes)
                setSearch(search)
                await syncSearchResults(search)
              } catch (error) {
                showToast(errorMessage(error))
              }
            }
          }
        )
      } catch (error) {
        showToast(errorMessage(error))
      }
    },
    [reloadSelected, refresh, restoreTagChanges, search, showToast, syncSearchResults]
  )

  const openNote = useCallback(
    async (path: string): Promise<void> => {
      if (selectedPathRef.current === path) return
      try {
        const content = await window.api.readNote(path)
        selectedPathRef.current = path
        diskContentRef.current = { path, content }
        setSelectedPath(path)
        setSelectedContent(content)
        raiseExternalChange(null)
      } catch (error) {
        showToast(errorMessage(error))
      }
    },
    [raiseExternalChange, showToast]
  )

  const applyVault = useCallback(
    async (info: VaultInfo): Promise<void> => {
      setVault(info)
      selectedPathRef.current = null
      diskContentRef.current = null
      raiseExternalChange(null)
      setSelectedPath(null)
      setSelectedContent('')
      setSearch('')
      setSearchResults(null)
      setTrashItems([])
      setTrashOpen(false)
      setBackupOpen(false)
      const next = await refresh(false)
      try {
        const recentRaw = window.localStorage.getItem('recentVaults')
        const recent = (recentRaw ? JSON.parse(recentRaw) : []) as string[]
        const updated = updateRecentVaults(recent, info.path)
        window.localStorage.setItem('recentVaults', JSON.stringify(updated))
      } catch {
        // Ignoré
      }
      if (next.length) {
        const spaceNames = next.map((n) => n.space)
        const fallbackSpace = spaceOfPath(next[0].path)
        const initialSpace = resolveInitialSpace(settings.defaultSpace, spaceNames, fallbackSpace)
        setActiveSpace(initialSpace)
        try {
          const content = await window.api.readNote(next[0].path)
          selectedPathRef.current = next[0].path
          diskContentRef.current = { path: next[0].path, content }
          setSelectedPath(next[0].path)
          setSelectedContent(content)
        } catch (error) {
          showToast(errorMessage(error))
        }
      }
    },
    [raiseExternalChange, refresh, showToast, settings.defaultSpace]
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { vault: existing } = await window.api.getConfig()
        if (cancelled) return
        if (existing) {
          setVault(existing)
          const next = await refresh(false)
          if (!cancelled && next.length) {
            const spaceNames = next.map((n) => n.space)
            const fallbackSpace = spaceOfPath(next[0].path)
            const initialSpace = resolveInitialSpace(settings.defaultSpace, spaceNames, fallbackSpace)
            setActiveSpace(initialSpace)
            const content = await window.api.readNote(next[0].path)
            if (!cancelled) {
              selectedPathRef.current = next[0].path
              diskContentRef.current = { path: next[0].path, content }
              setSelectedPath(next[0].path)
              setSelectedContent(content)
            }
          }
        }
      } catch (error) {
        showToast(errorMessage(error))
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh, showToast, settings.defaultSpace])

  const handleVaultChanged = useCallback(async (): Promise<void> => {
    if (changeBusyRef.current) {
      changePendingRef.current = true
      return
    }
    changeBusyRef.current = true
    try {
      do {
        changePendingRef.current = false
        const previous = notesRef.current
        const next = await refresh(true)
        if (linksMayHaveChanged(previous, next, selectedPathRef.current)) {
          setBacklinksRevision((value) => value + 1)
        }
        if (externalChangeRef.current) continue
        const path = selectedPathRef.current
        const baseline = diskContentRef.current
        if (!path || !baseline || baseline.path !== path) continue
        let diskContent: string | null = null
        try {
          diskContent = await window.api.readNote(path)
        } catch {
          diskContent = null
        }
        const change = detectExternalChange(path, next, baseline.content, diskContent)
        if (change) raiseExternalChange(change)
      } while (changePendingRef.current)
    } catch (error) {
      showToast(errorMessage(error))
    } finally {
      changeBusyRef.current = false
    }
  }, [raiseExternalChange, refresh, showToast])

  useEffect(() => {
    if (!vault) return
    return window.api.onVaultChanged(() => {
      void handleVaultChanged()
    })
  }, [handleVaultChanged, vault])

  useEffect(() => {
    const query = search.trim()
    if (!query) {
      setSearchResults(null)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      window.api
        .searchNotes(query)
        .then((results) => {
          if (!cancelled) setSearchResults(results)
        })
        .catch(() => {
          if (!cancelled) setSearchResults([])
        })
    }, 160)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [search])

  const saveCurrent = useCallback(
    async (path: string, content: string): Promise<void> => {
      try {
        const baseline = diskContentRef.current
        const stored = await window.api.writeNote(
          path,
          content,
          baseline?.path === path ? baseline.content : undefined
        )
        if (selectedPathRef.current === path) {
          diskContentRef.current = { path, content: stored }
        }
        const update = (note: NoteSummary): NoteSummary =>
          note.path === path
            ? {
                ...note,
                title: titleFromMarkdown(content) || note.base,
                excerpt: excerptFromMarkdown(content),
                updatedAt: Date.now(),
                tags: tagsFromFrontmatter(content)
              }
            : note
        setNotes((previous) => previous.map(update))
        setSearchResults((previous) => (previous ? previous.map(update) : previous))
      } catch (error) {
        throw error
      }
    },
    []
  )

  const newNote = useCallback(async (): Promise<void> => {
    if (!vault) return
    const target = activeSpace === '*' ? '' : activeSpace
    try {
      await editorRef.current?.flush()
      const created = await window.api.createNote(target, '')
      const stored = await window.api.readNote(created.path).catch(() => '')
      await refresh(true)
      setActiveSpace(target)
      setSearch('')
      setSearchResults(null)
      selectedPathRef.current = created.path
      diskContentRef.current = { path: created.path, content: stored }
      raiseExternalChange(null)
      setSelectedPath(created.path)
      setSelectedContent(stored)
      setEditorNonce((value) => value + 1)
    } catch (error) {
      showToast(errorMessage(error))
    }
  }, [activeSpace, raiseExternalChange, refresh, showToast, vault])

  const createLinkedNote = useCallback(
    async (rawTitle: string): Promise<string | null> => {
      const currentPath = selectedPathRef.current
      const title = rawTitle.replace(/\s+/g, ' ').trim()
      if (!currentPath || !title) return null
      try {
        const created = await window.api.createNote(
          spaceOfPath(currentPath),
          `# ${title}\n\n`
        )
        await refresh(true)
        showToast(`Note « ${created.title} » créée`, {
          label: 'Ouvrir',
          run: () => openNote(created.path)
        })
        return wikiLink(created.base, created.title)
      } catch (error) {
        showToast(errorMessage(error))
        return null
      }
    },
    [openNote, refresh, showToast]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key.toLowerCase() === 'k') {
          event.preventDefault()
          event.stopPropagation()
          setPaletteOpen((value) => !value)
        } else if (event.shiftKey && event.key.toLowerCase() === 't') {
          event.preventDefault()
          event.stopPropagation()
          void openTimeline()
        } else if (event.key.toLowerCase() === 'p') {
          event.preventDefault()
          event.stopPropagation()
          if (selectedPath) setPdfExportOpen(true)
        } else if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          void newNote()
        } else if (event.key === ',') {
          event.preventDefault()
          setSettingsOpen(true)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [newNote, openTimeline])

  const extractSelection = useCallback(
    async (selection: SelectionInfo): Promise<string | null> => {
      const path = selectedPathRef.current
      if (!path) return null
      try {
        const tags = notesRef.current.find((note) => note.path === path)?.tags ?? []
        const created = await window.api.createNote(
          spaceOfPath(path),
          withTags(selection.text, tags)
        )
        await refresh(true)
        showToast(`Passage extrait vers « ${created.title} »`)
        return wikiLink(created.base, created.title)
      } catch (error) {
        showToast(errorMessage(error))
        return null
      }
    },
    [refresh, showToast]
  )

  const splitNote = useCallback(
    async (parts: SplitParts): Promise<string | null> => {
      const path = selectedPathRef.current
      if (!path) return null
      try {
        const tags = notesRef.current.find((note) => note.path === path)?.tags ?? []
        const created = await window.api.createNote(
          spaceOfPath(path),
          withTags(parts.after, tags)
        )
        await refresh(true)
        showToast(`Fin de note déplacée vers « ${created.title} »`)
        return wikiLink(created.base, created.title)
      } catch (error) {
        showToast(errorMessage(error))
        return null
      }
    },
    [refresh, showToast]
  )

  const trashCurrent = useCallback(async (): Promise<void> => {
    const path = selectedPathRef.current
    if (!path) return
    try {
      await editorRef.current?.flush()
      const base =
        notesRef.current.find((note) => note.path === path)?.base ?? baseFromPath(path)
      const { trashPath } = await window.api.trashNote(path)
      const cleanups = await window.api.cleanLinks([base], null)
      const remaining = await refresh(false)
      const next = remaining[0]
      let content = ''
      let nextBaseline: string | null = null
      if (next) {
        try {
          content = await window.api.readNote(next.path)
          nextBaseline = content
        } catch {
          content = ''
        }
      }
      selectedPathRef.current = next?.path ?? null
      diskContentRef.current =
        next && nextBaseline !== null ? { path: next.path, content: nextBaseline } : null
      raiseExternalChange(null)
      setSelectedPath(next?.path ?? null)
      setSelectedContent(content)
      setEditorNonce((value) => value + 1)
      showToast(
        cleanups.length ? 'Note mise à la corbeille · liens nettoyés' : 'Note mise à la corbeille',
        {
          label: 'Annuler',
          run: async () => {
            try {
              await window.api.restoreNote(trashPath, path)
              for (const change of cleanups) {
                await window.api.writeNote(change.path, change.content)
              }
              await refresh(false)
              const restored = await window.api.readNote(path)
              selectedPathRef.current = path
              diskContentRef.current = { path, content: restored }
              raiseExternalChange(null)
              setSelectedPath(path)
              setSelectedContent(restored)
              setEditorNonce((value) => value + 1)
            } catch (error) {
              showToast(errorMessage(error))
            }
          }
        }
      )
    } catch (error) {
      showToast(errorMessage(error))
    }
  }, [raiseExternalChange, refresh, showToast])

  const openTrash = useCallback((): void => {
    setTrashOpen(true)
    void refresh(true).catch((error) => showToast(errorMessage(error)))
  }, [refresh, showToast])

  const restoreTrashItem = useCallback(
    async (item: TrashItem): Promise<void> => {
      try {
        const result = await window.api.restoreTrash(item.path)
        await refresh(true)
        const renamed =
          result.path && item.originalPath && result.path !== item.originalPath
            ? ` sous « ${result.path} »`
            : ''
        showToast(`Restauration de « ${item.title} »${renamed} terminée.`)
      } catch (error) {
        showToast(errorMessage(error))
      }
    },
    [refresh, showToast]
  )

  const deleteTrashItem = useCallback(
    async (item: TrashItem): Promise<void> => {
      try {
        await window.api.deleteTrash(item.path)
        await refresh(true)
        showToast(`Suppression définitive de « ${item.title} » terminée.`)
      } catch (error) {
        showToast(errorMessage(error))
      }
    },
    [refresh, showToast]
  )

  const restoreBackup = useCallback(
    async (entry: BackupEntry): Promise<void> => {
      try {
        await editorRef.current?.flush()
        await window.api.restoreBackup(entry.id)
        const next = await refresh(false)
        const selected = selectedPathRef.current
        const target =
          selected && next.some((note) => note.path === selected)
            ? selected
            : (next[0]?.path ?? null)
        if (target) {
          const content = await window.api.readNote(target)
          selectedPathRef.current = target
          diskContentRef.current = { path: target, content }
          raiseExternalChange(null)
          setSelectedPath(target)
          setSelectedContent(content)
          setEditorNonce((value) => value + 1)
          if (activeSpace !== '*') setActiveSpace(spaceOfPath(target))
        } else {
          selectedPathRef.current = null
          diskContentRef.current = null
          raiseExternalChange(null)
          setSelectedPath(null)
          setSelectedContent('')
          setEditorNonce((value) => value + 1)
          setActiveSpace('')
        }
        setSearch('')
        setSearchResults(null)
        showToast(`Sauvegarde du ${formatDateTime(entry.createdAt)} restaurée.`)
        setBackupOpen(false)
      } catch (error) {
        showToast(errorMessage(error))
        throw error
      }
    },
    [activeSpace, raiseExternalChange, refresh, showToast]
  )

  const reloadExternalChange = useCallback(async (): Promise<void> => {
    const change = externalChangeRef.current
    if (!change) return
    try {
      const content = await window.api.readNote(change.path)
      diskContentRef.current = { path: change.path, content }
      setSelectedContent(content)
      setEditorNonce((value) => value + 1)
      raiseExternalChange(null)
      await refresh(true)
      showToast('Note rechargée depuis le disque.')
    } catch (error) {
      showToast(errorMessage(error))
    }
  }, [raiseExternalChange, refresh, showToast])

  const keepExternalVersion = useCallback(async (): Promise<void> => {
    const change = externalChangeRef.current
    const content = editorRef.current?.getContent()
    if (!change || content === undefined) return
    try {
      if (change.kind !== 'modified') {
        const existing = await window.api.readNote(change.path).catch(() => null)
        if (existing !== null) {
          raiseExternalChange({ kind: 'modified', path: change.path })
          showToast('La note existe de nouveau à cet emplacement.')
          return
        }
      }
      const stored = await window.api.writeNote(change.path, content)
      diskContentRef.current = { path: change.path, content: stored }
      setSelectedContent(stored)
      editorRef.current?.markSaved(content)
      raiseExternalChange(null)
      await refresh(true)
      showToast(
        change.kind === 'deleted'
          ? 'Note recréée avec le contenu de l’éditeur.'
          : 'Version locale conservée.'
      )
    } catch (error) {
      showToast(errorMessage(error))
    }
  }, [raiseExternalChange, refresh, showToast])

  const openMovedNote = useCallback(async (): Promise<void> => {
    const change = externalChangeRef.current
    if (!change?.movedTo) return
    try {
      const content = await window.api.readNote(change.movedTo)
      selectedPathRef.current = change.movedTo
      diskContentRef.current = { path: change.movedTo, content }
      setSelectedPath(change.movedTo)
      setSelectedContent(content)
      setEditorNonce((value) => value + 1)
      if (activeSpace !== '*') setActiveSpace(spaceOfPath(change.movedTo))
      raiseExternalChange(null)
      await refresh(true)
      showToast('Note déplacée ouverte.')
    } catch (error) {
      showToast(errorMessage(error))
    }
  }, [activeSpace, raiseExternalChange, refresh, showToast])

  const closeDeletedNote = useCallback(async (): Promise<void> => {
    selectedPathRef.current = null
    diskContentRef.current = null
    raiseExternalChange(null)
    setSelectedPath(null)
    setSelectedContent('')
    setEditorNonce((value) => value + 1)
    try {
      await refresh(true)
    } catch (error) {
      showToast(errorMessage(error))
    }
  }, [raiseExternalChange, refresh, showToast])

  const mergeNotes = useCallback(
    async (sourcePath: string, targetPath: string): Promise<void> => {
      if (sourcePath === targetPath) return
      try {
        await editorRef.current?.flush()
        const [source, target] = await Promise.all([
          window.api.readNote(sourcePath),
          window.api.readNote(targetPath)
        ])
        const sourceBase = baseFromPath(sourcePath)
        const targetBase = baseFromPath(targetPath)
        const targetTitle = titleFromMarkdown(target) || targetBase
        const merged = rewriteWikiLinks(
          mergeNoteMarkdown(target, source),
          sourceBase,
          targetBase,
          targetTitle
        )
        const storedMerged = await window.api.writeNote(targetPath, merged)
        const { trashPath } = await window.api.trashNote(sourcePath)
        const cleanups = await window.api.cleanLinks([sourceBase], targetBase, targetTitle)
        const cleanupPaths = cleanups.map((change) => change.path)
        const sourceTitle =
          notesRef.current.find((note) => note.path === sourcePath)?.title ?? sourcePath
        const selected = selectedPathRef.current
        const lookupPath = selected === sourcePath ? targetPath : selected
        const selectedChanged =
          lookupPath === targetPath ||
          cleanups.some((change) => change.path === lookupPath)
        const selectedDisk =
          lookupPath && selectedChanged
            ? await window.api.readNote(lookupPath).catch(() => null)
            : null
        if (lookupPath && selectedDisk !== null) {
          diskContentRef.current = { path: lookupPath, content: selectedDisk }
        }
        if (selected === sourcePath || selected === targetPath) {
          selectedPathRef.current = targetPath
          diskContentRef.current = {
            path: targetPath,
            content: selectedDisk ?? storedMerged
          }
        }
        await refresh(true)
        if (selected === sourcePath) {
          setSelectedPath(targetPath)
          setSelectedContent(selectedDisk ?? storedMerged)
          setEditorNonce((value) => value + 1)
        } else if (selected === targetPath) {
          setSelectedContent(selectedDisk ?? storedMerged)
          setEditorNonce((value) => value + 1)
        } else {
          await reloadSelected(cleanupPaths)
        }
        showToast(`« ${sourceTitle} » fusionnée`, {
          label: 'Annuler',
          run: async () => {
            try {
              await window.api.writeNote(targetPath, target)
              await window.api.restoreNote(trashPath, sourcePath)
              for (const change of cleanups) {
                if (change.path.toLowerCase() === targetPath.toLowerCase()) continue
                await window.api.writeNote(change.path, change.content)
              }
              await refresh(true)
              if (selectedPathRef.current === targetPath) {
                diskContentRef.current = { path: targetPath, content: target }
                setSelectedContent(target)
                setEditorNonce((value) => value + 1)
              } else {
                await reloadSelected(cleanupPaths)
              }
            } catch (error) {
              showToast(errorMessage(error))
            }
          }
        })
      } catch (error) {
        showToast(errorMessage(error))
      }
    },
    [refresh, reloadSelected, showToast]
  )

  const moveNote = useCallback(
    async (sourcePath: string, space: string): Promise<void> => {
      try {
        await editorRef.current?.flush()
        const result = await window.api.moveNote(sourcePath, space)
        if (selectedPathRef.current === sourcePath) {
          const content = await window.api.readNote(result.path)
          selectedPathRef.current = result.path
          diskContentRef.current = { path: result.path, content }
          setSelectedPath(result.path)
          setSelectedContent(content)
          setEditorNonce((value) => value + 1)
        }
        await refresh(true)
        showToast(`Déplacée vers « ${space || 'Boîte d’entrée'} »`)
      } catch (error) {
        showToast(errorMessage(error))
      }
    },
    [refresh, showToast]
  )

  const batchMove = useCallback(
    async (paths: string[], space: string): Promise<boolean> => {
      const targets = notesRef.current.filter((note) => paths.includes(note.path))
      if (!targets.length) return false
      try {
        await editorRef.current?.flush()
        const moves: { from: string; to: string }[] = []
        for (const note of targets) {
          const result = await window.api.moveNote(note.path, space)
          moves.push({ from: note.path, to: result.path })
        }
        await refresh(true)
        const selected = selectedPathRef.current
        const moved = moves.find((item) => item.from === selected)
        if (moved) {
          const content = await window.api.readNote(moved.to)
          selectedPathRef.current = moved.to
          diskContentRef.current = { path: moved.to, content }
          setSelectedPath(moved.to)
          setSelectedContent(content)
          setEditorNonce((value) => value + 1)
        }
        showToast(
          `${moves.length} note${moves.length > 1 ? 's' : ''} déplacée${
            moves.length > 1 ? 's' : ''
          } vers « ${space || 'Boîte d’entrée'} »`,
          {
            label: 'Annuler',
            run: async () => {
              try {
                for (const item of [...moves].reverse()) {
                  await window.api.moveNote(item.to, spaceOfPath(item.from))
                }
                await refresh(true)
                if (selected && moves.some((item) => item.from === selected)) {
                  const content = await window.api.readNote(selected)
                  selectedPathRef.current = selected
                  diskContentRef.current = { path: selected, content }
                  setSelectedPath(selected)
                  setSelectedContent(content)
                  setEditorNonce((value) => value + 1)
                }
              } catch (error) {
                showToast(errorMessage(error))
              }
            }
          }
        )
        return true
      } catch (error) {
        showToast(errorMessage(error))
        return false
      }
    },
    [refresh, showToast]
  )

  const batchTag = useCallback(
    async (paths: string[], rawTags: string): Promise<boolean> => {
      const additions = rawTags
        .split(/[,\n]/)
        .map((tag) => normalizeTag(tag))
        .filter(Boolean)
      if (!additions.length) return false
      const targets = notesRef.current.filter((note) => paths.includes(note.path))
      if (!targets.length) return false
      try {
        await editorRef.current?.flush()
        const changes: { path: string; content: string }[] = []
        for (const note of targets) {
          const content = await window.api.readNote(note.path)
          const next = withTags(
            content,
            uniqueTags([...tagsFromFrontmatter(content), ...additions])
          )
          const stored = await window.api.writeNote(note.path, next)
          changes.push({ path: note.path, content })
          if (selectedPathRef.current === note.path) {
            diskContentRef.current = { path: note.path, content: stored }
          }
        }
        await refresh(true)
        await reloadSelected(changes.map((change) => change.path))
        showToast(
          `#${additions.join(' #')} ajouté à ${changes.length} note${
            changes.length > 1 ? 's' : ''
          }.`,
          {
            label: 'Annuler',
            run: async () => {
              try {
                await restoreTagChanges(changes)
              } catch (error) {
                showToast(errorMessage(error))
              }
            }
          }
        )
        return true
      } catch (error) {
        showToast(errorMessage(error))
        return false
      }
    },
    [refresh, reloadSelected, restoreTagChanges, showToast]
  )

  const batchTrash = useCallback(
    async (paths: string[]): Promise<boolean> => {
      const targets = notesRef.current.filter((note) => paths.includes(note.path))
      if (!targets.length) return false
      try {
        await editorRef.current?.flush()
        const selected = selectedPathRef.current
        const trashed: { path: string; trashPath: string }[] = []
        for (const note of targets) {
          const { trashPath } = await window.api.trashNote(note.path)
          trashed.push({ path: note.path, trashPath })
        }
        const bases = targets.map((note) => note.base)
        const cleanups = bases.length ? await window.api.cleanLinks(bases, null) : []
        const remaining = await refresh(false)
        const next = remaining[0]
        let content = ''
        let nextBaseline: string | null = null
        if (next) {
          try {
            content = await window.api.readNote(next.path)
            nextBaseline = content
          } catch {
            content = ''
          }
        }
        if (!selected || targets.some((note) => note.path === selected)) {
          selectedPathRef.current = next?.path ?? null
          diskContentRef.current =
            next && nextBaseline !== null ? { path: next.path, content: nextBaseline } : null
          raiseExternalChange(null)
          setSelectedPath(next?.path ?? null)
          setSelectedContent(content)
          setEditorNonce((value) => value + 1)
        } else {
          await reloadSelected(cleanups.map((change) => change.path))
        }
        showToast(
          `${trashed.length} note${trashed.length > 1 ? 's' : ''} mise${
            trashed.length > 1 ? 's' : ''
          } à la corbeille`,
          {
            label: 'Annuler',
            run: async () => {
              try {
                for (const item of [...trashed].reverse()) {
                  await window.api.restoreNote(item.trashPath, item.path)
                }
                for (const change of cleanups) {
                  await window.api.writeNote(change.path, change.content)
                }
                await refresh(true)
                if (
                  selected &&
                  targets.some((note) => note.path === selected)
                ) {
                  const restored = await window.api.readNote(selected)
                  selectedPathRef.current = selected
                  diskContentRef.current = { path: selected, content: restored }
                  raiseExternalChange(null)
                  setSelectedPath(selected)
                  setSelectedContent(restored)
                  setEditorNonce((value) => value + 1)
                } else {
                  await reloadSelected(cleanups.map((change) => change.path))
                }
              } catch (error) {
                showToast(errorMessage(error))
              }
            }
          }
        )
        return true
      } catch (error) {
        showToast(errorMessage(error))
        return false
      }
    },
    [raiseExternalChange, refresh, reloadSelected, showToast]
  )

  const createSpace = useCallback(
    async (name: string): Promise<void> => {
      await window.api.createSpace(name)
      await refresh(true)
      setActiveSpace(name)
    },
    [refresh]
  )

  const renameSpace = useCallback(
    async (from: string, to: string): Promise<void> => {
      try {
        await editorRef.current?.flush()
        await window.api.renameSpace(from, to)
        if (activeSpace === from) setActiveSpace(to)
        const selected = selectedPathRef.current
        if (selected && spaceOfPath(selected) === from) {
          const nextPath = `Notes/${to}/${selected.split('/').slice(2).join('/')}`
          const content = await window.api.readNote(nextPath)
          selectedPathRef.current = nextPath
          diskContentRef.current = { path: nextPath, content }
          setSelectedPath(nextPath)
          setSelectedContent(content)
        }
        await refresh(true)
        showToast(`Dossier renommé en « ${to} »`)
      } catch (error) {
        showToast(errorMessage(error))
        throw error
      }
    },
    [activeSpace, refresh, showToast]
  )

  const deleteSpace = useCallback(
    async (name: string): Promise<void> => {
      try {
        await editorRef.current?.flush()
        const bases = notesRef.current
          .filter((note) => note.space === name)
          .map((note) => note.base)
        const { trashPath } = await window.api.trashSpace(name)
        const cleanups = bases.length
          ? await window.api.cleanLinks(bases, null)
          : []
        const cleanupPaths = cleanups.map((change) => change.path)
        if (activeSpace === name) setActiveSpace('')
        const selected = selectedPathRef.current
        if (selected && spaceOfPath(selected) === name) {
          selectedPathRef.current = null
          diskContentRef.current = null
          raiseExternalChange(null)
          setSelectedPath(null)
          setSelectedContent('')
          setEditorNonce((value) => value + 1)
        } else if (selected && cleanups.some((change) => change.path === selected)) {
          const content = await window.api.readNote(selected).catch(() => null)
          if (content !== null) diskContentRef.current = { path: selected, content }
        }
        await refresh(false)
        await reloadSelected(cleanupPaths)
        showToast(
          cleanups.length
            ? `Dossier « ${name} » mis à la corbeille · liens nettoyés`
            : `Dossier « ${name} » mis à la corbeille`,
          {
            label: 'Annuler',
            run: async () => {
              try {
                await window.api.restoreSpace(trashPath, name)
                for (const change of cleanups) {
                  await window.api.writeNote(change.path, change.content)
                }
                await refresh(false)
                setActiveSpace(name)
                await reloadSelected(cleanupPaths)
              } catch (error) {
                showToast(errorMessage(error))
              }
            }
          }
        )
      } catch (error) {
        showToast(errorMessage(error))
      }
    },
    [activeSpace, raiseExternalChange, refresh, reloadSelected, showToast]
  )

  const switchVault = useCallback(
    async (root?: string): Promise<void> => {
      try {
        const info = await window.api.openVault(root)
        if (info) await applyVault(info)
      } catch (error) {
        showToast(errorMessage(error))
      }
    },
    [applyVault, showToast]
  )

  const revealVault = useCallback(async (): Promise<void> => {
    try {
      await window.api.revealVault()
    } catch (error) {
      showToast(errorMessage(error))
    }
  }, [showToast])

  const openLink = useCallback(
    (target: string): void => {
      const found = notesRef.current.find(
        (note) => note.base.toLowerCase() === target.toLowerCase()
      )
      if (found) {
        void openNote(found.path)
      } else {
        showToast(`Note « ${target} » introuvable`)
      }
    },
    [openNote, showToast]
  )

  const openBacklink = useCallback(
    (path: string): void => {
      void openNote(path)
      if (!window.matchMedia('(min-width: 1321px)').matches) setBacklinksOpen(false)
    },
    [openNote]
  )

  const closeBacklinks = useCallback(() => setBacklinksOpen(false), [])

  const visibleNotes = useMemo(() => {
    const base =
      searchResults !== null
        ? searchResults
        : activeSpace === '*'
          ? notes
          : notes.filter((note) => note.space === activeSpace)
    return sortNotes(base, sortMode)
  }, [notes, activeSpace, searchResults, sortMode])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (paletteOpen || trashOpen || backupOpen || externalChange || settingsOpen) return
      const key = event.key
      if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Enter') return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target?.closest(
          'input, textarea, select, button, a, [role="button"], [role="checkbox"], [contenteditable=""], [contenteditable="true"], .ProseMirror, .calendar-popover, .palette-backdrop'
        )
      ) {
        return
      }
      if (key === 'Enter') {
        const index = keyIndexRef.current
        const note = index === null ? undefined : visibleNotes[index]
        if (!note) return
        event.preventDefault()
        setKeyIndex(null)
        void openNote(note.path)
        return
      }
      if (!visibleNotes.length) {
        setKeyIndex(null)
        return
      }
      event.preventDefault()
      setKeyIndex((current) =>
        moveListIndex(current, key === 'ArrowDown' ? 'next' : 'prev', visibleNotes.length)
      )
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [
    backupOpen,
    externalChange,
    openNote,
    paletteOpen,
    settingsOpen,
    trashOpen,
    visibleNotes
  ])

  const tagStats = useMemo(() => {
    const counts = new Map<string, TagSummary>()
    for (const note of notes) {
      const seen = new Set<string>()
      for (const tag of note.tags) {
        const key = tag.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        const current = counts.get(key)
        if (current) current.count += 1
        else counts.set(key, { name: tag, count: 1 })
      }
    }
    return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [notes])

  const allTags = useMemo(() => tagStats.map((tag) => tag.name), [tagStats])

  const dateCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const note of notes) {
      counts.set(note.createdAt, (counts.get(note.createdAt) ?? 0) + 1)
    }
    return counts
  }, [notes])

  const setDateFilter = useCallback((date: string | null): void => {
    setSearch((previous) => {
      const tokens = previous
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .filter((token) => !/^date:/i.test(token))
      if (date) tokens.push(`date:${date}`)
      return tokens.join(' ')
    })
  }, [])

  const toggleTagFilter = useCallback((raw: string): void => {
    const tag = normalizeTag(raw)
    if (!tag) return
    const key = tag.toLowerCase()
    setSearch((previous) => {
      const tokens = previous.trim().split(/\s+/).filter(Boolean)
      const active = tokens.some(
        (token) => tagFilterValue(token)?.toLowerCase() === key
      )
      if (active) {
        return tokens
          .filter((token) => tagFilterValue(token)?.toLowerCase() !== key)
          .join(' ')
      }
      const trimmed = previous.trim()
      return `${trimmed}${trimmed ? ' ' : ''}#${tag}`
    })
    searchRef.current?.focus()
  }, [])

  const searchActive = search.trim().length > 0
  const listTitle = searchActive
    ? 'Recherche'
    : activeSpace === '*'
      ? 'Toutes les notes'
      : activeSpace || 'Boîte d’entrée'

  const selectedSummary = selectedPath
    ? notes.find((note) => note.path === selectedPath)
    : undefined
  const editorTitle =
    selectedSummary?.title || titleFromMarkdown(selectedContent) || 'Note sans titre'
  const editorSpace = selectedPath ? spaceOfPath(selectedPath) : ''
  const editorBase = selectedPath ? baseFromPath(selectedPath) : ''
  const inboxCount = notes.filter((note) => !note.space).length

  if (!ready) {
    return (
      <div className="boot">
        <span className="boot-mark" />
      </div>
    )
  }

  if (!vault) {
    return (
      <>
        <Onboarding onReady={applyVault} onError={showToast} />
{settingsOpen ? (
        <SettingsDialog
          settings={settings}
          spaces={spaces}
          onUpdateSettings={changeSettings}
          onClose={() => setSettingsOpen(false)}
          onNotice={showToast}
          onError={showToast}
        />
      ) : null}

      {toast && <Toast toast={toast} onClose={closeToast} />}
      </>
    )
  }

  return (
    <div className="app">
      <Sidebar
        vault={vault}
        spaces={spaces}
        notesInInbox={inboxCount}
        totalNotes={notes.length}
        activeSpace={activeSpace}
        onSelectSpace={(space) => {
          setActiveSpace(space)
          setSearch('')
          setSearchResults(null)
        }}
        onCreateSpace={createSpace}
        onRenameSpace={renameSpace}
        onTrashSpace={deleteSpace}
        onMoveNote={(path, space) => void moveNote(path, space)}
        onSwitchVault={(root) => void switchVault(root)}
        onReveal={() => void revealVault()}
        search={search}
        onSearch={setSearch}
        searchRef={searchRef}
        trashCount={trashItems.length}
        onOpenTrash={openTrash}
        onOpenBackups={() => setBackupOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenTimeline={openTimeline}
        tagStats={tagStats}
        dateCounts={dateCounts}
        onTagFilter={toggleTagFilter}
        onDateFilter={setDateFilter}
        onRenameTag={renameTag}
        onDeleteTag={deleteTag}
      />

      <NoteList
        title={listTitle}
        count={visibleNotes.length}
        notes={visibleNotes}
        selectedPath={selectedPath}
        onSelect={(path) => {
          setKeyIndex(null)
          void openNote(path)
        }}
        keyNavIndex={keyIndex}
        sortMode={sortMode}
        onSortChange={changeSortMode}
        onTogglePin={(path) => void togglePin(path)}
        spaces={spaces}
        onBatchMove={(paths, space) => batchMove(paths, space)}
        onBatchTag={(paths, tags) => batchTag(paths, tags)}
        onBatchTrash={(paths) => batchTrash(paths)}
        onNew={() => void newNote()}
        onMerge={(source, target) => void mergeNotes(source, target)}
        search={search}
        onClearSearch={() => setSearch('')}
        onRemoveFilter={(kind: SearchFilterKind, value?: string) =>
          setSearch((previous) => removeSearchFilter(previous, kind, value))
        }
        onTagClick={toggleTagFilter}
      />

      {selectedPath ? (
        <div className="editor-area">
          <NoteEditor
            key={`${selectedPath}:${editorNonce}`}
            ref={editorRef}
            path={selectedPath}
            spaceName={editorSpace}
            title={editorTitle}
            initialContent={selectedContent}
            onSave={(content) => saveCurrent(selectedPath, content)}
            onExtract={extractSelection}
            onSplit={splitNote}
            onTrash={() => void trashCurrent()}
            onOpenLink={openLink}
            onCreateLink={createLinkedNote}
            onError={showToast}
            notes={notes}
            tagSuggestions={allTags}
            onTagFilter={toggleTagFilter}
            externalChange={externalChange?.path === selectedPath}
            backlinksOpen={backlinksOpen}
            backlinkCount={backlinks.length}
            onToggleBacklinks={() => setBacklinksOpen((value) => !value)}
            onExportPdf={() => setPdfExportOpen(true)}
            onOpenTimeline={openTimeline}
            showRelatedNotes={settings.showRelatedNotes}
            onOpenNote={(path) => void openNote(path)}
          />
          {backlinksOpen ? (
            <>
              <button
                type="button"
                className="backlinks-scrim"
                aria-label="Fermer les liens entrants"
                onClick={closeBacklinks}
              />
              <BacklinksPanel
                noteTitle={editorTitle}
                noteBase={editorBase}
                entries={backlinks}
                loading={backlinksLoading}
                error={backlinksError}
                onOpen={openBacklink}
                onRefresh={() => setBacklinksRevision((value) => value + 1)}
                onClose={closeBacklinks}
              />
            </>
          ) : null}
        </div>
      ) : (
        <EmptyEditor onNew={() => void newNote()} />
      )}

      {trashOpen ? (
        <TrashDialog
          items={trashItems}
          onClose={() => setTrashOpen(false)}
          onRestore={restoreTrashItem}
          onDelete={deleteTrashItem}
        />
      ) : null}

      {backupOpen ? (
        <BackupDialog
          onClose={() => setBackupOpen(false)}
          onRestore={restoreBackup}
          onNotice={showToast}
          onError={showToast}
        />
      ) : null}

      {externalChange ? (
        <ExternalChangeDialog
          change={externalChange}
          onReload={reloadExternalChange}
          onKeepLocal={keepExternalVersion}
          onOpenMoved={openMovedNote}
          onCloseNote={closeDeletedNote}
        />
      ) : null}

      {paletteOpen ? (
        <CommandPalette
          notes={notes}
          spaces={spaces}
          tagStats={tagStats}
          selectedPath={selectedPath}
          selectedPinned={selectedSummary?.pinned}
          onClose={() => setPaletteOpen(false)}
          onNewNote={() => void newNote()}
          onOpenNote={(path) => void openNote(path)}
          onSelectSpace={(space) => {
            setActiveSpace(space)
            setSearch('')
            setSearchResults(null)
          }}
          onTagFilter={toggleTagFilter}
          onTogglePinCurrent={() => {
            if (selectedPath) void togglePin(selectedPath)
          }}
          onTrashCurrent={() => void trashCurrent()}
          onMoveCurrent={(space) => {
            if (selectedPath) void moveNote(selectedPath, space)
          }}
          onOpenTrash={openTrash}
          onOpenBackups={() => setBackupOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenTimeline={openTimeline}
          onExportPdf={() => setPdfExportOpen(true)}
          onSortChange={changeSortMode}
          showRelatedNotes={settings.showRelatedNotes}
          onToggleRelatedNotes={() =>
            changeSettings({ ...settings, showRelatedNotes: !settings.showRelatedNotes })
          }
        />
      ) : null}

      {settingsOpen ? (
        <SettingsDialog
          settings={settings}
          spaces={spaces}
          onUpdateSettings={changeSettings}
          onClose={() => setSettingsOpen(false)}
          onNotice={showToast}
          onError={showToast}
        />
      ) : null}

      {pdfExportOpen && selectedPath ? (
        <PdfExportDialog
          title={selectedSummary?.title || selectedPath}
          space={selectedSummary?.space || ''}
          createdAt={selectedSummary?.createdAt || ''}
          updatedAt={selectedSummary?.updatedAt || Date.now()}
          tags={selectedSummary?.tags || []}
          notes={notes}
          currentPath={selectedPath}
          currentBase={selectedSummary?.base || baseFromPath(selectedPath)}
          currentLinks={selectedSummary?.links || []}
          uiSettings={settings}
          onClose={() => setPdfExportOpen(false)}
          onExport={async (options) => {
            await handlePdfExport(options)
            setPdfExportOpen(false)
          }}
        />
      ) : null}

      {toast && <Toast toast={toast} onClose={closeToast} />}
    </div>
  )
}
