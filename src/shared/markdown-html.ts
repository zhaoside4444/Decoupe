import { stripFrontmatter } from './text'
import type { RelatedNote } from './related'
import { formatRelationReason } from './related'

export interface FullNoteContent {
  path: string
  title: string
  space: string
  createdAt: string
  updatedAt: number
  tags: string[]
  markdown: string
}

export interface PdfDocumentParams {
  title: string
  space: string
  createdAt: string
  updatedAt: number
  tags: string[]
  markdown: string
  themeMode: 'pastel' | 'monochrome'
  themeBg?: string
  themeAccent?: string
  includeMetadata: boolean
  relatedMode: 'none' | 'summary' | 'full'
  relatedSummaries?: RelatedNote[]
  relatedFullNotes?: FullNoteContent[]
  vaultRoot?: string
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInline(text: string, vaultRoot?: string): string {
  let output = escapeHtml(text)

  // Images : ![alt](src)
  output = output.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, src) => {
    let resolvedSrc = src
    if (vaultRoot && (src.startsWith('attachments/') || src.startsWith('/attachments/'))) {
      const clean = src.replace(/^\/+/, '')
      resolvedSrc = `file:///${vaultRoot.replace(/\\/g, '/')}/${clean}`
    } else if (vaultRoot && src.startsWith('vault://')) {
      const clean = src.replace(/^vault:\/\//, '').replace(/^\/+/, '')
      resolvedSrc = `file:///${vaultRoot.replace(/\\/g, '/')}/${clean}`
    }
    return `<img src="${resolvedSrc}" alt="${alt}" class="pdf-image" />`
  })

  // Wiki links : [[target|label]] or [[target]]
  output = output.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '<span class="pdf-wiki-link">$2</span>')
  output = output.replace(/\[\[([^\]]+)\]\]/g, '<span class="pdf-wiki-link">$1</span>')

  // Standard markdown links : [label](url)
  output = output.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="pdf-link" target="_blank">$1</a>'
  )

  // Code en ligne : `code`
  output = output.replace(/`([^`]+)`/g, '<code class="pdf-inline-code">$1</code>')

  // Gras : **texte** ou __texte__
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  output = output.replace(/__([^_]+)__/g, '<strong>$1</strong>')

  // Italique : *texte* ou _texte_
  output = output.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  output = output.replace(/_([^_]+)_/g, '<em>$1</em>')

  // Barré : ~~texte~~
  output = output.replace(/~~([^~]+)~~/g, '<del>$1</del>')

  return output
}

export function markdownToHtml(rawMarkdown: string, vaultRoot?: string): string {
  const { body } = stripFrontmatter(rawMarkdown)
  const lines = body.replace(/^\uFEFF/, '').split(/\r?\n/)
  const htmlParts: string[] = []

  let inCodeBlock = false
  let codeBlockLang = ''
  let codeBlockLines: string[] = []

  let inList: 'ul' | 'ol' | null = null
  let inBlockquote = false
  let blockquoteLines: string[] = []

  let inTable = false
  let tableRows: string[][] = []

  function closeList(): void {
    if (inList) {
      htmlParts.push(`</${inList}>`)
      inList = null
    }
  }

  function closeBlockquote(): void {
    if (inBlockquote) {
      const rendered = blockquoteLines.map((l) => renderInline(l, vaultRoot)).join('<br />')
      htmlParts.push(`<blockquote><p>${rendered}</p></blockquote>`)
      inBlockquote = false
      blockquoteLines = []
    }
  }

  function closeTable(): void {
    if (inTable && tableRows.length) {
      const header = tableRows[0]
      const bodyRows = tableRows.slice(1)
      let tableHtml = '<table class="pdf-table"><thead><tr>'
      for (const col of header) {
        tableHtml += `<th>${renderInline(col, vaultRoot)}</th>`
      }
      tableHtml += '</tr></thead><tbody>'
      for (const row of bodyRows) {
        tableHtml += '<tr>'
        for (const cell of row) {
          tableHtml += `<td>${renderInline(cell, vaultRoot)}</td>`
        }
        tableHtml += '</tr>'
      }
      tableHtml += '</tbody></table>'
      htmlParts.push(tableHtml)
      inTable = false
      tableRows = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Gestion des blocs de code ```
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        htmlParts.push(
          `<pre><code class="language-${escapeHtml(codeBlockLang)}">${escapeHtml(
            codeBlockLines.join('\n')
          )}</code></pre>`
        )
        inCodeBlock = false
        codeBlockLines = []
        codeBlockLang = ''
      } else {
        closeList()
        closeBlockquote()
        closeTable()
        inCodeBlock = true
        codeBlockLang = trimmed.slice(3).trim()
        codeBlockLines = []
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockLines.push(line)
      continue
    }

    // Gestion des citations >
    if (trimmed.startsWith('>')) {
      closeList()
      closeTable()
      inBlockquote = true
      blockquoteLines.push(trimmed.replace(/^>\s?/, ''))
      continue
    } else if (inBlockquote) {
      closeBlockquote()
    }

    // Gestion des tableaux Markdown
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      closeList()
      closeBlockquote()
      const isSeparator = /^\|[\s\-:|]+\|$/.test(trimmed)
      if (isSeparator) {
        // Ligne de séparation d'en-tête, ignorée
        continue
      }
      const cols = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim())
      inTable = true
      tableRows.push(cols)
      continue
    } else if (inTable) {
      closeTable()
    }

    // Ligne vide
    if (!trimmed) {
      closeList()
      closeBlockquote()
      closeTable()
      continue
    }

    // Titres Markdown
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed)
    if (headingMatch) {
      closeList()
      closeBlockquote()
      closeTable()
      const level = headingMatch[1].length
      const title = renderInline(headingMatch[2], vaultRoot)
      htmlParts.push(`<h${level}>${title}</h${level}>`)
      continue
    }

    // Filet horizontal --- ou ***
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      closeList()
      closeBlockquote()
      closeTable()
      htmlParts.push('<hr />')
      continue
    }

    // Listes de tâches : - [ ] ou - [x]
    const taskMatch = /^[-*]\s+\[([ xX])\]\s+(.*)$/.exec(trimmed)
    if (taskMatch) {
      if (inList !== 'ul') {
        closeList()
        inList = 'ul'
        htmlParts.push('<ul class="pdf-task-list">')
      }
      const checked = taskMatch[1].toLowerCase() === 'x'
      const itemText = renderInline(taskMatch[2], vaultRoot)
      htmlParts.push(
        `<li class="pdf-task-item ${checked ? 'is-checked' : ''}"><span class="pdf-task-box">${
          checked ? '☑' : '☐'
        }</span> <span>${itemText}</span></li>`
      )
      continue
    }

    // Listes non ordonnées : - ou *
    const unorderedMatch = /^[-*]\s+(.*)$/.exec(trimmed)
    if (unorderedMatch) {
      if (inList !== 'ul') {
        closeList()
        inList = 'ul'
        htmlParts.push('<ul>')
      }
      htmlParts.push(`<li>${renderInline(unorderedMatch[1], vaultRoot)}</li>`)
      continue
    }

    // Listes ordonnées : 1.
    const orderedMatch = /^(\d+)\.\s+(.*)$/.exec(trimmed)
    if (orderedMatch) {
      if (inList !== 'ol') {
        closeList()
        inList = 'ol'
        htmlParts.push('<ol>')
      }
      htmlParts.push(`<li>${renderInline(orderedMatch[2], vaultRoot)}</li>`)
      continue
    }

    // Fermeture de liste si paragraphe normal
    closeList()

    // Paragraphe classique
    htmlParts.push(`<p>${renderInline(trimmed, vaultRoot)}</p>`)
  }

  closeList()
  closeBlockquote()
  closeTable()

  if (inCodeBlock) {
    htmlParts.push(
      `<pre><code class="language-${escapeHtml(codeBlockLang)}">${escapeHtml(
        codeBlockLines.join('\n')
      )}</code></pre>`
    )
  }

  return htmlParts.join('\n')
}

function formatDateFr(timestampOrIso: number | string): string {
  try {
    const date = new Date(timestampOrIso)
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  } catch {
    return String(timestampOrIso)
  }
}

export function buildPdfDocumentHtml(params: PdfDocumentParams): string {
  const isPastel = params.themeMode === 'pastel'
  const bg = isPastel && params.themeBg ? params.themeBg : '#ffffff'
  const accent = isPastel && params.themeAccent ? params.themeAccent : '#2c2c2c'
  const ink = isPastel ? '#23201d' : '#111111'
  const inkMuted = isPastel ? '#686259' : '#555555'
  const line = isPastel ? '#e4ded4' : '#dddddd'
  const cardBg = isPastel ? '#ffffff' : '#fafafa'

  const mainHtml = markdownToHtml(params.markdown, params.vaultRoot)

  let summarySectionHtml = ''
  if (params.relatedMode === 'summary' && params.relatedSummaries?.length) {
    summarySectionHtml = `
      <section class="pdf-related-summary avoid-break">
        <h2 class="pdf-section-title">Notes liées</h2>
        <div class="pdf-related-summary-grid">
          ${params.relatedSummaries
            .map(
              (r) => `
            <div class="pdf-related-summary-card">
              <div class="pdf-card-head">
                <span class="pdf-card-title">${escapeHtml(r.title)}</span>
                <span class="pdf-card-space">${escapeHtml(r.space || 'Boîte d’entrée')}</span>
              </div>
              <div class="pdf-card-reason">${escapeHtml(formatRelationReason(r))}</div>
              ${r.excerpt ? `<p class="pdf-card-excerpt">${escapeHtml(r.excerpt)}</p>` : ''}
            </div>
          `
            )
            .join('')}
        </div>
      </section>
    `
  }

  let fullAnnexesHtml = ''
  if (params.relatedMode === 'full' && params.relatedFullNotes?.length) {
    fullAnnexesHtml = `
      <section class="pdf-annexes">
        ${params.relatedFullNotes
          .map(
            (note, idx) => `
          <div class="page-break"></div>
          <article class="pdf-annex-note">
            <header class="pdf-annex-head">
              <span class="pdf-annex-badge">Annexe ${idx + 1}</span>
              <h2 class="pdf-annex-title">${escapeHtml(note.title)}</h2>
              <div class="pdf-note-meta">
                <span>Dossier : ${escapeHtml(note.space || 'Boîte d’entrée')}</span>
                <span>·</span>
                <span>Modifiée le ${formatDateFr(note.updatedAt)}</span>
                ${
                  note.tags && note.tags.length
                    ? `<span>·</span> <span class="pdf-tags">${note.tags
                        .map((t) => `<span class="pdf-tag">#${escapeHtml(t)}</span>`)
                        .join(' ')}</span>`
                    : ''
                }
              </div>
            </header>
            <div class="pdf-body">
              ${markdownToHtml(note.markdown, params.vaultRoot)}
            </div>
          </article>
        `
          )
          .join('')}
      </section>
    `
  }

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(params.title)}</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
      @bottom-right {
        content: counter(page);
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 9pt;
        color: ${inkMuted};
      }
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.65;
      color: ${ink};
      background: ${bg};
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .pdf-container {
      max-width: 100%;
    }

    .pdf-header {
      margin-bottom: 22px;
      padding-bottom: 14px;
      border-bottom: 1.5px solid ${line};
    }

    h1.pdf-title {
      font-size: 23pt;
      font-weight: 700;
      line-height: 1.25;
      margin: 0 0 8px 0;
      color: ${ink};
    }

    .pdf-note-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      font-size: 9pt;
      color: ${inkMuted};
    }

    .pdf-tags {
      display: inline-flex;
      gap: 5px;
    }

    .pdf-tag {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      background: ${cardBg};
      border: 1px solid ${line};
      color: ${accent};
      font-size: 8.5pt;
      font-weight: 500;
    }

    .pdf-body {
      font-size: 11pt;
    }

    .pdf-body h1, .pdf-body h2, .pdf-body h3, .pdf-body h4 {
      color: ${ink};
      font-weight: 600;
      page-break-after: avoid;
    }

    .pdf-body h1 { font-size: 16pt; margin: 20px 0 10px; border-bottom: 1px solid ${line}; padding-bottom: 4px; }
    .pdf-body h2 { font-size: 13.5pt; margin: 16px 0 8px; }
    .pdf-body h3 { font-size: 12pt; margin: 14px 0 6px; }
    .pdf-body h4 { font-size: 11pt; margin: 12px 0 4px; }

    p {
      margin: 0 0 12px 0;
    }

    ul, ol {
      margin: 0 0 12px 0;
      padding-left: 24px;
    }

    li {
      margin-bottom: 4px;
    }

    .pdf-task-list {
      list-style: none;
      padding-left: 4px;
    }

    .pdf-task-item {
      display: flex;
      align-items: flex-start;
      gap: 7px;
      margin-bottom: 5px;
    }

    .pdf-task-box {
      font-size: 12pt;
      line-height: 1;
      color: ${accent};
    }

    blockquote {
      margin: 14px 0;
      padding: 8px 16px;
      border-left: 3.5px solid ${accent};
      background: ${cardBg};
      border-radius: 0 6px 6px 0;
      color: ${inkMuted};
      font-style: italic;
    }

    pre {
      background: ${cardBg};
      border: 1px solid ${line};
      border-radius: 6px;
      padding: 10px 14px;
      font-family: Consolas, "Courier New", monospace;
      font-size: 9.5pt;
      line-height: 1.45;
      overflow-x: auto;
      page-break-inside: avoid;
      margin: 14px 0;
    }

    code.pdf-inline-code {
      font-family: Consolas, "Courier New", monospace;
      font-size: 9.5pt;
      background: ${cardBg};
      border: 1px solid ${line};
      padding: 1px 4px;
      border-radius: 3px;
    }

    hr {
      border: none;
      border-top: 1px solid ${line};
      margin: 20px 0;
    }

    .pdf-wiki-link {
      color: ${accent};
      font-weight: 500;
      text-decoration: underline;
      text-decoration-thickness: 1px;
    }

    .pdf-link {
      color: ${accent};
      text-decoration: underline;
    }

    .pdf-table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      page-break-inside: avoid;
    }

    .pdf-table th, .pdf-table td {
      border: 1px solid ${line};
      padding: 7px 10px;
      font-size: 10pt;
      text-align: left;
    }

    .pdf-table th {
      background: ${cardBg};
      font-weight: 600;
    }

    .pdf-image {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      margin: 10px 0;
      page-break-inside: avoid;
    }

    /* Notes liées - Mode Synthèse */
    .pdf-related-summary {
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1.5px dashed ${line};
    }

    .pdf-section-title {
      font-size: 12pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: ${accent};
      margin: 0 0 14px 0;
    }

    .pdf-related-summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .pdf-related-summary-card {
      border: 1px solid ${line};
      background: ${cardBg};
      border-radius: 6px;
      padding: 10px 12px;
      page-break-inside: avoid;
    }

    .pdf-card-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 4px;
    }

    .pdf-card-title {
      font-size: 10.5pt;
      font-weight: 600;
      color: ${ink};
    }

    .pdf-card-space {
      font-size: 8.5pt;
      color: ${inkMuted};
    }

    .pdf-card-reason {
      font-size: 8.5pt;
      color: ${accent};
      font-weight: 500;
      margin-bottom: 4px;
    }

    .pdf-card-excerpt {
      font-size: 9pt;
      color: ${inkMuted};
      margin: 0;
      line-height: 1.35;
    }

    /* Annexes complètes */
    .page-break {
      page-break-before: always;
    }

    .avoid-break {
      page-break-inside: avoid;
    }

    .pdf-annex-note {
      padding-top: 12px;
    }

    .pdf-annex-head {
      margin-bottom: 18px;
      padding-bottom: 10px;
      border-bottom: 1px solid ${line};
    }

    .pdf-annex-badge {
      display: inline-block;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: ${accent};
      background: ${cardBg};
      border: 1px solid ${line};
      padding: 2px 7px;
      border-radius: 4px;
      margin-bottom: 6px;
    }

    h2.pdf-annex-title {
      font-size: 18pt;
      font-weight: 700;
      margin: 0 0 6px 0;
      color: ${ink};
    }
  </style>
</head>
<body>
  <div class="pdf-container">
    <header class="pdf-header">
      <h1 class="pdf-title">${escapeHtml(params.title)}</h1>
      ${
        params.includeMetadata
          ? `
        <div class="pdf-note-meta">
          <span>Dossier : ${escapeHtml(params.space || 'Boîte d’entrée')}</span>
          <span>·</span>
          <span>Créée le ${formatDateFr(params.createdAt)}</span>
          <span>·</span>
          <span>Modifiée le ${formatDateFr(params.updatedAt)}</span>
          ${
            params.tags && params.tags.length
              ? `<span>·</span> <span class="pdf-tags">${params.tags
                  .map((t) => `<span class="pdf-tag">#${escapeHtml(t)}</span>`)
                  .join(' ')}</span>`
              : ''
          }
        </div>
      `
          : ''
      }
    </header>

    <div class="pdf-body">
      ${mainHtml}
    </div>

    ${summarySectionHtml}
    ${fullAnnexesHtml}
  </div>
</body>
</html>`
}
