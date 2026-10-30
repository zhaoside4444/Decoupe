import type { NoteSummary } from './types'
import { baseFromPath, normalizeTag, spaceOfPath, uniqueTags } from './text'

export interface RelatedNote {
  path: string
  title: string
  base: string
  space: string
  updatedAt: number
  excerpt: string
  score: number
  sharedTags: string[]
  sharedLinks: string[]
  isDirectLink: boolean
}

export interface FindRelatedNotesParams {
  currentPath: string
  currentBase?: string
  currentTags?: string[]
  currentLinks?: string[]
  notes: NoteSummary[]
  maxResults?: number
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\\/g, '/')
}

export function findRelatedNotes({
  currentPath,
  currentBase,
  currentTags = [],
  currentLinks = [],
  notes,
  maxResults = 6
}: FindRelatedNotesParams): RelatedNote[] {
  const currentKey = normalizeKey(currentPath)
  const baseKey = (currentBase ?? baseFromPath(currentPath)).toLowerCase()
  const currentSpace = spaceOfPath(currentPath)

  const currentTagSet = new Set(
    currentTags.map((tag) => normalizeTag(tag).toLowerCase()).filter(Boolean)
  )

  const currentLinkSet = new Set(
    currentLinks.map((link) => link.trim().toLowerCase()).filter(Boolean)
  )

  const results: RelatedNote[] = []

  for (const other of notes) {
    const otherKey = normalizeKey(other.path)
    if (otherKey === currentKey || otherKey.includes('/.trash/')) continue

    const otherTags = (other.tags || []).map((tag) => normalizeTag(tag)).filter(Boolean)
    const sharedTags = uniqueTags(
      otherTags.filter((tag) => currentTagSet.has(tag.toLowerCase()))
    )

    const otherLinks = (other.links || []).map((link) => link.trim().toLowerCase()).filter(Boolean)
    const otherLinkSet = new Set(otherLinks)

    const sharedLinks = Array.from(
      new Set(otherLinks.filter((target) => currentLinkSet.has(target)))
    )

    const directOutbound = currentLinkSet.has(other.base.toLowerCase())
    const directInbound = otherLinkSet.has(baseKey)
    const isDirectLink = directOutbound || directInbound

    if (!sharedTags.length && !sharedLinks.length && !isDirectLink) continue

    let score = 0
    score += sharedTags.length * 2
    score += sharedLinks.length * 3
    if (isDirectLink) score += 4
    if (other.space && other.space === currentSpace) score += 1

    results.push({
      path: other.path,
      title: other.title || other.base,
      base: other.base,
      space: other.space,
      updatedAt: other.updatedAt,
      excerpt: other.excerpt || '',
      score,
      sharedTags,
      sharedLinks,
      isDirectLink
    })
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt
    return a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' })
  })

  return results.slice(0, Math.max(1, maxResults))
}

export function formatRelationReason(related: RelatedNote): string {
  const hasTags = related.sharedTags.length > 0
  const hasLinks = related.sharedLinks.length > 0

  if (hasTags && hasLinks) {
    const tagsCount = `${related.sharedTags.length} tag${related.sharedTags.length > 1 ? 's' : ''}`
    const linksCount = `${related.sharedLinks.length} lien${related.sharedLinks.length > 1 ? 's' : ''}`
    return `${tagsCount} et ${linksCount} en commun`
  }

  if (hasTags) {
    const count = `${related.sharedTags.length} tag${related.sharedTags.length > 1 ? 's' : ''} en commun`
    const preview = related.sharedTags.slice(0, 2).map((t) => `#${t}`).join(', ')
    const more = related.sharedTags.length > 2 ? '…' : ''
    return `${count} (${preview}${more})`
  }

  if (hasLinks) {
    const count = `${related.sharedLinks.length} lien${related.sharedLinks.length > 1 ? 's' : ''} en commun`
    const preview = related.sharedLinks.slice(0, 2).map((l) => `[[${l}]]`).join(', ')
    const more = related.sharedLinks.length > 2 ? '…' : ''
    return `${count} (${preview}${more})`
  }

  if (related.isDirectLink) {
    return 'Lien direct'
  }

  return 'Note liée'
}
