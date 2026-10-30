import { promises as fs } from 'node:fs'
import path from 'node:path'
import type {
  BacklinkEntry,
  CreatedNote,
  LinkCleanup,
  NoteSummary,
  SavedImage,
  SearchMatchField,
  Space,
  TagChange,
  TrashedNote,
  TrashedSpace,
  TrashItem,
  TrashRestoreResult
} from '../shared/types'
import {
  baseFromPath,
  countOccurrences,
  createdFromFrontmatter,
  dateKey,
  ensureCreatedDate,
  excerptFromMarkdown,
  findWikiLinks,
  normalizeTag,
  parseSearchQuery,
  plainTextFromMarkdown,
  retagMarkdown,
  rewriteWikiLinks,
  searchSnippet,
  slugify,
  spaceOfPath,
  stripFrontmatter,
  tagsFromFrontmatter,
  titleFromMarkdown,
  wikiLinkSnippet,
  pinnedFromFrontmatter
} from '../shared/text'

export const NOTES_DIR = 'Notes'
export const ATTACHMENTS_DIR = 'attachments'
export const META_DIR = '.decoupe'
export const TRASH_DIR = '.decoupe/corbeille'

interface CacheEntry {
  mtimeMs: number
  size: number
  content: string
  title: string
  excerpt: string
  tags: string[]
  links: string[]
  pinned: boolean
  createdAt: string
}

const cache = new Map<string, CacheEntry>()

export function clearCache(): void {
  cache.clear()
}

function toPosix(value: string): string {
  return value.split(path.sep).join('/')
}

function createdAtOf(
  content: string,
  stat: { birthtimeMs: number; mtimeMs: number }
): string {
  const frontmatter = stripFrontmatter(content).frontmatter
  return (
    createdFromFrontmatter(frontmatter) ??
    dateKey(stat.birthtimeMs > 0 ? stat.birthtimeMs : stat.mtimeMs)
  )
}

function normalizeSpace(space: string): string {
  const trimmed = (space ?? '').trim()
  if (!trimmed) return ''
  if (trimmed === '.' || trimmed === '..') throw new Error('Nom de dossier invalide.')
  if (/[<>:"/\\|?*\u0000-\u001f]/.test(trimmed)) throw new Error('Nom de dossier invalide.')
  if (trimmed.startsWith('.')) throw new Error('Nom de dossier invalide.')
  return trimmed
}

export function noteAbsolutePath(root: string, relativePath: string): string {
  const full = path.resolve(root, relativePath)
  const notesRoot = path.resolve(root, NOTES_DIR)
  if (full !== notesRoot && !full.startsWith(notesRoot + path.sep)) {
    throw new Error('Chemin de note invalide.')
  }
  if (!full.toLowerCase().endsWith('.md')) throw new Error('Extension invalide.')
  return full
}

function trashAbsolutePath(root: string, relativePath: string): string {
  const full = path.resolve(root, relativePath)
  const trashRoot = path.resolve(root, TRASH_DIR)
  if (!full.startsWith(trashRoot + path.sep)) throw new Error('Chemin de corbeille invalide.')
  return full
}

const TRASH_META_SUFFIX = '.meta.json'

interface TrashMeta {
  kind: 'note' | 'space'
  name: string
  title: string
  originalPath: string | null
  deletedAt: number
}

function trashMetaPath(target: string): string {
  return `${target}${TRASH_META_SUFFIX}`
}

async function writeTrashMeta(target: string, meta: TrashMeta): Promise<void> {
  await fs.writeFile(trashMetaPath(target), JSON.stringify(meta), 'utf8')
}

async function readTrashMeta(target: string): Promise<TrashMeta | null> {
  try {
    const raw = await fs.readFile(trashMetaPath(target), 'utf8')
    const value = JSON.parse(raw) as Partial<TrashMeta>
    if (!value || (value.kind !== 'note' && value.kind !== 'space')) return null
    if (typeof value.name !== 'string' || !value.name) return null
    return {
      kind: value.kind,
      name: value.name,
      title: typeof value.title === 'string' && value.title ? value.title : value.name,
      originalPath:
        typeof value.originalPath === 'string' && value.originalPath
          ? value.originalPath
          : null,
      deletedAt:
        typeof value.deletedAt === 'number' && Number.isFinite(value.deletedAt)
          ? value.deletedAt
          : Date.now()
    }
  } catch {
    return null
  }
}

async function removeTrashMeta(target: string): Promise<void> {
  await fs.rm(trashMetaPath(target), { force: true }).catch(() => {})
}

function parseTrashName(fileName: string): { name: string; deletedAt: number | null } {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z-(.+)$/.exec(fileName)
  if (!match) return { name: fileName, deletedAt: null }
  const deletedAt = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
    Number(match[7])
  )
  return { name: match[8], deletedAt: Number.isFinite(deletedAt) ? deletedAt : null }
}

async function uniqueSpacePath(dir: string, name: string): Promise<string> {
  let candidate = name
  let index = 2
  for (;;) {
    const target = path.join(dir, candidate)
    if (!(await pathExists(target))) return target
    candidate = `${name}-${index}`
    index += 1
    if (index > 9999) throw new Error('Trop de dossiers portant le même nom.')
  }
}

export async function initVault(root: string): Promise<void> {
  await fs.mkdir(root, { recursive: true })
  await fs.mkdir(path.join(root, NOTES_DIR), { recursive: true })
  await fs.mkdir(path.join(root, ATTACHMENTS_DIR), { recursive: true })
  await fs.mkdir(path.join(root, TRASH_DIR), { recursive: true })
}

async function readEntry(fullPath: string): Promise<CacheEntry> {
  const stat = await fs.stat(fullPath)
  const cached = cache.get(fullPath)
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached
  }
  const content = (await fs.readFile(fullPath, 'utf8')).replace(/^\uFEFF/, '')
  const { frontmatter: frontmatterSource, body } = stripFrontmatter(content)
  const links = Array.from(new Set(findWikiLinks(body).map((m) => m.target.toLowerCase())))
  const entry: CacheEntry = {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    content,
    title: titleFromMarkdown(content),
    excerpt: excerptFromMarkdown(content),
    tags: tagsFromFrontmatter(frontmatterSource),
    links,
    pinned: pinnedFromFrontmatter(frontmatterSource),
    createdAt: createdAtOf(content, stat)
  }
  cache.set(fullPath, entry)
  return entry
}

async function walkNotes(root: string, dir = path.join(root, NOTES_DIR)): Promise<string[]> {
  const result: string[] = []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return result
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      result.push(...(await walkNotes(root, full)))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      result.push(full)
    }
  }
  return result
}

export async function listNotes(root: string): Promise<NoteSummary[]> {
  const files = await walkNotes(root)
  const notes: NoteSummary[] = []

  for (const file of files) {
    try {
      const entry = await readEntry(file)
      const rel = toPosix(path.relative(root, file))
      notes.push({
        path: rel,
        base: baseFromPath(rel),
        title: entry.title || baseFromPath(rel),
        excerpt: entry.excerpt,
        space: spaceOfPath(rel),
        createdAt: entry.createdAt,
        updatedAt: entry.mtimeMs,
        tags: entry.tags,
        links: entry.links,
        pinned: entry.pinned
      })
    } catch {
      // Fichier illisible : ignoré.
    }
  }

  notes.sort((a, b) => b.updatedAt - a.updatedAt)
  return notes
}

export async function listBacklinks(
  root: string,
  targetPath: string
): Promise<BacklinkEntry[]> {
  noteAbsolutePath(root, targetPath)
  const targetBase = baseFromPath(targetPath).toLowerCase()
  const targetKey = targetPath.toLowerCase()
  const backlinks: BacklinkEntry[] = []

  for (const file of await walkNotes(root)) {
    const relativePath = toPosix(path.relative(root, file))
    if (relativePath.toLowerCase() === targetKey) continue
    try {
      const entry = await readEntry(file)
      if (!entry.content.includes('[[')) continue
      const body = stripFrontmatter(entry.content).body
      const matches = findWikiLinks(body).filter(
        (match) => match.target.toLowerCase() === targetBase
      )
      if (!matches.length) continue
      const first = matches[0]
      backlinks.push({
        path: relativePath,
        base: baseFromPath(relativePath),
        title: entry.title || baseFromPath(relativePath),
        space: spaceOfPath(relativePath),
        updatedAt: entry.mtimeMs,
        occurrences: matches.length,
        snippet: wikiLinkSnippet(body, first.index, first.length)
      })
    } catch {
      // Fichier illisible : ignoré.
    }
  }

  backlinks.sort((a, b) => b.updatedAt - a.updatedAt)
  return backlinks.slice(0, 200)
}

export async function listSpaces(root: string): Promise<Space[]> {
  const notesRoot = path.join(root, NOTES_DIR)
  const counts = new Map<string, number>()
  const notes = await listNotes(root)
  for (const note of notes) {
    if (!note.space) continue
    counts.set(note.space, (counts.get(note.space) ?? 0) + 1)
  }

  let entries
  try {
    entries = await fs.readdir(notesRoot, { withFileTypes: true })
  } catch {
    return []
  }

  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => ({ name: entry.name, count: counts.get(entry.name) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

export async function readNote(root: string, relativePath: string): Promise<string> {
  const full = noteAbsolutePath(root, relativePath)
  const content = await fs.readFile(full, 'utf8')
  return content.replace(/^\uFEFF/, '')
}

export async function writeNote(
  root: string,
  relativePath: string,
  content: string,
  expectedContent?: string
): Promise<string> {
  const full = noteAbsolutePath(root, relativePath)
  if (expectedContent !== undefined) {
    const disk = await fs
      .readFile(full, 'utf8')
      .then((value) => value.replace(/^\uFEFF/, ''))
      .catch(() => null)
    if (disk === null || disk !== expectedContent) {
      throw new Error(
        'La note a été modifiée en dehors de Decoupe. Rechargez-la ou conservez votre version.'
      )
    }
  }
  await fs.mkdir(path.dirname(full), { recursive: true })
  const existingStat = await fs.stat(full).catch(() => null)
  let created = createdFromFrontmatter(stripFrontmatter(content).frontmatter)
  if (!created) created = cache.get(full)?.createdAt ?? null
  if (!created) {
    const existing = await fs.readFile(full, 'utf8').catch(() => '')
    created = createdFromFrontmatter(stripFrontmatter(existing).frontmatter)
  }
  if (!created) {
    const fallback = existingStat
      ? existingStat.birthtimeMs > 0
        ? existingStat.birthtimeMs
        : existingStat.mtimeMs
      : Date.now()
    created = dateKey(fallback)
  }
  const stored = ensureCreatedDate(content, created)
  const tmp = `${full}.tmp-${process.pid}-${Date.now()}`
  await fs.writeFile(tmp, stored, 'utf8')
  try {
    await fs.rename(tmp, full)
  } catch {
    await fs.writeFile(full, stored, 'utf8')
    await fs.rm(tmp, { force: true })
  }
  const stat = await fs.stat(full)
  const { frontmatter: frontmatterSource, body } = stripFrontmatter(stored)
  cache.set(full, {
    mtimeMs: stat.mtimeMs,
    size: stat.size,
    content: stored,
    title: titleFromMarkdown(stored),
    excerpt: excerptFromMarkdown(stored),
    tags: tagsFromFrontmatter(frontmatterSource),
    links: Array.from(new Set(findWikiLinks(body).map((m) => m.target.toLowerCase()))),
    pinned: pinnedFromFrontmatter(frontmatterSource),
    createdAt: created
  })
  return stored
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function uniqueBasePath(dir: string, base: string): Promise<{ base: string; full: string }> {
  let candidate = base
  let index = 2
  for (;;) {
    const full = path.join(dir, `${candidate}.md`)
    if (!(await pathExists(full))) return { base: candidate, full }
    candidate = `${base}-${index}`
    index += 1
    if (index > 9999) throw new Error('Trop de notes portant le même nom.')
  }
}

export async function createNote(root: string, space: string, content: string): Promise<CreatedNote> {
  const safeSpace = normalizeSpace(space)
  const dir = safeSpace
    ? path.join(root, NOTES_DIR, safeSpace)
    : path.join(root, NOTES_DIR)
  await fs.mkdir(dir, { recursive: true })

  const rawTitle = titleFromMarkdown(content)
  const fallback = `Note ${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}`
  const base = slugify(rawTitle || fallback)
  const unique = await uniqueBasePath(dir, base)
  const relativePath = toPosix(path.relative(root, unique.full))

  await writeNote(root, relativePath, content)

  return {
    path: relativePath,
    base: unique.base,
    title: rawTitle || unique.base
  }
}

export async function trashNote(root: string, relativePath: string): Promise<TrashedNote> {
  const full = noteAbsolutePath(root, relativePath)
  const entry = await readEntry(full).catch(() => null)
  const trashRoot = path.join(root, TRASH_DIR)
  await fs.mkdir(trashRoot, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const name = `${stamp}-${path.basename(full)}`
  const target = path.join(trashRoot, name)
  await writeTrashMeta(target, {
    kind: 'note',
    name: path.basename(full),
    title: entry?.title || baseFromPath(relativePath),
    originalPath: toPosix(path.relative(root, full)),
    deletedAt: Date.now()
  })
  try {
    await fs.rename(full, target)
  } catch (error) {
    await removeTrashMeta(target)
    throw error
  }
  cache.delete(full)
  return { trashPath: toPosix(path.relative(root, target)) }
}

export async function restoreNote(
  root: string,
  trashPath: string,
  relativePath: string
): Promise<void> {
  const source = trashAbsolutePath(root, trashPath)
  const target = noteAbsolutePath(root, relativePath)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.rename(source, target)
  cache.delete(source)
  await removeTrashMeta(source)
}

export async function moveNote(
  root: string,
  relativePath: string,
  space: string
): Promise<{ path: string }> {
  const safeSpace = normalizeSpace(space)
  const full = noteAbsolutePath(root, relativePath)
  const dir = safeSpace
    ? path.join(root, NOTES_DIR, safeSpace)
    : path.join(root, NOTES_DIR)
  await fs.mkdir(dir, { recursive: true })

  if (path.dirname(full) === path.resolve(dir)) return { path: relativePath }

  const unique = await uniqueBasePath(dir, baseFromPath(relativePath))
  await fs.rename(full, unique.full)
  cache.delete(full)
  return { path: toPosix(path.relative(root, unique.full)) }
}

const SEARCH_FIELD_RANK: Record<SearchMatchField, number> = {
  title: 0,
  tags: 1,
  content: 2
}

function searchableBody(markdown: string): string {
  const lines = stripFrontmatter(markdown).body.split(/\r?\n/)
  const first = lines.findIndex((line) => line.trim())
  if (first !== -1 && /^\s{0,3}#{1,6}\s+/.test(lines[first])) {
    lines.splice(first, 1)
  }
  return plainTextFromMarkdown(lines.join('\n'))
}

export async function searchNotes(root: string, query: string): Promise<NoteSummary[]> {
  const { tags, text, date, dateEnd } = parseSearchQuery(query)
  const needle = text.toLowerCase()
  if (!tags.length && !needle && !date) return []
  const notes = await listNotes(root)
  const results: { note: NoteSummary; rank: number }[] = []

  for (const note of notes) {
    if (
      date &&
      (dateEnd
        ? note.createdAt < date || note.createdAt > dateEnd
        : note.createdAt !== date)
    ) {
      continue
    }
    if (tags.length) {
      const noteTags = new Set(note.tags.map((tag) => tag.toLowerCase()))
      if (!tags.every((tag) => noteTags.has(tag.toLowerCase()))) continue
    }
    if (needle) {
      const fullPath = path.join(root, note.path)
      const entry = cache.get(fullPath) ?? (await readEntry(fullPath))
      const body = searchableBody(entry.content)
      const titleMatches =
        countOccurrences(note.title, needle) +
        (note.base.toLowerCase() === note.title.toLowerCase()
          ? 0
          : countOccurrences(note.base, needle))
      const tagMatches = note.tags.reduce(
        (total, tag) => total + countOccurrences(tag, needle),
        0
      )
      const contentMatches = countOccurrences(body, needle)
      if (!titleMatches && !tagMatches && !contentMatches) continue

      const field: SearchMatchField = titleMatches
        ? 'title'
        : tagMatches
          ? 'tags'
          : 'content'
      results.push({
        note: {
          ...note,
          match: {
            field,
            occurrences: titleMatches + tagMatches + contentMatches,
            snippet: contentMatches ? searchSnippet(body, needle) : note.excerpt
          }
        },
        rank: SEARCH_FIELD_RANK[field]
      })
      continue
    }
    results.push({ note, rank: 0 })
  }

  results.sort(
    (a, b) =>
      a.rank - b.rank ||
      (b.note.match?.occurrences ?? 0) - (a.note.match?.occurrences ?? 0) ||
      b.note.updatedAt - a.note.updatedAt
  )
  return results.slice(0, 200).map((result) => result.note)
}

async function retagNotes(
  root: string,
  from: string,
  to: string | null
): Promise<TagChange[]> {
  const changes: TagChange[] = []
  for (const file of await walkNotes(root)) {
    try {
      const entry = await readEntry(file)
      const next = retagMarkdown(entry.content, from, to)
      if (next === entry.content) continue
      const relativePath = toPosix(path.relative(root, file))
      await writeNote(root, relativePath, next)
      changes.push({ path: relativePath, content: entry.content })
    } catch (error) {
      for (const change of changes.reverse()) {
        await writeNote(root, change.path, change.content).catch(() => {})
      }
      throw error
    }
  }
  return changes
}

export async function renameTag(
  root: string,
  from: string,
  to: string
): Promise<TagChange[]> {
  const target = normalizeTag(to)
  if (!target) return []
  return retagNotes(root, from, target)
}

export async function deleteTag(root: string, tag: string): Promise<TagChange[]> {
  return retagNotes(root, tag, null)
}

export async function saveImage(root: string, dataUrl: string): Promise<SavedImage> {
  const match = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,([a-zA-Z0-9+/=\s]+)$/.exec(dataUrl)
  if (!match) throw new Error('Image non reconnue.')

  const mime = match[1].toLowerCase()
  const ext = mime === 'jpeg' || mime === 'jpg' ? 'jpg' : mime === 'svg+xml' ? 'svg' : mime
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.byteLength > 30 * 1024 * 1024) throw new Error('Image trop volumineuse (30 Mo max).')

  const dir = path.join(root, ATTACHMENTS_DIR)
  await fs.mkdir(dir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const name = `img-${stamp}-${Math.random().toString(36).slice(2, 6)}.${ext}`
  await fs.writeFile(path.join(dir, name), buffer)

  return { relative: `${ATTACHMENTS_DIR}/${name}` }
}

export async function createSpace(root: string, name: string): Promise<void> {
  const safeName = normalizeSpace(name)
  if (!safeName) throw new Error('Nom de dossier invalide.')
  const target = path.join(root, NOTES_DIR, safeName)
  if (await pathExists(target)) throw new Error('Ce dossier existe déjà.')
  await fs.mkdir(target, { recursive: true })
}

export async function renameSpace(root: string, from: string, to: string): Promise<void> {
  const safeFrom = normalizeSpace(from)
  const safeTo = normalizeSpace(to)
  if (!safeFrom || !safeTo) throw new Error('Nom de dossier invalide.')
  const source = path.join(root, NOTES_DIR, safeFrom)
  const target = path.join(root, NOTES_DIR, safeTo)
  if (await pathExists(target)) throw new Error('Ce dossier existe déjà.')
  await fs.rename(source, target)
}

export async function trashSpace(root: string, name: string): Promise<TrashedSpace> {
  const safeName = normalizeSpace(name)
  if (!safeName) throw new Error('Nom de dossier invalide.')
  const source = path.join(root, NOTES_DIR, safeName)
  const trashRoot = path.join(root, TRASH_DIR)
  await fs.mkdir(trashRoot, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const target = path.join(trashRoot, `${stamp}-${safeName}`)
  await writeTrashMeta(target, {
    kind: 'space',
    name: safeName,
    title: safeName,
    originalPath: toPosix(path.relative(root, source)),
    deletedAt: Date.now()
  })
  try {
    await fs.rename(source, target)
  } catch (error) {
    await removeTrashMeta(target)
    throw error
  }
  return { trashPath: toPosix(path.relative(root, target)) }
}

export async function restoreSpace(
  root: string,
  trashPath: string,
  name: string
): Promise<void> {
  const safeName = normalizeSpace(name)
  if (!safeName) throw new Error('Nom de dossier invalide.')
  const source = trashAbsolutePath(root, trashPath)
  const target = path.join(root, NOTES_DIR, safeName)
  if (await pathExists(target)) throw new Error('Un dossier du même nom existe déjà.')
  await fs.rename(source, target)
  await removeTrashMeta(source)
}

export async function listTrash(root: string): Promise<TrashItem[]> {
  const trashRoot = path.join(root, TRASH_DIR)
  let entries
  try {
    entries = await fs.readdir(trashRoot, { withFileTypes: true })
  } catch {
    return []
  }

  const items: TrashItem[] = []
  for (const entry of entries) {
    if (entry.name.endsWith(TRASH_META_SUFFIX)) continue
    const full = path.join(trashRoot, entry.name)
    let stat
    try {
      stat = await fs.stat(full)
    } catch {
      continue
    }
    if (!stat.isFile() && !stat.isDirectory()) continue

    const meta = await readTrashMeta(full)
    const inferred = parseTrashName(entry.name)
    const kind = meta?.kind ?? (stat.isDirectory() ? 'space' : 'note')
    const name = meta?.name ?? inferred.name
    items.push({
      path: toPosix(path.relative(root, full)),
      kind,
      name,
      title: meta?.title ?? name.replace(/\.md$/i, ''),
      originalPath: meta?.originalPath ?? null,
      deletedAt: meta?.deletedAt ?? inferred.deletedAt ?? stat.mtimeMs
    })
  }

  return items.sort((a, b) => b.deletedAt - a.deletedAt)
}

export async function restoreTrash(
  root: string,
  trashPath: string
): Promise<TrashRestoreResult> {
  const source = trashAbsolutePath(root, trashPath)
  const stat = await fs.stat(source)
  const meta = await readTrashMeta(source)
  const inferred = parseTrashName(path.basename(source))
  const name = meta?.name ?? inferred.name

  if (stat.isDirectory()) {
    const safeName = normalizeSpace(name)
    if (!safeName) throw new Error('Nom de dossier invalide.')
    await fs.mkdir(path.join(root, NOTES_DIR), { recursive: true })
    const target = await uniqueSpacePath(path.join(root, NOTES_DIR), safeName)
    await fs.rename(source, target)
    await removeTrashMeta(source)
    return { path: toPosix(path.relative(root, target)) }
  }

  if (!stat.isFile()) throw new Error('Élément de corbeille invalide.')

  let target: string | null = null
  let originalPath = meta?.originalPath ?? null
  if (originalPath) {
    try {
      const candidate = noteAbsolutePath(root, originalPath)
      const dir = path.dirname(candidate)
      const base = path.basename(candidate).replace(/\.md$/i, '')
      await fs.mkdir(dir, { recursive: true })
      target = (await uniqueBasePath(dir, base)).full
    } catch {
      target = null
      originalPath = null
    }
  }

  if (!target) {
    const dir = path.join(root, NOTES_DIR)
    await fs.mkdir(dir, { recursive: true })
    const base = slugify(name.replace(/\.md$/i, '')) || 'Note'
    target = (await uniqueBasePath(dir, base)).full
  }

  await fs.rename(source, target)
  cache.delete(source)
  await removeTrashMeta(source)
  return { path: toPosix(path.relative(root, target)) }
}

export async function deleteTrash(root: string, trashPath: string): Promise<void> {
  const source = trashAbsolutePath(root, trashPath)
  await fs.rm(source, { recursive: true, force: true })
  await removeTrashMeta(source)
}

export async function cleanLinks(
  root: string,
  fromBases: string[],
  toBase: string | null,
  toTitle?: string
): Promise<LinkCleanup[]> {
  const bases = fromBases.map((base) => base.trim()).filter(Boolean)
  if (!bases.length) return []
  const changes: LinkCleanup[] = []
  for (const file of await walkNotes(root)) {
    const entry = await readEntry(file)
    if (!entry.content.includes('[[')) continue
    let next = entry.content
    for (const base of bases) next = rewriteWikiLinks(next, base, toBase, toTitle)
    if (next === entry.content) continue
    const relativePath = toPosix(path.relative(root, file))
    changes.push({ path: relativePath, content: entry.content })
    await writeNote(root, relativePath, next)
  }
  return changes
}
