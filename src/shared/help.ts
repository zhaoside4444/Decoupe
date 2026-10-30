export interface HelpInlineToken {
  text: string
  code: boolean
  strong: boolean
}

export type HelpBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'paragraph'; text: string }
  | { kind: 'rule' }

export interface HelpDocument {
  title: string
  blocks: HelpBlock[]
}

const INLINE_PATTERN = /(\*\*[^*]+\*\*|`[^`]+`)/g

/** Découpe une ligne en segments texte / code / gras. */
export function parseHelpInline(text: string): HelpInlineToken[] {
  const tokens: HelpInlineToken[] = []
  let index = 0
  for (const match of text.matchAll(INLINE_PATTERN)) {
    const start = match.index ?? 0
    if (start > index) {
      tokens.push({ text: text.slice(index, start), code: false, strong: false })
    }
    const raw = match[0]
    if (raw.startsWith('`')) {
      tokens.push({ text: raw.slice(1, -1), code: true, strong: false })
    } else {
      tokens.push({ text: raw.slice(2, -2), code: false, strong: true })
    }
    index = start + raw.length
  }
  if (index < text.length) {
    tokens.push({ text: text.slice(index), code: false, strong: false })
  }
  return tokens.filter((token) => token.text.length > 0)
}

/**
 * Parse le sous-ensemble Markdown utilisé par AIDE.md :
 * titres `#`/`##`/`###`, listes `-`, paragraphes et séparateurs `---`.
 * Le titre de niveau 1 devient `title` et n'apparaît pas dans les blocs.
 */
export function parseHelpMarkdown(markdown: string): HelpDocument {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: HelpBlock[] = []
  let title = ''
  let listItems: string[] | null = null
  let paragraph: string[] | null = null

  function flush(): void {
    if (listItems?.length) {
      blocks.push({ kind: 'list', items: listItems })
      listItems = null
    }
    if (paragraph?.length) {
      blocks.push({ kind: 'paragraph', text: paragraph.join(' ') })
      paragraph = null
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flush()
      continue
    }
    if (line === '---') {
      flush()
      blocks.push({ kind: 'rule' })
      continue
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      flush()
      const level = heading[1].length as 1 | 2 | 3
      const text = heading[2].trim()
      if (level === 1 && !title) title = text
      else blocks.push({ kind: 'heading', level, text })
      continue
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line)
    if (bullet) {
      if (paragraph) flush()
      if (!listItems) listItems = []
      listItems.push(bullet[1].trim())
      continue
    }
    if (listItems) flush()
    if (!paragraph) paragraph = []
    paragraph.push(line)
  }
  flush()
  return { title: title || 'Aide', blocks }
}
