import type { NoteSummary } from './types'
import { baseFromPath, stripFrontmatter, wikiLinkSnippet } from './text'

export const MIN_MENTION_LENGTH = 4
export const MAX_MENTIONS = 50

export interface PlainMention {
  base: string
  title: string
  alias: string
  path: string
  index: number
  length: number
  snippet: string
}

export interface MentionGroup {
  base: string
  title: string
  count: number
  snippet: string
}

interface Interval {
  start: number
  end: number
}

function overlaps(ranges: Interval[], start: number, end: number): boolean {
  return ranges.some((range) => start < range.end && end > range.start)
}

function titlePattern(title: string): string {
  return title
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+')
}

function maskRanges(body: string): Interval[] {
  const ranges: Interval[] = []
  const patterns = [
    /```[\s\S]*?(?:```|$)/g,
    /~~~[\s\S]*?(?:~~~|$)/g,
    /`[^`\n]*`/g,
    /\[\[[^\]\n]*\]\]/g,
    /!?\[[^\]\n]*\]\([^)\n]*\)/g,
    /https?:\/\/[^\s]+/gi
  ]
  for (const source of patterns) {
    const regex = new RegExp(source.source, source.flags)
    let match: RegExpExecArray | null
    while ((match = regex.exec(body))) {
      if (!match[0]) break
      ranges.push({ start: match.index, end: match.index + match[0].length })
    }
  }
  return ranges
}

export function findPlainMentions(
  markdown: string,
  notes: NoteSummary[],
  currentPath: string
): PlainMention[] {
  const { body } = stripFrontmatter(markdown)
  if (!body.trim()) return []
  const bodyOffset = markdown.length - body.length
  if (bodyOffset < 0) return []

  const ranges = maskRanges(body)
  const currentBase = baseFromPath(currentPath).toLowerCase()
  interface Candidate {
    base: string
    title: string
    path: string
    size: number
  }
  const candidates = new Map<string, Candidate>()
  for (const note of notes) {
    if (note.path === currentPath) continue
    if (note.base.toLowerCase() === currentBase) continue
    const title = (note.title.trim() || note.base).trim()
    const size = Array.from(title).length
    if (size < MIN_MENTION_LENGTH) continue
    const key = note.base.toLowerCase()
    if (candidates.has(key)) continue
    candidates.set(key, { base: note.base, title, path: note.path, size })
  }
  const ordered = [...candidates.values()].sort((a, b) => b.size - a.size)

  const mentions: PlainMention[] = []
  for (const candidate of ordered) {
    if (mentions.length >= MAX_MENTIONS) break
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}_])(?:${titlePattern(candidate.title)})(?![\\p{L}\\p{N}_])`,
      'giu'
    )
    let match: RegExpExecArray | null
    while ((match = pattern.exec(body)) && mentions.length < MAX_MENTIONS) {
      const start = match.index
      const end = start + match[0].length
      if (overlaps(ranges, start, end)) continue
      ranges.push({ start, end })
      const index = start + bodyOffset
      const alias = match[0].includes('\n') ? candidate.title : match[0]
      mentions.push({
        base: candidate.base,
        title: candidate.title,
        alias,
        path: candidate.path,
        index,
        length: match[0].length,
        snippet: wikiLinkSnippet(markdown, index, match[0].length)
      })
    }
  }

  return mentions.sort((a, b) => a.index - b.index)
}

export function groupMentions(mentions: PlainMention[]): MentionGroup[] {
  const groups = new Map<string, MentionGroup>()
  for (const mention of mentions) {
    const key = mention.base.toLowerCase()
    const group = groups.get(key)
    if (group) {
      group.count += 1
      continue
    }
    groups.set(key, {
      base: mention.base,
      title: mention.title,
      count: 1,
      snippet: mention.snippet
    })
  }
  return [...groups.values()]
}
