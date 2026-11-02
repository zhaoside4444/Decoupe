import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  rootCtx,
  serializerCtx,
  type CmdKey
} from '@milkdown/kit/core'
import {
  commonmark,
  createCodeBlockCommand,
  liftListItemCommand,
  sanitizeLinkHref,
  turnIntoTextCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
  wrapInBulletListCommand
} from '@milkdown/kit/preset/commonmark'
import {
  addColAfterCommand,
  addRowAfterCommand,
  deleteSelectedCellsCommand,
  gfm,
  insertTableCommand,
  selectColCommand,
  selectRowCommand,
  selectTableCommand,
  toggleStrikethroughCommand
} from '@milkdown/kit/preset/gfm'
import { history, redoCommand, undoCommand } from '@milkdown/kit/plugin/history'
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener'
import { $prose, callCommand, replaceAll } from '@milkdown/kit/utils'
import { lift, wrapIn } from '@milkdown/kit/prose/commands'
import { Plugin, PluginKey, Selection } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import { Fragment, type Node as PMNode } from '@milkdown/kit/prose/model'
import type { Ctx } from '@milkdown/kit/ctx'
import {
  AtSign,
  Bold,
  BookOpen,
  Check,
  Code,
  Download,
  FileText,
  Italic,
  Link2,
  List,
  ListOrdered,
  PanelRight,
  Plus,
  Quote,
  Redo2,
  Scissors,
  SquareCode,
  Strikethrough,
  Table2,
  Tag,
  Trash2,
  Undo2,
  X
} from 'lucide-react'
import type { NoteSummary, SelectionInfo, SplitParts } from '@shared/types'
import {
  findWikiLinks,
  normalizeMarkdown,
  normalizeTag,
  setFrontmatterTags,
  stripFrontmatter,
  tagsFromFrontmatter,
  uniqueTags,
  wikiLink
} from '@shared/text'
import { findPlainMentions, groupMentions } from '@shared/mentions'
import { findRelatedNotes } from '@shared/related'
import { restoreFocusIfLost } from '../util'
import {
  hasExactWikiNote,
  suggestWikiNotes,
  WIKI_SUGGESTION_LIMIT
} from '@shared/wiki-suggestions'
import { RelatedNotes } from './RelatedNotes'
import {
  TableTools,
  canDeleteTableColumn,
  canDeleteTableRow,
  type TableContext
} from './TableTools'
import '@milkdown/kit/prose/view/style/prosemirror.css'

interface NoteEditorProps {
  path: string
  spaceName: string
  title: string
  initialContent: string
  onSave: (content: string) => Promise<void>
  onExtract: (selection: SelectionInfo) => Promise<string | null>
  onSplit: (parts: SplitParts) => Promise<string | null>
  onTrash: () => void
  onOpenLink: (target: string) => void
  onCreateLink: (rawTitle: string) => Promise<string | null>
  onError: (message: string) => void
  notes: NoteSummary[]
  tagSuggestions: string[]
  onTagFilter: (tag: string) => void
  externalChange: boolean
  backlinksOpen: boolean
  backlinkCount: number
  onToggleBacklinks: () => void
  onExportPdf?: () => void
  onOpenTimeline?: () => void
  showRelatedNotes?: boolean
  onOpenNote?: (path: string) => void
}

export interface NoteEditorHandle {
  flush: () => Promise<void>
  getContent: () => string
  markSaved: (content: string) => void
}

type SaveState = 'saved' | 'dirty' | 'saving'

interface FormatState {
  strong: boolean
  emphasis: boolean
  strike: boolean
  code: boolean
  link: string | null
  heading: number
  bullet: boolean
  ordered: boolean
  quote: boolean
  codeBlock: boolean
  table: TableContext | null
}

type WikiMenuItem =
  | { kind: 'note'; note: NoteSummary }
  | { kind: 'create'; title: string }

interface WikiAutocompleteState {
  from: number
  to: number
  query: string
  top: number
  left: number
  width: number
  active: number
}

const WIKI_MENU_WIDTH = 330
const WIKI_MENU_HEIGHT = 288
const TABLE_PICKER_MAX = 6
const TABLE_PICKER_WIDTH = 216

function placeWikiMenu(
  coords: { top: number; bottom: number; left: number },
  bounds: DOMRect | null
): { top: number; left: number; width: number } {
  const minLeft = (bounds?.left ?? 0) + 12
  const maxRight = bounds?.right ?? window.innerWidth
  const width = Math.max(180, Math.min(WIKI_MENU_WIDTH, maxRight - minLeft - 12))
  const left = Math.min(Math.max(minLeft, coords.left), Math.max(minLeft, maxRight - width - 12))
  const minTop = (bounds?.top ?? 0) + 8
  const maxBottom = bounds?.bottom ?? window.innerHeight
  const top =
    maxBottom - coords.bottom >= WIKI_MENU_HEIGHT
      ? Math.min(coords.bottom + 6, maxBottom - WIKI_MENU_HEIGHT - 8)
      : Math.max(minTop, coords.top - WIKI_MENU_HEIGHT - 6)
  return { top, left, width }
}

const EMPTY_FORMAT: FormatState = {
  strong: false,
  emphasis: false,
  strike: false,
  code: false,
  link: null,
  heading: 0,
  bullet: false,
  ordered: false,
  quote: false,
  codeBlock: false,
  table: null
}

const wikiLinkPlugin = $prose(
  () =>
    new Plugin({
      key: new PluginKey('decoupe-wiki-links'),
      props: {
        decorations(state) {
          const decorations: Decoration[] = []
          state.doc.descendants((node, pos) => {
            if (!node.isText || !node.text) return
            const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
            let match: RegExpExecArray | null
            while ((match = regex.exec(node.text))) {
              const from = pos + match.index
              const to = from + match[0].length
              decorations.push(
                Decoration.inline(from, to, {
                  class: 'wiki-link',
                  'data-target': match[1].trim(),
                  title: match[2]?.trim() || match[1].trim()
                })
              )
            }
          })
          return DecorationSet.create(state.doc, decorations)
        }
      }
    })
)

function computeSplit(ctx: Ctx): SplitParts | null {
  const view = ctx.get(editorViewCtx)
  const { state } = view
  const { doc } = state
  const pos = state.selection.from

  const children: PMNode[] = []
  const offsets: number[] = []
  doc.forEach((child, offset, index) => {
    children.push(child)
    offsets[index] = offset
  })
  if (!children.length) return null

  let blockIndex = 0
  for (let index = 0; index < children.length; index += 1) {
    if (pos > offsets[index]) blockIndex = index
  }

  const block = children[blockIndex]
  const before: PMNode[] = children.slice(0, blockIndex)
  const after: PMNode[] = []
  const local = pos - offsets[blockIndex] - 1

  if (
    state.selection.$from.depth === 1 &&
    block.isTextblock &&
    local > 0 &&
    local < block.content.size
  ) {
    before.push(block.type.create(block.attrs, block.content.cut(0, local)))
    after.push(block.type.create(block.attrs, block.content.cut(local, block.content.size)))
    after.push(...children.slice(blockIndex + 1))
  } else if (pos <= offsets[blockIndex] + 1) {
    after.push(block, ...children.slice(blockIndex + 1))
  } else {
    before.push(block)
    after.push(...children.slice(blockIndex + 1))
  }

  if (!before.length || !after.length) return null

  try {
    const serializer = ctx.get(serializerCtx)
    const beforeDoc = doc.type.create(null, Fragment.fromArray(before))
    const afterDoc = doc.type.create(null, Fragment.fromArray(after))
    return {
      before: normalizeMarkdown(serializer(beforeDoc)).trim(),
      after: normalizeMarkdown(serializer(afterDoc)).trim()
    }
  } catch {
    return null
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Lecture de l’image impossible.'))
    reader.readAsDataURL(file)
  })
}

function FormatButton({
  title,
  active = false,
  expanded,
  toggle = true,
  onClick,
  children
}: {
  title: string
  active?: boolean
  expanded?: boolean
  toggle?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`fmt-btn${active ? ' is-active' : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={toggle ? active : undefined}
      aria-expanded={expanded}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(function NoteEditor(
  {
    path,
    spaceName,
    title,
    initialContent,
    onSave,
    onExtract,
    onSplit,
    onTrash,
    onOpenLink,
    onCreateLink,
    onError,
    notes,
    tagSuggestions,
    onTagFilter,
    externalChange = false,
    backlinksOpen,
    backlinkCount,
  onToggleBacklinks,
      onExportPdf,
      onOpenTimeline,
      showRelatedNotes = true,
  onOpenNote
  },
  ref
) {
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const tableMenuRef = useRef<HTMLDivElement>(null)
  const tableAnchorRef = useRef<HTMLSpanElement>(null)
  const notesRef = useRef(notes)
  const autocompleteRef = useRef<WikiAutocompleteState | null>(null)
  const creatingRef = useRef(false)
  const editorRef = useRef<Editor | null>(null)
  const initial = useRef(stripFrontmatter(initialContent))
  const frontmatterRef = useRef(initial.current.frontmatter)
  const body = initial.current.body
  const latestRef = useRef(initialContent)
  const savedRef = useRef(initialContent)
  const timerRef = useRef<number | null>(null)
  const skipTagCommit = useRef(false)
  const conflictRef = useRef(false)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [bubble, setBubble] = useState<{ top: number; left: number } | null>(null)
  const [formatState, setFormatState] = useState<FormatState>(EMPTY_FORMAT)
  const [linkPrompt, setLinkPrompt] = useState<{ value: string; error: string | null } | null>(null)
  const [tableMenu, setTableMenu] = useState<{ top: number; left: number } | null>(null)
  const [tableSize, setTableSize] = useState({ rows: 3, cols: 3 })
  const [tags, setTags] = useState<string[]>(() =>
    tagsFromFrontmatter(initial.current.frontmatter)
  )
  const [currentLinks, setCurrentLinks] = useState<string[]>(() =>
    Array.from(new Set(findWikiLinks(body).map((m) => m.target.toLowerCase())))
  )
  const [tagDraft, setTagDraft] = useState<string | null>(null)
  const [autocomplete, setAutocomplete] = useState<WikiAutocompleteState | null>(null)
  const [mentionsOpen, setMentionsOpen] = useState(false)
  const [mentionsMarkdown, setMentionsMarkdown] = useState(() => initialContent)
  const mentionsOpenRef = useRef(false)

  const relatedNotes = useMemo(() => {
    if (!showRelatedNotes) return []
    return findRelatedNotes({
      currentPath: path,
      currentTags: tags,
      currentLinks,
      notes,
      maxResults: 6
    })
  }, [showRelatedNotes, path, tags, currentLinks, notes])
  const mentionsWrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    mentionsOpenRef.current = mentionsOpen
  }, [mentionsOpen])

  useEffect(() => {
    if (!mentionsOpen) return
    const previous = document.activeElement as HTMLElement | null
    const onPointerDown = (event: PointerEvent): void => {
      if (!mentionsWrapRef.current?.contains(event.target as Node)) setMentionsOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMentionsOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      restoreFocusIfLost(previous)
    }
  }, [mentionsOpen])

  useEffect(() => {
    if (!tableMenu) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node
      if (tableMenuRef.current?.contains(target) || tableAnchorRef.current?.contains(target)) return
      setTableMenu(null)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setTableMenu(null)
        tableAnchorRef.current?.querySelector('button')?.focus()
      }
    }
    const close = (): void => setTableMenu(null)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [tableMenu])

  const callbacks = useRef({ onSave, onExtract, onSplit, onOpenLink, onCreateLink, onError })
  useEffect(() => {
    callbacks.current = { onSave, onExtract, onSplit, onOpenLink, onCreateLink, onError }
  }, [onSave, onExtract, onSplit, onOpenLink, onCreateLink, onError])

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  useEffect(() => {
    autocompleteRef.current = autocomplete
  }, [autocomplete])

  useEffect(() => {
    conflictRef.current = externalChange
    if (externalChange && timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [externalChange])

  const flushRef = useRef<() => Promise<void>>(async () => {})

  useImperativeHandle(
    ref,
    () => ({
      flush: () => flushRef.current(),
      getContent: () => latestRef.current,
      markSaved: (content: string) => {
        savedRef.current = content
        setSaveState(latestRef.current === content ? 'saved' : 'dirty')
      }
    }),
    []
  )

  const wikiItems: WikiMenuItem[] = autocomplete
    ? [
        ...suggestWikiNotes(notes, autocomplete.query, path, WIKI_SUGGESTION_LIMIT).map(
          (note): WikiMenuItem => ({ kind: 'note', note })
        ),
        ...(autocomplete.query.trim() && !hasExactWikiNote(notes, autocomplete.query, '')
          ? [{ kind: 'create' as const, title: autocomplete.query.trim() }]
          : [])
      ]
    : []
  const activeWikiIndex = autocomplete
    ? Math.min(autocomplete.active, Math.max(0, wikiItems.length - 1))
    : 0
  const mentions = useMemo(
    () => findPlainMentions(mentionsMarkdown, notes, path),
    [mentionsMarkdown, notes, path]
  )
  const mentionGroups = useMemo(() => groupMentions(mentions), [mentions])

  function hideWikiMenu(): void {
    autocompleteRef.current = null
    setAutocomplete(null)
  }

  function toggleMentions(): void {
    if (mentionsOpenRef.current) {
      setMentionsOpen(false)
      return
    }
    setMentionsOpen(true)
    setMentionsMarkdown(latestRef.current)
  }

  async function convertMention(base: string): Promise<void> {
    const editor = editorRef.current
    if (!editor) return
    const bodyMarkdown = normalizeMarkdown(
      editor.action((ctx) => ctx.get(serializerCtx)(ctx.get(editorViewCtx).state.doc))
    )
    const composedMarkdown = frontmatterRef.current
      ? `${frontmatterRef.current}\n\n${bodyMarkdown}`
      : bodyMarkdown
    const occurrence = findPlainMentions(composedMarkdown, notesRef.current, path).find(
      (item) => item.base.toLowerCase() === base.toLowerCase()
    )
    if (!occurrence) return
    const nextComposed = `${composedMarkdown.slice(0, occurrence.index)}${wikiLink(
      occurrence.base,
      occurrence.alias
    )}${composedMarkdown.slice(occurrence.index + occurrence.length)}`
    const nextBody = stripFrontmatter(nextComposed).body
    editor.action(replaceAll(nextBody, true))
    scheduleSave(nextBody)
    setBubble(null)
    requestAnimationFrame(fixImages)
  }

  function syncAutocompletePosition(): void {
    const current = autocompleteRef.current
    const editor = editorRef.current
    if (!current || !editor) return
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const bounds = scrollRef.current?.getBoundingClientRect() ?? null
      const pos = Math.min(current.to, view.state.doc.content.size)
      const coords = view.coordsAtPos(pos)
      if (bounds && (coords.bottom < bounds.top || coords.top > bounds.bottom)) {
        hideWikiMenu()
        return
      }
      const next = placeWikiMenu(coords, bounds)
      setAutocomplete((previous) =>
        previous ? { ...previous, top: next.top, left: next.left, width: next.width } : previous
      )
    })
  }

  function syncAutocomplete(): void {
    const editor = editorRef.current
    if (!editor) {
      hideWikiMenu()
      return
    }
    const next = editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      if (!view.hasFocus() || !view.state.selection.empty) return null
      const { $from, from: cursor } = view.state.selection
      if (!$from.parent.isTextblock) return null
      if ($from.parent.type.name === 'code_block') return null
      if ($from.marks().some((mark) => mark.type.name === 'inlineCode')) return null

      const before = $from.parent.textBetween(0, $from.parentOffset, '\n', '\ufffc')
      const open = before.lastIndexOf('[[')
      if (open < 0) return null
      const query = before.slice(open + 2)
      if (query.includes(']') || query.includes('|') || query.includes('\n')) return null

      const after = $from.parent.textBetween(
        $from.parentOffset,
        $from.parent.content.size,
        '\n',
        '\ufffc'
      )
      const restOfLine = after.split('\n', 1)[0]
      const nextOpen = restOfLine.indexOf('[[')
      const nextClose = restOfLine.indexOf(']]')
      if (nextClose !== -1 && (nextOpen === -1 || nextClose < nextOpen)) return null

      const coords = view.coordsAtPos(cursor)
      return {
        from: $from.start() + open,
        to: cursor,
        query,
        ...placeWikiMenu(coords, scrollRef.current?.getBoundingClientRect() ?? null)
      }
    })

    setAutocomplete((previous) => {
      if (!next) return previous ? null : previous
      if (
        previous &&
        previous.from === next.from &&
        previous.to === next.to &&
        previous.query === next.query &&
        previous.top === next.top &&
        previous.left === next.left &&
        previous.width === next.width
      ) {
        return previous
      }
      return {
        ...next,
        active:
          previous && previous.from === next.from && previous.query === next.query
            ? previous.active
            : 0
      }
    })
  }

  async function selectWikiItem(item: WikiMenuItem): Promise<void> {
    const menu = autocompleteRef.current
    if (!menu || creatingRef.current) return
    let link: string

    if (item.kind === 'note') {
      link = wikiLink(item.note.base, item.note.title)
    } else {
      creatingRef.current = true
      hideWikiMenu()
      try {
        const created = await callbacks.current.onCreateLink(item.title)
        if (!created) return
        link = created
      } finally {
        creatingRef.current = false
      }
    }

    const editor = editorRef.current
    if (!editor) return
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state } = view
      const from = Math.min(menu.from, state.doc.content.size)
      const to = Math.min(menu.to, state.doc.content.size)
      if (from > to) return
      if (state.doc.textBetween(from, to, '\n', '\n') !== `[[${menu.query}`) return
      view.dispatch(state.tr.insertText(link, from, to).scrollIntoView())
      view.focus()
    })
    hideWikiMenu()
    refreshFormatState()
  }

  useEffect(() => {
    if (!autocomplete) return
    const onScroll = (): void => syncAutocompletePosition()
    const scroller = scrollRef.current
    scroller?.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      scroller?.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [autocomplete])

  useEffect(() => {
    if (!autocomplete) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.isComposing) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as Node | null
      const inEditor =
        Boolean(target) &&
        (Boolean(rootRef.current?.contains(target)) || Boolean(menuRef.current?.contains(target)))
      if (!inEditor) return

      if (
        (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
        !event.shiftKey
      ) {
        if (!wikiItems.length) return
        event.preventDefault()
        event.stopPropagation()
        const delta = event.key === 'ArrowDown' ? 1 : -1
        setAutocomplete((previous) =>
          previous
            ? {
                ...previous,
                active: (activeWikiIndex + delta + wikiItems.length) % wikiItems.length
              }
            : previous
        )
      } else if (
        (event.key === 'Enter' || event.key === 'Tab') &&
        !event.shiftKey
      ) {
        if (!wikiItems.length) return
        event.preventDefault()
        event.stopPropagation()
        void selectWikiItem(wikiItems[activeWikiIndex])
      } else if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        hideWikiMenu()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [autocomplete, wikiItems, activeWikiIndex])

  useEffect(() => {
    if (!autocomplete) return
    const option = menuRef.current?.querySelector<HTMLElement>(
      `[data-wiki-index="${activeWikiIndex}"]`
    )
    option?.scrollIntoView({ block: 'nearest' })
  }, [autocomplete, activeWikiIndex])

  useEffect(() => {
    if (!autocomplete) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node | null
      if (!target) return
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      hideWikiMenu()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [autocomplete])

  function fixImages(): void {
    const root = rootRef.current
    if (!root) return
    root.querySelectorAll('img').forEach((img) => {
      const raw = img.getAttribute('src') ?? ''
      if (!raw || raw.startsWith('vault://') || raw.startsWith('data:')) return
      if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return
      const encoded = raw
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')
      img.src = `vault://files/${encoded}`
      img.loading = 'lazy'
    })
  }

  function focusEnd(): void {
    const editor = editorRef.current
    if (!editor) return
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      view.focus()
      const { state } = view
      view.dispatch(state.tr.setSelection(Selection.atEnd(state.doc)))
    })
  }

  function focusEditor(): void {
    editorRef.current?.action((ctx) => ctx.get(editorViewCtx).focus())
  }

  function refreshFormatState(): void {
    const editor = editorRef.current
    if (!editor) {
      setFormatState(EMPTY_FORMAT)
      return
    }
    const next = editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state } = view
      const { $from, from, to, empty } = state.selection
      const schema = state.schema
      const marks = empty ? (state.storedMarks ?? $from.marks()) : null
      const isActive = (name: string): boolean => {
        const type = schema.marks[name]
        if (!type) return false
        if (marks) return !!type.isInSet(marks)
        return state.doc.rangeHasMark(from, to, type)
      }
      let link: string | null = null
      if (marks) {
        const mark = schema.marks.link?.isInSet(marks)
        if (mark) link = String(mark.attrs.href ?? '')
      } else {
        state.doc.nodesBetween(from, to, (node) => {
          const mark = schema.marks.link?.isInSet(node.marks)
          if (mark) {
            link = String(mark.attrs.href ?? '')
            return false
          }
          return true
        })
      }
      let heading = 0
      let bullet = false
      let ordered = false
      let quote = false
      let codeBlock = false
      let table: TableContext | null = null
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        const node = $from.node(depth)
        const name = node.type.name
        if (name === 'heading') heading = Number(node.attrs.level) || 0
        if (name === 'bullet_list') bullet = true
        if (name === 'ordered_list') ordered = true
        if (name === 'blockquote') quote = true
        if (name === 'code_block') codeBlock = true
        if (name === 'table' && depth < $from.depth) {
          table = {
            row: $from.index(depth),
            col: $from.index(depth + 1),
            rows: node.childCount,
            cols: node.firstChild?.childCount ?? 0
          }
        }
      }
      return {
        strong: isActive('strong'),
        emphasis: isActive('emphasis'),
        strike: isActive('strike_through'),
        code: isActive('inlineCode'),
        link,
        heading,
        bullet,
        ordered,
        quote,
        codeBlock,
        table
      }
    })
    setFormatState(next)
  }

  function runCommand<T>(key: CmdKey<T>, payload?: T): void {
    const editor = editorRef.current
    if (!editor) return
    editor.action(callCommand(key, payload))
    editor.action((ctx) => ctx.get(editorViewCtx).focus())
    refreshFormatState()
  }

  function setHeading(level: number): void {
    if (level === 0) runCommand(turnIntoTextCommand.key)
    else runCommand(wrapInHeadingCommand.key, level)
  }

  function toggleList(kind: 'bullet' | 'ordered'): void {
    const editor = editorRef.current
    if (!editor) return
    const same = kind === 'bullet' ? formatState.bullet : formatState.ordered
    if (same) {
      runCommand(liftListItemCommand.key)
      return
    }
    if (!formatState.bullet && !formatState.ordered) {
      runCommand(kind === 'bullet' ? wrapInBulletListCommand.key : wrapInOrderedListCommand.key)
      return
    }
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state } = view
      const target = state.schema.nodes[kind === 'bullet' ? 'bullet_list' : 'ordered_list']
      if (!target) return
      const { $from } = state.selection
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        const name = $from.node(depth).type.name
        if (name !== 'bullet_list' && name !== 'ordered_list') continue
        if ($from.node(depth).type === target) return
        view.dispatch(state.tr.setNodeMarkup($from.before(depth), target).scrollIntoView())
        return
      }
    })
    focusEditor()
    refreshFormatState()
  }

  function toggleQuote(): void {
    const editor = editorRef.current
    if (!editor) return
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state } = view
      const quoteType = state.schema.nodes.blockquote
      if (!quoteType) return
      if (formatState.quote) lift(state, view.dispatch)
      else wrapIn(quoteType)(state, view.dispatch)
    })
    focusEditor()
    refreshFormatState()
  }

  function toggleCodeBlock(): void {
    runCommand(formatState.codeBlock ? turnIntoTextCommand.key : createCodeBlockCommand.key)
  }

  function toggleTableMenu(): void {
    if (tableMenu) {
      setTableMenu(null)
      return
    }
    const rect = tableAnchorRef.current?.getBoundingClientRect()
    if (!rect) return
    setLinkPrompt(null)
    setBubble(null)
    hideWikiMenu()
    setTableSize({ rows: 3, cols: 3 })
    setTableMenu({
      top: Math.min(rect.bottom + 6, window.innerHeight - 228),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - TABLE_PICKER_WIDTH - 8))
    })
  }

  function insertTable(rows: number, cols: number): void {
    setTableMenu(null)
    runCommand(insertTableCommand.key, { row: rows, col: cols })
  }

  function addTableRow(): void {
    if (!formatState.table) return
    runCommand(addRowAfterCommand.key)
  }

  function addTableColumn(): void {
    if (!formatState.table) return
    runCommand(addColAfterCommand.key)
  }

  function deleteTableLine(
    key: CmdKey<{ index: number; pos?: number }>,
    index: number
  ): void {
    const editor = editorRef.current
    if (!editor) return
    editor.action(callCommand(key, { index }))
    editor.action(callCommand(deleteSelectedCellsCommand.key))
    editor.action((ctx) => ctx.get(editorViewCtx).focus())
    refreshFormatState()
  }

  function deleteTableRow(): void {
    const table = formatState.table
    if (!table || !canDeleteTableRow(table)) return
    deleteTableLine(selectRowCommand.key, table.row)
  }

  function deleteTableColumn(): void {
    const table = formatState.table
    if (!table || !canDeleteTableColumn(table)) return
    deleteTableLine(selectColCommand.key, table.col)
  }

  function deleteTable(): void {
    if (!formatState.table) return
    const editor = editorRef.current
    if (!editor) return
    editor.action(callCommand(selectTableCommand.key))
    editor.action(callCommand(deleteSelectedCellsCommand.key))
    editor.action((ctx) => ctx.get(editorViewCtx).focus())
    refreshFormatState()
  }

  function openLinkPrompt(): void {
    setLinkPrompt({ value: formatState.link ?? '', error: null })
    setBubble(null)
    setTableMenu(null)
    hideWikiMenu()
  }

  function closeLinkPrompt(): void {
    setLinkPrompt(null)
    focusEditor()
  }

  function applyLink(): void {
    if (!linkPrompt) return
    const editor = editorRef.current
    if (!editor) return
    const href = sanitizeLinkHref(linkPrompt.value)
    if (linkPrompt.value.trim() && !href) {
      setLinkPrompt({ value: linkPrompt.value, error: 'Adresse invalide' })
      return
    }
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state } = view
      const linkType = state.schema.marks.link
      if (!linkType) return
      const { $from, from, to, empty } = state.selection
      if (empty) {
        const current = linkType.isInSet(state.storedMarks ?? $from.marks())
        if (current) {
          let start = from
          let end = to
          while (start > 0 && state.doc.rangeHasMark(start - 1, start, linkType)) start -= 1
          while (end < state.doc.content.size && state.doc.rangeHasMark(end, end + 1, linkType)) {
            end += 1
          }
          let tr = state.tr.removeMark(start, end, linkType)
          if (href) tr = tr.addMark(start, end, linkType.create({ href }))
          view.dispatch(tr.scrollIntoView())
          return
        }
        if (!href) return
        const text = 'lien'
        const tr = state.tr
          .insertText(text, from, to)
          .addMark(from, from + text.length, linkType.create({ href }))
        view.dispatch(tr.scrollIntoView())
      } else {
        let tr = state.tr.removeMark(from, to, linkType)
        if (href) tr = tr.addMark(from, to, linkType.create({ href }))
        view.dispatch(tr.scrollIntoView())
      }
    })
    setLinkPrompt(null)
    focusEditor()
    refreshFormatState()
  }

  function scheduleSave(markdown: string): void {
    const normalized = normalizeMarkdown(markdown)
    const frontmatter = frontmatterRef.current
    const composed = frontmatter ? `${frontmatter}\n\n${normalized}` : normalized
    latestRef.current = composed
    const parsedLinks = Array.from(
      new Set(findWikiLinks(normalized).map((m) => m.target.toLowerCase()))
    )
    setCurrentLinks((prev) => {
      if (
        prev.length === parsedLinks.length &&
        prev.every((v, i) => v === parsedLinks[i])
      ) {
        return prev
      }
      return parsedLinks
    })
    if (composed === savedRef.current) return
    setSaveState('dirty')
    if (timerRef.current) window.clearTimeout(timerRef.current)
    if (conflictRef.current) {
      timerRef.current = null
      return
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void flushRef.current()
    }, 550)
  }

  function commitTags(next: string[]): void {
    const clean = uniqueTags(next)
    const frontmatter = setFrontmatterTags(frontmatterRef.current, clean)
    frontmatterRef.current = frontmatter
    setTags(clean)
    const editor = editorRef.current
    if (!editor) return
    const markdown = editor.action((ctx) =>
      ctx.get(serializerCtx)(ctx.get(editorViewCtx).state.doc)
    )
    scheduleSave(markdown)
  }

  function addTag(raw: string): void {
    const tag = normalizeTag(raw)
    if (!tag) {
      setTagDraft(null)
      return
    }
    commitTags([...tags, tag])
    setTagDraft('')
  }

  function removeTag(tag: string): void {
    commitTags(tags.filter((current) => current !== tag))
  }

  function closeTagInput(): void {
    skipTagCommit.current = true
    setTagDraft(null)
    requestAnimationFrame(focusEditor)
  }

  function getSelectionInfo(): SelectionInfo | null {
    const editor = editorRef.current
    if (!editor) return null
    return editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { from, to } = view.state.selection
      if (from === to) return null
      const text = view.state.doc.textBetween(from, to, '\n', '\n').trim()
      if (!text) return null
      return { from, to, text }
    })
  }

  async function handleExtract(): Promise<void> {
    const info = getSelectionInfo()
    if (!info) return
    const link = await callbacks.current.onExtract(info)
    if (!link) return
    editorRef.current?.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      view.dispatch(view.state.tr.insertText(link, info.from, info.to))
      view.focus()
    })
    setBubble(null)
  }

  async function handleSplit(): Promise<void> {
    const editor = editorRef.current
    if (!editor) return
    const parts = editor.action((ctx) => computeSplit(ctx))
    if (!parts || !parts.before.trim() || !parts.after.trim()) return
    const link = await callbacks.current.onSplit(parts)
    if (!link) return
    const next = `${parts.before}\n\n${link}\n`
    editor.action(replaceAll(next, true))
    scheduleSave(next)
    setBubble(null)
    requestAnimationFrame(fixImages)
  }

  async function insertImage(file: File): Promise<void> {
    try {
      const dataUrl = await readAsDataUrl(file)
      const { relative } = await window.api.saveImage(dataUrl)
      const editor = editorRef.current
      if (!editor) return
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const imageType = view.state.schema.nodes.image
        if (!imageType) throw new Error('Images non prises en charge.')
        const node = imageType.create({ src: relative, alt: '' })
        view.dispatch(view.state.tr.replaceSelectionWith(node))
        view.focus()
      })
      requestAnimationFrame(fixImages)
    } catch (error) {
      callbacks.current.onError(
        error instanceof Error ? error.message : 'Impossible d’ajouter l’image.'
      )
    }
  }

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let cancelled = false
    let editor: Editor | null = null
    let frame = 0
    let selectionFrame = 0

    const flush = async (): Promise<void> => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (conflictRef.current) return
      const markdown = latestRef.current
      if (markdown === savedRef.current) return
      const previous = savedRef.current
      savedRef.current = markdown
      setSaveState('saving')
      try {
        await callbacks.current.onSave(markdown)
        setSaveState('saved')
      } catch (error) {
        savedRef.current = previous
        setSaveState('dirty')
        callbacks.current.onError(
          error instanceof Error ? error.message : 'Enregistrement impossible.'
        )
      }
      if (!cancelled && mentionsOpenRef.current) setMentionsMarkdown(latestRef.current)
    }
    flushRef.current = flush

    const updateBubble = (): void => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setBubble(null)
        return
      }
      const range = selection.getRangeAt(0)
      if (!root.contains(range.commonAncestorContainer) || !selection.toString().trim()) {
        setBubble(null)
        return
      }
      const rect = range.getBoundingClientRect()
      if (!rect.width && !rect.height) {
        setBubble(null)
        return
      }
      setBubble({
        top: Math.max(46, rect.top - 10),
        left: Math.min(window.innerWidth - 130, Math.max(130, rect.left + rect.width / 2))
      })
    }

    const onSelectionChange = (): void => {
      window.cancelAnimationFrame(selectionFrame)
      selectionFrame = window.requestAnimationFrame(updateBubble)
    }

    const hideBubble = (): void => setBubble(null)

    const onClick = (event: MouseEvent): void => {
      const target = (event.target as HTMLElement | null)?.closest('.wiki-link')
      if (!target) return
      event.preventDefault()
      const name = target.getAttribute('data-target')
      if (name) callbacks.current.onOpenLink(name)
    }

    const onPaste = (event: ClipboardEvent): void => {
      const items = event.clipboardData?.items
      if (!items) return
      const files: File[] = []
      for (const item of Array.from(items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }
      if (!files.length) return
      event.preventDefault()
      files.forEach((file) => void insertImage(file))
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.shiftKey && event.key.toLowerCase() === 'x') {
        event.preventDefault()
        void handleExtract()
      } else if (mod && event.shiftKey && event.key === 'Enter') {
        event.preventDefault()
        void handleSplit()
      }
    }

    const onBlur = (): void => {
      void flush()
      hideBubble()
      hideWikiMenu()
    }

    const onWindowBlur = (): void => {
      void flush()
      hideWikiMenu()
    }

    const onScroll = (): void => hideBubble()

    const observer = new MutationObserver(() => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(fixImages)
    })
    observer.observe(root, { childList: true, subtree: true })

    root.addEventListener('click', onClick)
    root.addEventListener('paste', onPaste)
    root.addEventListener('keydown', onKeyDown)
    root.addEventListener('blur', onBlur)
    document.addEventListener('selectionchange', onSelectionChange)
    window.addEventListener('blur', onWindowBlur)
    root.addEventListener('scroll', onScroll, true)

    const setup = async (): Promise<void> => {
      editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root)
          ctx.set(defaultValueCtx, body)
        })
        .use(commonmark)
        .use(gfm)
        .use(history)
        .use(listener)
        .use(wikiLinkPlugin)
        .config((ctx) => {
          ctx
            .get(listenerCtx)
            .markdownUpdated((_ctx, markdown) => {
              scheduleSave(markdown)
              window.cancelAnimationFrame(frame)
              frame = window.requestAnimationFrame(fixImages)
              if (mentionsOpenRef.current) {
                setMentionsMarkdown(
                  frontmatterRef.current
                    ? `${frontmatterRef.current}\n\n${normalizeMarkdown(markdown)}`
                    : normalizeMarkdown(markdown)
                )
              }
            })
            .selectionUpdated(() => {
              refreshFormatState()
              syncAutocomplete()
            })
            .updated(() => {
              refreshFormatState()
              syncAutocomplete()
            })
        })
        .create()

      if (cancelled) {
        void editor.destroy()
        return
      }
      editorRef.current = editor
      requestAnimationFrame(() => {
        fixImages()
        focusEnd()
        refreshFormatState()
      })
    }

    void setup()

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
      window.cancelAnimationFrame(selectionFrame)
      observer.disconnect()
      root.removeEventListener('click', onClick)
      root.removeEventListener('paste', onPaste)
      root.removeEventListener('keydown', onKeyDown)
      root.removeEventListener('blur', onBlur)
      root.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('selectionchange', onSelectionChange)
      window.removeEventListener('blur', onWindowBlur)
      void flush()
      editorRef.current = null
      if (editor) void editor.destroy()
    }
    // L'éditeur est volontairement recréé par note (clé fournie par le parent).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const spaceLabel = spaceName || 'Boîte d’entrée'

  return (
    <div className="editor-pane">
      <header className="editor-head">
        <div className="crumb" title={`${spaceLabel} / ${title}`}>
          <span>{spaceLabel}</span>
          <span className="crumb-sep">/</span>
          <strong>{title}</strong>
        </div>
        <div className={`save-state is-${saveState}`}>
          <span className="dot" />
          {saveState === 'saved' ? 'Enregistré' : saveState === 'saving' ? 'Enregistrement…' : 'Modifié'}
        </div>
        <div className="head-actions">
          <button
            type="button"
            className={`icon-btn${backlinksOpen ? ' is-active' : ''}`}
            title={`Liens entrants (${backlinkCount})`}
            aria-label={`Liens entrants (${backlinkCount})`}
            aria-pressed={backlinksOpen}
            onClick={onToggleBacklinks}
          >
            <PanelRight size={16} />
            {backlinkCount > 0 ? (
              <span className="head-badge">{backlinkCount > 99 ? '99+' : backlinkCount}</span>
            ) : null}
          </button>
          <div className="mentions-wrap" ref={mentionsWrapRef}>
            <button
              type="button"
              className={`icon-btn${mentionsOpen ? ' is-active' : ''}`}
              title={`Mentions à lier (${mentions.length})`}
              aria-label={`Mentions à lier (${mentions.length})`}
              aria-pressed={mentionsOpen}
              onClick={toggleMentions}
            >
              <AtSign size={16} />
              {mentions.length ? (
                <span className="head-badge">{mentions.length > 99 ? '99+' : mentions.length}</span>
              ) : null}
            </button>
            {mentionsOpen && (
              <div className="mentions-pop" role="dialog" aria-label="Mentions à lier">
                <div className="mentions-head">
                  <strong>Mentions à lier</strong>
                  <button
                    type="button"
                    className="mentions-close"
                    aria-label="Fermer les mentions"
                    onClick={() => setMentionsOpen(false)}
                  >
                    <X size={14} />
                  </button>
                </div>
                {mentionGroups.length ? (
                  <div className="mentions-list">
                    {mentionGroups.map((group) => (
                      <div className="mentions-row" key={group.base}>
                        <div className="mentions-info">
                          <span className="mentions-title">
                            {group.title}
                            {group.count > 1 ? (
                              <span className="mentions-count">×{group.count}</span>
                            ) : null}
                          </span>
                          {group.snippet ? (
                            <span className="mentions-snippet">{group.snippet}</span>
                          ) : null}
                          <span className="mentions-link">{wikiLink(group.base, group.title)}</span>
                        </div>
                        <button
                          type="button"
                          className="mentions-convert"
                          title="Convertir la première occurrence"
                          onClick={() => void convertMention(group.base)}
                        >
                          Convertir
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mentions-empty">Aucun titre de note cité sans lien.</p>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className="icon-btn"
            title="Scinder au curseur (Ctrl+Shift+EntrǸe)"
            onClick={() => void handleSplit()}
          >
            <Scissors size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Exporter en PDF (Ctrl+P)"
            aria-label="Exporter en PDF"
            onClick={() => onExportPdf?.()}
          >
            <Download size={16} />
          </button>
          {onOpenTimeline ? (
            <button
              type="button"
              className="icon-btn"
              title="Timeline narrative (Ctrl+Shift+T)"
              aria-label="Timeline narrative"
              onClick={() => {
                if (onOpenTimeline) onOpenTimeline()
              }}
            >
              <BookOpen size={16} />
            </button>
          ) : null}
          <button type="button" className="icon-btn danger" title="Mettre à la corbeille" onClick={onTrash}>
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      <div className="tag-bar" aria-label="Tags de la note">
        {tags.map((tag) => (
          <span className="tag-chip" key={tag}>
            <button
              type="button"
              className="tag-chip-label"
              title={`Filtrer avec #${tag}`}
              onClick={() => onTagFilter(tag)}
            >
              #{tag}
            </button>
            <button
              type="button"
              className="tag-chip-remove"
              title={`Retirer #${tag}`}
              aria-label={`Retirer le tag ${tag}`}
              onClick={() => removeTag(tag)}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        {tagDraft === null ? (
          <button
            type="button"
            className="tag-add"
            title="Ajouter un tag"
            onClick={() => setTagDraft('')}
          >
            <Tag size={12} />
            Tag
          </button>
        ) : (
          <input
            className="tag-input"
            value={tagDraft}
            autoFocus
            list="decoupe-tag-suggestions"
            placeholder="tag puis Entrée"
            spellCheck={false}
            autoComplete="off"
            maxLength={40}
            aria-label="Nouveau tag"
            onChange={(event) => setTagDraft(event.target.value)}
            onBlur={() => {
              if (skipTagCommit.current) {
                skipTagCommit.current = false
                return
              }
              const value = tagDraft
              if (value?.trim()) addTag(value)
              setTagDraft(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault()
                addTag(tagDraft)
              } else if (event.key === 'Escape') {
                event.preventDefault()
                closeTagInput()
              } else if (event.key === 'Backspace' && !tagDraft && tags.length) {
                event.preventDefault()
                removeTag(tags[tags.length - 1])
              }
            }}
          />
        )}
        <datalist id="decoupe-tag-suggestions">
          {tagSuggestions
            .filter(
              (tag) =>
                !tags.some((current) => current.toLowerCase() === tag.toLowerCase())
            )
            .map((tag) => (
              <option key={tag} value={tag} />
            ))}
        </datalist>
      </div>

      <div className="format-bar" role="toolbar" aria-label="Mise en forme">
        <select
          className="format-select"
          value={formatState.heading}
          title="Style de texte"
          aria-label="Style de texte"
          onChange={(event) => setHeading(Number(event.target.value))}
        >
          <option value={0}>Texte</option>
          <option value={1}>Titre 1</option>
          <option value={2}>Titre 2</option>
          <option value={3}>Titre 3</option>
        </select>
        <span className="fmt-sep" />
        <FormatButton title="Gras (Ctrl+B)" active={formatState.strong} onClick={() => runCommand(toggleStrongCommand.key)}>
          <Bold size={15} />
        </FormatButton>
        <FormatButton title="Italique (Ctrl+I)" active={formatState.emphasis} onClick={() => runCommand(toggleEmphasisCommand.key)}>
          <Italic size={15} />
        </FormatButton>
        <FormatButton title="Barré" active={formatState.strike} onClick={() => runCommand(toggleStrikethroughCommand.key)}>
          <Strikethrough size={15} />
        </FormatButton>
        <FormatButton title="Code en ligne" active={formatState.code} onClick={() => runCommand(toggleInlineCodeCommand.key)}>
          <Code size={15} />
        </FormatButton>
        <span className="fmt-sep" />
        <FormatButton title="Liste à puces" active={formatState.bullet} onClick={() => toggleList('bullet')}>
          <List size={16} />
        </FormatButton>
        <FormatButton title="Liste numérotée" active={formatState.ordered} onClick={() => toggleList('ordered')}>
          <ListOrdered size={16} />
        </FormatButton>
        <FormatButton title="Citation" active={formatState.quote} onClick={toggleQuote}>
          <Quote size={15} />
        </FormatButton>
        <FormatButton title="Bloc de code" active={formatState.codeBlock} onClick={toggleCodeBlock}>
          <SquareCode size={15} />
        </FormatButton>
        <span className="table-picker" ref={tableAnchorRef}>
          <FormatButton
            title="Insérer un tableau"
            active={tableMenu !== null}
            expanded={tableMenu !== null}
            toggle={false}
            onClick={toggleTableMenu}
          >
            <Table2 size={15} />
          </FormatButton>
        </span>
        {formatState.table && (
          <>
            <span className="fmt-sep" />
            <TableTools
              {...formatState.table}
              onAddRow={addTableRow}
              onAddColumn={addTableColumn}
              onDeleteRow={deleteTableRow}
              onDeleteColumn={deleteTableColumn}
              onDeleteTable={deleteTable}
            />
          </>
        )}
        <span className="fmt-sep" />
        <FormatButton title="Lien" active={formatState.link !== null} onClick={openLinkPrompt}>
          <Link2 size={15} />
        </FormatButton>
        {linkPrompt && (
          <div className="link-entry">
            <input
              className={linkPrompt.error ? 'is-invalid' : ''}
              value={linkPrompt.value}
              autoFocus
              spellCheck={false}
              placeholder="https://…"
              aria-label="Adresse du lien"
              onChange={(event) => setLinkPrompt({ value: event.target.value, error: null })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  applyLink()
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  closeLinkPrompt()
                }
              }}
            />
            <button
              type="button"
              className="link-validate"
              title="Appliquer le lien"
              aria-label="Appliquer le lien"
              onMouseDown={(event) => event.preventDefault()}
              onClick={applyLink}
            >
              <Check size={14} />
            </button>
            {linkPrompt.error && <span className="link-error">{linkPrompt.error}</span>}
          </div>
        )}
        <span className="fmt-spacer" />
        <FormatButton title="Annuler (Ctrl+Z)" onClick={() => runCommand(undoCommand.key)}>
          <Undo2 size={15} />
        </FormatButton>
        <FormatButton title="Rétablir (Ctrl+Shift+Z)" onClick={() => runCommand(redoCommand.key)}>
          <Redo2 size={15} />
        </FormatButton>
      </div>

      {tableMenu && (
        <div
          className="table-menu"
          ref={tableMenuRef}
          role="dialog"
          aria-label="Insérer un tableau"
          style={{ top: tableMenu.top, left: tableMenu.left }}
        >
          <p className="table-menu-title">Insérer un tableau</p>
          <div className="table-grid" role="group" aria-label="Taille du tableau">
            {Array.from({ length: TABLE_PICKER_MAX }, (_, rowIndex) => (
              <div className="table-grid-row" key={rowIndex}>
                {Array.from({ length: TABLE_PICKER_MAX }, (_, colIndex) => {
                  const rows = rowIndex + 1
                  const cols = colIndex + 1
                  const selected = rows <= tableSize.rows && cols <= tableSize.cols
                  return (
                    <button
                      key={colIndex}
                      type="button"
                      className={`table-grid-cell${selected ? ' is-selected' : ''}`}
                      aria-label={`Insérer un tableau de ${cols} colonne${cols > 1 ? 's' : ''} et ${rows} ligne${rows > 1 ? 's' : ''}`}
                      onMouseEnter={() => setTableSize({ rows, cols })}
                      onFocus={() => setTableSize({ rows, cols })}
                      onClick={() => insertTable(rows, cols)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
          <p className="table-menu-size" aria-live="polite">
            {`${tableSize.cols} colonne${tableSize.cols > 1 ? 's' : ''} × ${tableSize.rows} ligne${
              tableSize.rows > 1 ? 's' : ''
            }`}
          </p>
        </div>
      )}

      <div className="editor-scroll" ref={scrollRef}>
        <div className="editor-page">
          <div ref={rootRef} className="editor-root" data-note={path} />
          {showRelatedNotes ? (
            <RelatedNotes
              related={relatedNotes}
              onOpenNote={onOpenNote ?? onOpenLink}
              onTagFilter={onTagFilter}
            />
          ) : null}
        </div>
      </div>

      {autocomplete && (
        <div
          className="wiki-menu"
          ref={menuRef}
          role="listbox"
          aria-label="Suggestions de notes"
          style={{ top: autocomplete.top, left: autocomplete.left, width: autocomplete.width }}
        >
          {wikiItems.length ? (
            <>
              <div className="wiki-menu-list">
                {wikiItems.map((item, index) =>
                  item.kind === 'note' ? (
                    <button
                      key={`note:${item.note.path}`}
                      type="button"
                      role="option"
                      aria-selected={index === activeWikiIndex}
                      className={`wiki-option${index === activeWikiIndex ? ' is-active' : ''}`}
                      data-wiki-index={index}
                      title={item.note.path}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() =>
                        setAutocomplete((previous) =>
                          previous ? { ...previous, active: index } : previous
                        )
                      }
                      onClick={() => void selectWikiItem(item)}
                    >
                      <FileText size={15} />
                      <span className="wiki-option-copy">
                        <span className="wiki-option-title">{item.note.title}</span>
                        <span className="wiki-option-meta">
                          {item.note.space || 'Boîte d’entrée'}
                        </span>
                      </span>
                    </button>
                  ) : (
                    <button
                      key="create"
                      type="button"
                      role="option"
                      aria-selected={index === activeWikiIndex}
                      className={`wiki-option is-create${index === activeWikiIndex ? ' is-active' : ''}`}
                      data-wiki-index={index}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() =>
                        setAutocomplete((previous) =>
                          previous ? { ...previous, active: index } : previous
                        )
                      }
                      onClick={() => void selectWikiItem(item)}
                    >
                      <Plus size={15} />
                      <span className="wiki-option-copy">
                        <span className="wiki-option-title">Créer « {item.title} »</span>
                        <span className="wiki-option-meta">
                          Nouvelle note dans {spaceLabel}
                        </span>
                      </span>
                    </button>
                  )
                )}
              </div>
              <div className="wiki-menu-hint" aria-hidden="true">
                <span>
                  <kbd>↑</kbd>
                  <kbd>↓</kbd> naviguer
                </span>
                <span>
                  <kbd>Entrée</kbd> insérer
                </span>
                <span>
                  <kbd>Échap</kbd> fermer
                </span>
              </div>
            </>
          ) : (
            <div className="wiki-menu-empty">
              <span>Aucune autre note à suggérer.</span>
              <span>Continuez à taper pour insérer un lien libre.</span>
            </div>
          )}
        </div>
      )}

      <footer className="editor-foot">
        <span>Ctrl+Entr��e nouvelle note</span>
        <span>Ctrl+Shift+X extraire</span>
        <span>Tapez [[ pour lier une note</span>
        <span>Glisser une note sur une autre pour fusionner</span>
      </footer>

      {bubble && (
        <div
          className="selection-bubble"
          style={{ top: bubble.top, left: bubble.left }}
          onMouseDown={(event) => event.preventDefault()}
        >
          <FormatButton title="Gras" active={formatState.strong} onClick={() => runCommand(toggleStrongCommand.key)}>
            <Bold size={14} />
          </FormatButton>
          <FormatButton title="Italique" active={formatState.emphasis} onClick={() => runCommand(toggleEmphasisCommand.key)}>
            <Italic size={14} />
          </FormatButton>
          <FormatButton title="Barré" active={formatState.strike} onClick={() => runCommand(toggleStrikethroughCommand.key)}>
            <Strikethrough size={14} />
          </FormatButton>
          <FormatButton title="Code en ligne" active={formatState.code} onClick={() => runCommand(toggleInlineCodeCommand.key)}>
            <Code size={14} />
          </FormatButton>
          <FormatButton title="Lien" active={formatState.link !== null} onClick={openLinkPrompt}>
            <Link2 size={14} />
          </FormatButton>
          <span className="fmt-sep" />
          <button
            type="button"
            className="extract-bubble"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void handleExtract()}
          >
            <Scissors size={13} />
            Extraire
          </button>
        </div>
      )}
    </div>
  )
})
