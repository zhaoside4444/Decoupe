import type { NoteSummary } from './types'
import { foldName } from './text'

export type NoteSortMode = 'modified' | 'created' | 'title'

export const SORT_MODES: NoteSortMode[] = ['modified', 'created', 'title']

export const SORT_LABELS: Record<NoteSortMode, string> = {
  modified: 'Modifiée',
  created: 'Créée',
  title: 'Titre A→Z'
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

/** Tri immuable : épinglées en tête, puis selon le mode choisi. */
export function sortNotes(notes: NoteSummary[], mode: NoteSortMode): NoteSummary[] {
  return [...notes].sort((a, b) => {
    const pinnedDelta = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
    return pinnedDelta !== 0 ? pinnedDelta : noteCompare(mode, a, b)
  })
}
