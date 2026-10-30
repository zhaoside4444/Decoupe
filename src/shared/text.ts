export const MAX_TITLE = 80
export const MAX_EXCERPT = 160
export const MAX_TAG = 40

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return value.slice(0, max - 1).trimEnd() + '…'
}

function cleanInline(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function stripFrontmatter(markdown: string): { frontmatter: string; body: string } {
  const lines = markdown.replace(/^\uFEFF/, '').split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return { frontmatter: '', body: markdown.replace(/^\uFEFF/, '') }

  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---') {
      return {
        frontmatter: lines.slice(0, index + 1).join('\n'),
        body: lines.slice(index + 1).join('\n').replace(/^\r?\n/, '')
      }
    }
  }
  return { frontmatter: '', body: markdown.replace(/^\uFEFF/, '') }
}

function frontmatterLines(frontmatter: string): string[] | null {
  const source = frontmatter.replace(/^\uFEFF/, '').trim()
  if (!source) return null
  const lines = source.split(/\r?\n/)
  if (lines[0]?.trim() !== '---' || lines[lines.length - 1]?.trim() !== '---') return null
  return lines.slice(1, -1)
}

function yamlTag(tag: string): string {
  return /^[A-Za-z0-9_./-]+$/.test(tag) ? tag : JSON.stringify(tag)
}

function yamlScalar(raw: string): string {
  let value = raw.trim()
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1)
  }
  return normalizeTag(value)
}

function yamlList(value: string): string[] {
  let inner = value.trim()
  if (!inner) return []
  if (inner.startsWith('[') && inner.endsWith(']')) inner = inner.slice(1, -1)
  const parts: string[] = []
  let current = ''
  let quote = ''
  for (const character of inner) {
    if (quote) {
      current += character
      if (character === quote) quote = ''
    } else if (character === '"' || character === "'") {
      quote = character
      current += character
    } else if (character === ',') {
      parts.push(current)
      current = ''
    } else {
      current += character
    }
  }
  if (current.trim()) parts.push(current)
  return parts.map(yamlScalar).filter(Boolean)
}

export function normalizeTag(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/^#+/, '')
    .trim()
    .replace(/[,;]+/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/[\[\]]/g, '')
    .slice(0, MAX_TAG)
    .replace(/^-+|-+$/g, '')
}

export function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of tags) {
    const tag = normalizeTag(raw)
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(tag)
  }
  return result
}

export function tagsFromFrontmatter(frontmatter: string): string[] {
  const normalized = stripFrontmatter(frontmatter).frontmatter
  const lines = frontmatterLines(normalized || frontmatter)
  if (!lines) return []
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^\s*tags?\s*:\s*(.*)$/i.exec(lines[index])
    if (!match) continue
    const value = match[1].trim()
    if (value) return uniqueTags(yamlList(value))
    const list: string[] = []
    let cursor = index + 1
    while (cursor < lines.length) {
      const item = /^\s*-\s+(.*)$/.exec(lines[cursor])
      if (!item) break
      list.push(item[1])
      cursor += 1
    }
    return uniqueTags(list)
  }
  return []
}

export function setFrontmatterTags(frontmatter: string, tags: string[]): string {
  const clean = uniqueTags(tags)
  const lines = frontmatterLines(frontmatter)
  if (!lines) {
    return clean.length ? `---\ntags: [${clean.map(yamlTag).join(', ')}]\n---` : ''
  }

  let start = -1
  let end = -1
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^\s*tags?\s*:/i.test(lines[index])) continue
    start = index
    end = index + 1
    while (end < lines.length && /^\s*-\s+/.test(lines[end])) end += 1
    break
  }

  const entry = clean.length ? `tags: [${clean.map(yamlTag).join(', ')}]` : null
  if (start >= 0) {
    lines.splice(start, end - start, ...(entry ? [entry] : []))
  } else if (entry) {
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
    lines.push(entry)
  }

  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  if (!lines.length) return ''
  return ['---', ...lines, '---'].join('\n')
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function dateKey(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function isDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1000) return false
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

export function createdFromFrontmatter(frontmatter: string): string | null {
  const normalized = stripFrontmatter(frontmatter).frontmatter
  const lines = frontmatterLines(normalized || frontmatter)
  if (!lines) return null
  for (const line of lines) {
    const match = /^\s*created\s*:\s*(.*)$/i.exec(line)
    if (!match) continue
    const date = /(\d{4}-\d{2}-\d{2})/.exec(match[1])?.[1]
    if (date && isDateKey(date)) return date
  }
  return null
}

export function setCreatedDate(frontmatter: string, date: string): string {
  if (!isDateKey(date)) return frontmatter
  const lines = frontmatterLines(frontmatter)
  const entry = `created: ${date}`
  if (!lines) return `---\n${entry}\n---`
  const index = lines.findIndex((line) => /^\s*created\s*:/i.test(line))
  if (index >= 0) {
    lines[index] = entry
  } else {
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
    lines.push(entry)
  }
  return ['---', ...lines, '---'].join('\n')
}

export function ensureCreatedDate(markdown: string, date: string): string {
  const { frontmatter, body } = stripFrontmatter(markdown)
  if (createdFromFrontmatter(frontmatter)) return markdown
  const updated = setCreatedDate(frontmatter, date)
  if (!updated) return body
  return body ? `${updated}\n\n${body}` : updated
}

export function pinnedFromFrontmatter(frontmatter: string): boolean {
  const normalized = stripFrontmatter(frontmatter).frontmatter
  const lines = frontmatterLines(normalized || frontmatter)
  if (!lines) return false
  for (const line of lines) {
    const match = /^\s*pinned\s*:\s*(.*)$/i.exec(line)
    if (!match) continue
    return /^(true|1|yes|oui|vrai|on)$/i.test(
      match[1].trim().replace(/^['"]|['"]$/g, '')
    )
  }
  return false
}

export function setFrontmatterPinned(frontmatter: string, pinned: boolean): string {
  const lines = frontmatterLines(frontmatter)
  if (!lines) return pinned ? '---\npinned: true\n---' : ''
  const index = lines.findIndex((line) => /^\s*pinned\s*:/i.test(line))
  if (pinned) {
    const entry = 'pinned: true'
    if (index >= 0) lines[index] = entry
    else {
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
      lines.push(entry)
    }
  } else if (index >= 0) {
    lines.splice(index, 1)
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
    if (!lines.length) return ''
  } else {
    return ['---', ...lines, '---'].join('\n')
  }
  if (!lines.length) return ''
  return ['---', ...lines, '---'].join('\n')
}

export function setPinned(markdown: string, pinned: boolean): string {
  const { frontmatter, body } = stripFrontmatter(markdown)
  if (pinnedFromFrontmatter(frontmatter) === pinned) return markdown
  const updated = setFrontmatterPinned(frontmatter, pinned)
  if (!updated) return body
  return body ? `${updated}\n\n${body}` : updated
}

export function foldName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function withTags(markdown: string, tags: string[]): string {
  const { frontmatter, body } = stripFrontmatter(markdown)
  const next = setFrontmatterTags(frontmatter, tags)
  if (!next) return body
  return `${next}\n\n${body}`
}

export function retagMarkdown(markdown: string, from: string, to: string | null): string {
  const key = normalizeTag(from).toLowerCase()
  const target = to === null ? null : normalizeTag(to)
  if (!key) return markdown
  const { frontmatter, body } = stripFrontmatter(markdown)
  const tags = tagsFromFrontmatter(frontmatter)
  let changed = false
  const next: string[] = []
  for (const tag of tags) {
    if (tag.toLowerCase() !== key) {
      next.push(tag)
      continue
    }
    changed = true
    if (target) next.push(target)
  }
  if (!changed) return markdown
  const updated = setFrontmatterTags(frontmatter, next)
  return updated ? `${updated}\n\n${body}` : body
}

export function mergeNoteMarkdown(target: string, source: string): string {
  const targetParts = stripFrontmatter(target)
  const sourceParts = stripFrontmatter(source)
  const tags = uniqueTags([
    ...tagsFromFrontmatter(targetParts.frontmatter),
    ...tagsFromFrontmatter(sourceParts.frontmatter)
  ])
  const frontmatter = setFrontmatterTags(targetParts.frontmatter, tags)
  const body = mergeMarkdown(targetParts.body, sourceParts.body)
  return frontmatter ? `${frontmatter}\n\n${body}` : body
}

export interface ParsedSearch {
  tags: string[]
  text: string
  date: string | null
  dateEnd: string | null
}

export type SearchFilterKind = 'tag' | 'date' | 'text'

interface DateFilter {
  date: string
  dateEnd: string | null
}

function parseDateFilter(token: string): DateFilter | null {
  const range = /^date:(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/i.exec(token)
  if (range && isDateKey(range[1]) && isDateKey(range[2]) && range[1] <= range[2]) {
    return { date: range[1], dateEnd: range[2] }
  }
  const single = /^date:(\d{4}-\d{2}-\d{2})$/i.exec(token)
  if (single && isDateKey(single[1])) return { date: single[1], dateEnd: null }
  return null
}

function tagFilterValue(token: string): string | null {
  if (token.startsWith('#')) return normalizeTag(token)
  if (/^tag:/i.test(token)) return normalizeTag(token.slice(4))
  return null
}

export function parseSearchQuery(query: string): ParsedSearch {
  const tags: string[] = []
  const terms: string[] = []
  let date: string | null = null
  let dateEnd: string | null = null
  for (const token of query.trim().split(/\s+/)) {
    if (!token) continue
    const tag = tagFilterValue(token)
    if (tag !== null) {
      if (tag) tags.push(tag)
      continue
    }
    const dateFilter = parseDateFilter(token)
    if (dateFilter) {
      date = dateFilter.date
      dateEnd = dateFilter.dateEnd
      continue
    }
    terms.push(token)
  }
  return { tags: uniqueTags(tags), text: terms.join(' '), date, dateEnd }
}

export function removeSearchFilter(
  query: string,
  kind: SearchFilterKind,
  value = ''
): string {
  const target = normalizeTag(value).toLowerCase()
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => {
      if (kind === 'tag') {
        const tag = tagFilterValue(token)
        return tag === null || tag.toLowerCase() !== target
      }
      if (kind === 'date') return !parseDateFilter(token)
      return tagFilterValue(token) !== null || Boolean(parseDateFilter(token))
    })
    .join(' ')
}

export function plainTextFromMarkdown(markdown: string): string {
  const body = stripFrontmatter(markdown)
    .body.replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm, '')
    .replace(/^\s*\[[ xX]\]\s*/gm, '')
  return cleanInline(body)
}

export function countOccurrences(text: string, needle: string): number {
  if (!needle) return 0
  const haystack = text.toLowerCase()
  const target = needle.toLowerCase()
  let count = 0
  let index = 0
  for (;;) {
    const found = haystack.indexOf(target, index)
    if (found === -1) return count
    count += 1
    index = found + Math.max(target.length, 1)
  }
}

export function searchSnippet(
  markdown: string,
  needle: string,
  max = MAX_EXCERPT
): string {
  const text = plainTextFromMarkdown(markdown)
  if (!text) return ''
  const index = text.toLowerCase().indexOf(needle.toLowerCase())
  if (index === -1) return truncate(text, max)

  const room = Math.max(20, max - needle.length)
  let start = Math.max(0, index - Math.floor(room * 0.45))
  let end = Math.min(text.length, start + max)
  if (start > 0) {
    const boundary = text.indexOf(' ', start)
    if (boundary !== -1 && boundary < index) start = boundary + 1
  }
  if (end < text.length) {
    const boundary = text.lastIndexOf(' ', end)
    if (boundary > index + needle.length) end = boundary
  }
  const prefix = start > 0 ? '… ' : ''
  const suffix = end < text.length ? ' …' : ''
  return `${prefix}${text.slice(start, end).trim()}${suffix}`
}

export function titleFromMarkdown(markdown: string): string {
  const lines = stripFrontmatter(markdown).body.split(/\r?\n/)
  for (const line of lines) {
    const clean = cleanInline(line.replace(/^\s{0,3}#{1,6}\s*/, ''))
    if (clean) return truncate(clean, MAX_TITLE)
  }
  return ''
}

export function excerptFromMarkdown(markdown: string): string {
  const withoutCode = stripFrontmatter(markdown)
    .body.replace(/```[\s\S]*?```/g, ' ')
  const lines = withoutCode.split(/\r?\n/)
  let titleSkipped = false
  const body: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!titleSkipped && trimmed) {
      titleSkipped = true
      continue
    }
    if (trimmed) {
      body.push(
        trimmed
          .replace(/^>\s?/, '')
          .replace(/^(?:[-+*]|\d+[.)])\s+/, '')
          .replace(/^\[[ xX]\]\s*/, '')
      )
    }
  }
  return truncate(cleanInline(body.join(' ')), MAX_EXCERPT)
}

export function slugify(input: string): string {
  const cleaned = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/g, '')

  const slug = cleaned
    .replace(/\s/g, '-')
    .slice(0, 60)
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^[^A-Za-z0-9]+/, '')
    .replace(/[^A-Za-z0-9]+$/, '')

  return slug || 'note'
}

export function baseFromPath(relativePath: string): string {
  const name = relativePath.split('/').pop() ?? relativePath
  return name.replace(/\.md$/i, '')
}

export function spaceOfPath(relativePath: string): string {
  const parts = relativePath.split('/')
  if (parts[0] !== 'Notes' || parts.length <= 2) return ''
  return parts[1]
}

export function wikiLink(base: string, title: string): string {
  const safeBase = base.replace(/[\]|]/g, ' ').replace(/\s+/g, ' ').trim() || 'note'
  const safeTitle = title.replace(/[\]|]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!safeTitle || safeTitle === safeBase) return `[[${safeBase}]]`
  return `[[${safeBase}|${safeTitle}]]`
}

export interface WikiLinkMatch {
  target: string
  label: string | null
  index: number
  length: number
}

export function findWikiLinks(markdown: string): WikiLinkMatch[] {
  const pattern = new RegExp(WIKI_LINK_PATTERN.source, 'g')
  const matches: WikiLinkMatch[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(markdown))) {
    const target = match[1].trim()
    if (!target) continue
    matches.push({
      target,
      label: match[2]?.trim() || null,
      index: match.index,
      length: match[0].length
    })
  }
  return matches
}

export function wikiLinkSnippet(
  markdown: string,
  index: number,
  length: number,
  radius = 70
): string {
  const lineStart = markdown.lastIndexOf('\n', Math.max(0, index - 1)) + 1
  let lineEnd = markdown.indexOf('\n', index + length)
  if (lineEnd === -1) lineEnd = markdown.length
  const start = Math.max(lineStart, index - radius)
  const end = Math.min(lineEnd, index + length + radius)
  const slice = markdown
    .slice(start, end)
    .replace(/^#{1,6}\s*/, '')
    .trim()
  if (!slice) return ''
  const text = cleanInline(slice)
  const prefix = start > lineStart ? '… ' : ''
  const suffix = end < lineEnd ? ' …' : ''
  return truncate(`${prefix}${text}${suffix}`, 190)
}

export function normalizeMarkdown(markdown: string): string {
  return markdown
    .replace(/\\\[\\\[/g, '[[')
    .replace(/\\\]\\\]/g, ']]')
    .replace(/&#x20;/g, ' ')
}

const WIKI_LINK_PATTERN = /\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g

export function rewriteWikiLinks(
  markdown: string,
  fromBase: string,
  toBase: string | null,
  toTitle?: string
): string {
  const from = fromBase.trim().toLowerCase()
  if (!from || !markdown.includes('[[')) return markdown
  return markdown.replace(WIKI_LINK_PATTERN, (match, target: string, label?: string) => {
    if (target.trim().toLowerCase() !== from) return match
    const alias = label?.trim()
    if (!toBase) return alias || target.trim()
    const display = alias || toTitle?.trim() || toBase
    return display === toBase ? `[[${toBase}]]` : `[[${toBase}|${display}]]`
  })
}

export function mergeMarkdown(target: string, source: string): string {
  const a = target.replace(/\s+$/, '')
  const b = source.replace(/^\s+/, '').replace(/\s+$/, '')
  if (!a) return b ? `${b}\n` : ''
  if (!b) return `${a}\n`
  return `${a}\n\n${b}\n`
}

export function splitMarkdownByBlocks(
  markdown: string,
  blockIndex: number
): { before: string; after: string } {
  const lines = markdown.split(/\r?\n/)
  const blocks: string[][] = []
  let current: string[] = []
  let fence = false

  for (const line of lines) {
    if (/^\s{0,3}(```|~~~)/.test(line)) fence = !fence
    if (!fence && !line.trim() && current.length) {
      blocks.push(current)
      current = []
      continue
    }
    if (!current.length && !line.trim()) continue
    current.push(line)
  }
  if (current.length) blocks.push(current)

  const index = Math.max(0, Math.min(blockIndex, blocks.length))
  const before = blocks.slice(0, index).map((b) => b.join('\n')).join('\n\n')
  const after = blocks.slice(index).map((b) => b.join('\n')).join('\n\n')
  return {
    before: before.trimEnd(),
    after: after.trimStart()
  }
}
