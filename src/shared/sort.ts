import type { NoteSummary } from './types'
import { foldName } from './text'

export type NoteSortMode = 'modified' | 'created' | 'title' | 'manual'

export const SORT_MODES: NoteSortMode[] = ['modified', 'created', 'title', 'manual']

export const SORT_LABELS: Record<NoteSortMode, string> = {
  modified: 'Modifiée',
  created: 'Créée',
  title: 'Titre A→Z',
  manual: 'Ordre manuel'
}

function noteCompare(mode: NoteSortMode, a: NoteSummary, b: NoteSummary): number {
  if (mode === 'created') {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
    return b.updatedAt - a.updatedAt
  }
  if (mode === 'title') {
    const byTitle = foldName(a.title).localeCompare(foldName(b.title), 'fr')
    if (byTitle !== 0) return byTitle
    return b.updatedAt - a.updatedAt
  }
  const byUpdate = b.updatedAt - a.updatedAt
  if (byUpdate !== 0) return byUpdate
  return foldName(a.title).localeCompare(foldName(b.title), 'fr')
}

export function isNoteSortMode(value: string | null): value is NoteSortMode {
  return value !== null && (SORT_MODES as string[]).includes(value)
}

/**
 * Ordre manuel : les notes présentes dans `order` suivent son rang, les autres
 * sont ajoutées à la fin de leur groupe, triées par modification récente.
 */
function sortManual(notes: NoteSummary[], order: readonly string[]): NoteSummary[] {
  const rank = new Map<string, number>()
  order.forEach((path, index) => {
    if (!rank.has(path)) rank.set(path, index)
  })
  const fallback = new Map(
    [...notes]
      .sort((a, b) => noteCompare('modified', a, b))
      .map((note, index) => [note.path, index] as const)
  )

  return [...notes].sort((a, b) => {
    const pinnedDelta = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
    if (pinnedDelta !== 0) return pinnedDelta
    const rankA = rank.get(a.path)
    const rankB = rank.get(b.path)
    if (rankA !== undefined && rankB !== undefined) return rankA - rankB
    if (rankA !== undefined) return -1
    if (rankB !== undefined) return 1
    return (fallback.get(a.path) ?? 0) - (fallback.get(b.path) ?? 0)
  })
}

/** Tri immuable : épinglées en tête, puis selon le mode choisi. */
export function sortNotes(
  notes: NoteSummary[],
  mode: NoteSortMode,
  order: readonly string[] = []
): NoteSummary[] {
  if (mode === 'manual') return sortManual(notes, order)
  return [...notes].sort((a, b) => {
    const pinnedDelta = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
    return pinnedDelta !== 0 ? pinnedDelta : noteCompare(mode, a, b)
  })
}
