import type { NoteSummary } from './types'
import { excerptFromMarkdown, findWikiLinks, stripFrontmatter } from './text'

export interface TimelineCharacter {
  path: string
  base: string
  title: string
  space: string
}

export interface TimelineChapter {
  path: string
  base: string
  title: string
  order: number
  label: string
  /** Résumé du contenu (2-3 lignes), affiché en info-bulle. */
  snippet: string
}

/** Origine d'une apparition : plus la valeur est prioritaire, plus le point est marqué. */
export type TimelineRelation = 'link' | 'tag' | 'mention'

/** Du plus fort au plus faible. */
export const RELATION_PRIORITY: TimelineRelation[] = ['link', 'tag', 'mention']

export interface TimelineData {
  characters: TimelineCharacter[]
  chapters: TimelineChapter[]
  /** Map de la base du personnage (minuscules) vers les index de chapitres où il apparaît. */
  appearances: Map<string, Set<number>>
  /** Même clé, vers les types de relation constatés pour chaque chapitre. */
  relations: Map<string, Map<number, TimelineRelation[]>>
}

/** Relation la plus significative d'une paire personnage × chapitre. */
export function strongestRelation(
  relations: TimelineRelation[] | undefined
): TimelineRelation | null {
  if (!relations || relations.length === 0) return null
  for (const relation of RELATION_PRIORITY) {
    if (relations.includes(relation)) return relation
  }
  return relations[0] ?? null
}

/** Extrait un numéro de chapitre depuis le frontmatter (champ chapter/chapitre). */
export function chapterFromFrontmatter(frontmatter: string): number | null {
  const normalized = stripFrontmatter(frontmatter).frontmatter
  const lines = normalized
    ? normalized.split(/\r?\n/)
    : frontmatter.split(/\r?\n/)
  for (const line of lines) {
    const match = /^\s*(?:chapter|chapitre)\s*:\s*(.*)$/i.exec(line)
    if (!match) continue
    const num = parseInt(match[1].trim().replace(/^['"]|['"]$/g, ''), 10)
    if (Number.isFinite(num)) return num
  }
  return null
}

function isCharacter(note: NoteSummary): boolean {
  const tags = (note.tags || []).map((t) => t.toLowerCase())
  if (tags.includes('personnage') || tags.includes('character')) return true
  if (note.space.toLowerCase() === 'personnages' || note.space.toLowerCase() === 'characters') return true
  return false
}

function isChapter(note: NoteSummary): boolean {
  const tags = (note.tags || []).map((t) => t.toLowerCase())
  if (tags.includes('chapitre') || tags.includes('chapter') || tags.includes('scene')) return true
  if (note.space.toLowerCase() === 'chapitres' || note.space.toLowerCase() === 'chapters') return true
  return false
}

function chapterOrder(note: NoteSummary, content: string): number {
  const fm = stripFrontmatter(content).frontmatter
  const num = chapterFromFrontmatter(fm)
  if (num !== null) return num

  // Fallback: extraire un numéro du titre (ex: "Chapitre 3", "Chapter 12")
  const titleMatch = /(?:chapitre|chapter|scène|scene)\s*(\d+)/i.exec(note.title)
  if (titleMatch) return parseInt(titleMatch[1], 10)

  // Fallback final: date de création (convertie en timestamp approximatif)
  if (note.createdAt) {
    const d = new Date(note.createdAt)
    if (!isNaN(d.getTime())) return d.getTime()
  }
  return 0
}

/** Neutralise les zones où une mention de nom n'a pas de sens narratif. */
function mentionBody(body: string): string {
  return body
    .replace(/```[\s\S]*?(?:```|$)/g, ' ')
    .replace(/~~~[\s\S]*?(?:~~~|$)/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/\[\[[^\]\n]*\]\]/g, ' ')
    .replace(/!?\[[^\]\n]*\]\([^)\n]*\)/g, ' ')
    .replace(/https?:\/\/[^\s]+/gi, ' ')
}

function mentionPattern(title: string): RegExp {
  const escaped = title
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+')
  return new RegExp(`(?<![\\p{L}\\p{N}_])(?:${escaped})(?![\\p{L}\\p{N}_])`, 'iu')
}

function addRelation(
  appearances: Map<string, Set<number>>,
  relations: Map<string, Map<number, TimelineRelation[]>>,
  base: string,
  chapterIndex: number,
  relation: TimelineRelation
): void {
  appearances.get(base)?.add(chapterIndex)
  const perChapter = relations.get(base)
  if (!perChapter) return
  const existing = perChapter.get(chapterIndex)
  if (!existing) {
    perChapter.set(chapterIndex, [relation])
    return
  }
  if (!existing.includes(relation)) existing.push(relation)
}

/**
 * Construit les données de timeline narrative à partir des notes du vault.
 * Les personnages sont les notes taguées #personnage ou dans l'espace "Personnages".
 * Les chapitres sont les notes taguées #chapitre ou dans l'espace "Chapitres".
 * Un personnage "apparaît" dans un chapitre via un lien wiki, un tag partagé
 * ou une simple mention de son nom dans le texte du chapitre.
 */
export function buildTimelineData(
  notes: NoteSummary[],
  noteContents: Map<string, string>
): TimelineData {
  const characters: TimelineCharacter[] = notes
    .filter(isCharacter)
    .map((n) => ({
      path: n.path,
      base: n.base,
      title: n.title || n.base,
      space: n.space
    }))

  const chapterNotes = notes.filter(isChapter)
  const chapters: TimelineChapter[] = chapterNotes
    .map((n) => {
      const content = noteContents.get(n.path) || ''
      return {
        path: n.path,
        base: n.base,
        title: n.title || n.base,
        order: chapterOrder(n, content),
        label: n.title || n.base,
        snippet: excerptFromMarkdown(content)
      }
    })
    .sort((a, b) => a.order - b.order)

  const charBaseSet = new Set(characters.map((c) => c.base.toLowerCase()))
  const notesByPath = new Map(notes.map((note) => [note.path, note]))
  const charTags = new Map<string, Set<string>>()
  const mentionPatterns = new Map<string, RegExp>()

  const appearances = new Map<string, Set<number>>()
  const relations = new Map<string, Map<number, TimelineRelation[]>>()
  for (const c of characters) {
    const base = c.base.toLowerCase()
    appearances.set(base, new Set())
    relations.set(base, new Map())
    charTags.set(
      base,
      new Set((notesByPath.get(c.path)?.tags || []).map((t) => t.toLowerCase()))
    )
  }

  for (let ci = 0; ci < chapters.length; ci++) {
    const chapter = chapters[ci]
    const note = notesByPath.get(chapter.path)
    const content = noteContents.get(chapter.path) || ''
    const body = stripFrontmatter(content).body
    const chapterTags = new Set((note?.tags || []).map((t) => t.toLowerCase()))

    // 1. Lien wiki explicite : [[Personnage]]
    for (const link of findWikiLinks(content)) {
      const target = link.target.trim().toLowerCase()
      if (charBaseSet.has(target)) addRelation(appearances, relations, target, ci, 'link')
    }

    // 2. Tag partagé entre la note du personnage et celle du chapitre (ou tag = nom du personnage)
    for (const character of characters) {
      const base = character.base.toLowerCase()
      const shared = Array.from(charTags.get(base) ?? []).some((tag) => chapterTags.has(tag))
      if (shared || chapterTags.has(base)) {
        addRelation(appearances, relations, base, ci, 'tag')
      }
    }

    // 3. Mention en texte brut, seulement si la paire n'est pas déjà reliée plus fortement.
    if (body.trim()) {
      const text = mentionBody(body)
      for (const character of characters) {
        const base = character.base.toLowerCase()
        if (appearances.get(base)?.has(ci)) continue
        let pattern = mentionPatterns.get(base)
        if (!pattern) {
          pattern = mentionPattern(character.title || character.base)
          mentionPatterns.set(base, pattern)
        }
        if (pattern.test(text)) addRelation(appearances, relations, base, ci, 'mention')
      }
    }
  }

  return { characters, chapters, appearances, relations }
}
