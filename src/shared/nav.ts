import { foldName } from './text'

/** Déplace un index de liste avec les flèches, en restant dans les bornes. */
export function moveListIndex(
  current: number | null,
  direction: 'next' | 'prev',
  length: number
): number | null {
  if (length <= 0) return null
  if (current === null) return direction === 'next' ? 0 : length - 1
  if (direction === 'next') return Math.min(current + 1, length - 1)
  return Math.max(current - 1, 0)
}

/** Correspondance de palette insensible à la casse et aux accents. */
export function paletteMatches(text: string, query: string): boolean {
  const needle = foldName(query.trim()).replace(/\s+/g, ' ')
  if (!needle) return true
  return foldName(text).replace(/\s+/g, ' ').includes(needle)
}
