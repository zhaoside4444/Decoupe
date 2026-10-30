import type { NoteSummary } from './types'
import { baseFromPath } from './text'

export type ExternalChangeKind = 'modified' | 'moved' | 'deleted'

export interface ExternalChange {
  kind: ExternalChangeKind
  path: string
  movedTo?: string
}

export function detectExternalChange(
  path: string,
  notes: NoteSummary[],
  baseline: string | null,
  diskContent: string | null
): ExternalChange | null {
  if (baseline === null) return null
  const current = notes.find((note) => note.path === path)
  if (current) {
    if (diskContent === null || diskContent === baseline) return null
    return { kind: 'modified', path }
  }

  const base = baseFromPath(path).toLowerCase()
  const candidates = notes.filter((note) => note.base.toLowerCase() === base)
  if (candidates.length === 1) {
    return { kind: 'moved', path, movedTo: candidates[0].path }
  }
  return { kind: 'deleted', path }
}
