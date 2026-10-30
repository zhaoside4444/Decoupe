import { describe, expect, it } from 'vitest'
import { buildPdfDocumentHtml, markdownToHtml } from '../src/shared/markdown-html'

describe('markdownToHtml', () => {
  it('convertit les titres du Markdown en balises HTML', () => {
    const md = '# Titre 1\n## Titre 2\n### Titre 3'
    const html = markdownToHtml(md)
    expect(html).toContain('<h1>Titre 1</h1>')
    expect(html).toContain('<h2>Titre 2</h2>')
    expect(html).toContain('<h3>Titre 3</h3>')
  })

  it('gère le formatage en ligne (gras, italique, barré, code, liens wiki)', () => {
    const md = 'Texte avec **gras**, *italique*, ~~barré~~, `code` et [[Note Cible|Lien personnalisé]].'
    const html = markdownToHtml(md)
    expect(html).toContain('<strong>gras</strong>')
    expect(html).toContain('<em>italique</em>')
    expect(html).toContain('<del>barré</del>')
    expect(html).toContain('<code class="pdf-inline-code">code</code>')
    expect(html).toContain('<span class="pdf-wiki-link">Lien personnalisé</span>')
  })

  it('gère les blocs de code avec langage', () => {
    const md = '```typescript\nconst x: number = 42;\n```'
    const html = markdownToHtml(md)
    expect(html).toContain('<pre><code class="language-typescript">const x: number = 42;</code></pre>')
  })

  it('gère les listes à puces et les listes ordonnées', () => {
    const md = '- Item A\n- Item B\n\n1. Premier\n2. Deuxième'
    const html = markdownToHtml(md)
    expect(html).toContain('<ul>\n<li>Item A</li>\n<li>Item B</li>\n</ul>')
    expect(html).toContain('<ol>\n<li>Premier</li>\n<li>Deuxième</li>\n</ol>')
  })

  it('gère les listes de tâches cochées et non cochées', () => {
    const md = '- [ ] Tâche à faire\n- [x] Tâche terminée'
    const html = markdownToHtml(md)
    expect(html).toContain('pdf-task-list')
    expect(html).toContain('Tâche à faire')
    expect(html).toContain('is-checked')
    expect(html).toContain('Tâche terminée')
  })

  it('gère les citations blockquote', () => {
    const md = '> Citation ligne 1\n> Citation ligne 2'
    const html = markdownToHtml(md)
    expect(html).toContain('<blockquote><p>Citation ligne 1<br />Citation ligne 2</p></blockquote>')
  })

  it('gère les tableaux Markdown', () => {
    const md = '| Col 1 | Col 2 |\n|---|---|\n| Val 1 | Val 2 |'
    const html = markdownToHtml(md)
    expect(html).toContain('<table class="pdf-table">')
    expect(html).toContain('<th>Col 1</th>')
    expect(html).toContain('<td>Val 1</td>')
  })

  it('ignore le frontmatter', () => {
    const md = '---\ntitle: Mon Titre\ntags: [a, b]\n---\n\nCorps de note.'
    const html = markdownToHtml(md)
    expect(html).not.toContain('Mon Titre')
    expect(html).toContain('<p>Corps de note.</p>')
  })
})

describe('buildPdfDocumentHtml', () => {
  it('construit un document HTML complet avec en-tête et métadonnées', () => {
    const doc = buildPdfDocumentHtml({
      title: 'Ma Note de Projet',
      space: 'Travail',
      createdAt: '2026-10-01',
      updatedAt: 1729000000000,
      tags: ['projet', 'archi'],
      markdown: '# Introduction\n\nContenu.',
      themeMode: 'pastel',
      themeBg: '#f7f4ee',
      themeAccent: '#b4552f',
      includeMetadata: true,
      relatedMode: 'none'
    })

    expect(doc).toContain('<!doctype html>')
    expect(doc).toContain('Ma Note de Projet')
    expect(doc).toContain('Travail')
    expect(doc).toContain('#projet')
    expect(doc).toContain('<h1>Introduction</h1>')
  })

  it('inclut le sommaire des notes liées en mode summary', () => {
    const doc = buildPdfDocumentHtml({
      title: 'Note Principale',
      space: '',
      createdAt: '2026-10-01',
      updatedAt: 1729000000000,
      tags: [],
      markdown: 'Texte.',
      themeMode: 'monochrome',
      includeMetadata: false,
      relatedMode: 'summary',
      relatedSummaries: [
        {
          path: 'Notes/Related.md',
          title: 'Note Liée 1',
          base: 'Related',
          space: 'Projet',
          updatedAt: 1000,
          excerpt: 'Un extrait pertinent.',
          score: 8,
          sharedTags: ['web'],
          sharedLinks: [],
          isDirectLink: true
        }
      ]
    })

    expect(doc).toContain('Notes liées')
    expect(doc).toContain('Note Liée 1')
    expect(doc).toContain('Un extrait pertinent.')
  })

  it('inclut les annexes complètes en mode full', () => {
    const doc = buildPdfDocumentHtml({
      title: 'Note Principale',
      space: '',
      createdAt: '2026-10-01',
      updatedAt: 1729000000000,
      tags: [],
      markdown: 'Texte principal.',
      themeMode: 'pastel',
      includeMetadata: true,
      relatedMode: 'full',
      relatedFullNotes: [
        {
          path: 'Notes/Annexe.md',
          title: 'Document Annexe',
          space: 'Documentation',
          createdAt: '2026-10-02',
          updatedAt: 2000,
          tags: ['ref'],
          markdown: '# Détails de l annexe\n\nCorps de l annexe.'
        }
      ]
    })

    expect(doc).toContain('Annexe 1')
    expect(doc).toContain('Document Annexe')
    expect(doc).toContain('page-break')
    expect(doc).toContain('Détails de l annexe')
  })
})
