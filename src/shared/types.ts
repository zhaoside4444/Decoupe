export type SearchMatchField = 'title' | 'tags' | 'content'

export interface SearchMatch {
  field: SearchMatchField
  occurrences: number
  snippet: string
}

export interface NoteSummary {
  path: string
  title: string
  base: string
  space: string
  createdAt: string
  updatedAt: number
  excerpt: string
  tags: string[]
  links?: string[]
  pinned?: boolean
  match?: SearchMatch
}

export interface Space {
  name: string
  count: number
}

export interface TagSummary {
  name: string
  count: number
}

export interface TagChange {
  path: string
  content: string
}

export interface VaultInfo {
  path: string
  name: string
}

export interface CreatedNote {
  path: string
  base: string
  title: string
}

export interface TrashedNote {
  trashPath: string
}

export interface TrashedSpace {
  trashPath: string
}

export interface TrashItem {
  path: string
  kind: 'note' | 'space'
  name: string
  title: string
  originalPath: string | null
  deletedAt: number
}

export interface TrashRestoreResult {
  path: string | null
}

export interface BackupEntry {
  id: string
  createdAt: number
  reason: string
  size: number
}

export interface BackupSettings {
  enabled: boolean
  intervalHours: number
  retention: number
}

export interface BackupOverview {
  entries: BackupEntry[]
  settings: BackupSettings
  directory: string
}

export interface LinkCleanup {
  path: string
  content: string
}

export interface BacklinkEntry {
  path: string
  base: string
  title: string
  space: string
  updatedAt: number
  occurrences: number
  snippet: string
}

export interface SelectionInfo {
  from: number
  to: number
  text: string
}

export interface SplitParts {
  before: string
  after: string
}

export interface SavedImage {
  relative: string
}
