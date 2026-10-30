import type { NoteSummary } from './types'

export const WIKI_SUGGESTION_LIMIT = 8

function fold(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function searchableFields(note: NoteSummary): string[] {
  return [fold(note.title), fold(note.base), fold(note.space)]
}

export function suggestWikiNotes(
  notes: NoteSummary[],
  query: string,
  excludePath: string,
  limit = WIKI_SUGGESTION_LIMIT
): NoteSummary[] {
  const tokens = fold(query)
    .split(/[\s/]+/)
    .filter(Boolean)

  if (!tokens.length) {
    return notes
      .filter((note) => note.path !== excludePath)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit)
  }

  const normalizedQuery = tokens.join(' ')
  const scored: { note: NoteSummary; score: number }[] = []

  for (const note of notes) {
    if (note.path === excludePath) continue
    const fields = searchableFields(note)
    const haystack = fields.join(' ')
    if (!tokens.every((token) => haystack.includes(token))) continue

    const [title, base, space] = fields
    let score = 3
    if (title === normalizedQuery || base === normalizedQuery) score = 0
    else if (title.startsWith(normalizedQuery) || base.startsWith(normalizedQuery)) score = 1
    else if (space.startsWith(normalizedQuery)) score = 2
    scored.push({ note, score })
  }

  return scored
    .sort((a, b) => a.score - b.score || b.note.updatedAt - a.note.updatedAt)
    .slice(0, limit)
    .map((entry) => entry.note)
}

export function hasExactWikiNote(
  notes: NoteSummary[],
  query: string,
  excludePath: string
): boolean {
  const needle = fold(query.trim())
  if (!needle) return false
  return notes.some(
    (note) =>
      note.path !== excludePath &&
      (fold(note.title.trim()) === needle || fold(note.base) === needle)
  )
}
