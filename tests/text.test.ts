import { describe, expect, it } from 'vitest'
import {
  baseFromPath,
  countOccurrences,
  createdFromFrontmatter,
  dateKey,
  ensureCreatedDate,
  excerptFromMarkdown,
  isDateKey,
  mergeMarkdown,
  mergeNoteMarkdown,
  normalizeMarkdown,
  normalizeTag,
  parseSearchQuery,
  plainTextFromMarkdown,
  removeSearchFilter,
  retagMarkdown,
  rewriteWikiLinks,
  searchSnippet,
  setCreatedDate,
  setFrontmatterTags,
  slugify,
  spaceOfPath,
  splitMarkdownByBlocks,
  stripFrontmatter,
  tagsFromFrontmatter,
  titleFromMarkdown,
  uniqueTags,
  wikiLink,
  withTags
} from '../src/shared/text'

describe('titleFromMarkdown', () => {
  it('utilise la première ligne non vide sans le dièse', () => {
    expect(titleFromMarkdown('\n\n# Idée de note\n\nSuite')).toBe('Idée de note')
    expect(titleFromMarkdown('Titre simple')).toBe('Titre simple')
  })

  it('ignore les liens et la mise en forme', () => {
    expect(titleFromMarkdown('## Voir [[Autre note|le détail]] **vite**')).toBe(
      'Voir le détail vite'
    )
  })

  it('renvoie une chaîne vide pour un document vide', () => {
    expect(titleFromMarkdown('   \n\n')).toBe('')
  })
})

describe('excerptFromMarkdown', () => {
  it('retire le titre et la syntaxe', () => {
    const excerpt = excerptFromMarkdown('# Titre\n\nUn **passage** avec [un lien](https://x.y).')
    expect(excerpt).toBe('Un passage avec un lien.')
  })

  it('ignore les blocs de code', () => {
    const excerpt = excerptFromMarkdown('Titre\n\n```\nconst secret = 1\n```\n\nAprès')
    expect(excerpt).toBe('Après')
  })
})

describe('slugify', () => {
  it('crée un nom de fichier sûr', () => {
    expect(slugify('Idée : café / sucre')).toBe('Idee-cafe-sucre')
    expect(slugify('   ')).toBe('note')
    expect(slugify('a'.repeat(120)).length).toBeLessThanOrEqual(60)
  })

  it('supprime les caractères interdits', () => {
    expect(slugify('a<b>c:d"e/f\\g|h?i*j')).not.toMatch(/[<>:"/\\|?*]/)
  })

  it('nettoie les extrémités', () => {
    expect(slugify(' ici. ')).toBe('ici')
  })
})

describe('chemins', () => {
  it('déduit la base et l’espace', () => {
    expect(baseFromPath('Notes/Idée.md')).toBe('Idée')
    expect(spaceOfPath('Notes/Projets/Idée.md')).toBe('Projets')
    expect(spaceOfPath('Notes/Idée.md')).toBe('')
  })
})

describe('wikiLink', () => {
  it('ajoute un alias seulement si utile', () => {
    expect(wikiLink('Idee', 'Idee')).toBe('[[Idee]]')
    expect(wikiLink('Idee', 'Idée de chose')).toBe('[[Idee|Idée de chose]]')
  })

  it('neutralise les caractères structurants', () => {
    expect(wikiLink('base', 'a|b]c')).toBe('[[base|a b c]]')
  })
})

describe('normalizeMarkdown', () => {
  it('rétablit les liens wiki échappés par le sérialiseur', () => {
    expect(normalizeMarkdown('Voir \\[\\[Idee|mon idée]] ici')).toBe('Voir [[Idee|mon idée]] ici')
  })
})

describe('frontmatter', () => {
  it('sépare le frontmatter du corps', () => {
    const source = '---\ntags: [a, b]\n---\n\n# Titre\n\nCorps'
    const { frontmatter, body } = stripFrontmatter(source)
    expect(frontmatter).toBe('---\ntags: [a, b]\n---')
    expect(body).toBe('# Titre\n\nCorps')
  })

  it('ignore le frontmatter dans le titre et l’extrait', () => {
    const source = '---\ntags: [a]\n---\n\n# Vrai titre\n\nUn contenu.'
    expect(titleFromMarkdown(source)).toBe('Vrai titre')
    expect(excerptFromMarkdown(source)).toBe('Un contenu.')
  })
})

describe('tags', () => {
  it('normalise et déduplique les tags', () => {
    expect(normalizeTag('  #Mon projet ')).toBe('Mon-projet')
    expect(normalizeTag('###')).toBe('')
    expect(uniqueTags(['Idée', 'idée', ' Client ', ''])).toEqual(['Idée', 'Client'])
  })

  it('lit un tableau YAML inline ou multiligne', () => {
    expect(tagsFromFrontmatter('---\ntags: [Projet, "mon projet", #idee]\n---')).toEqual([
      'Projet',
      'mon-projet',
      'idee'
    ])
    expect(tagsFromFrontmatter('---\ntags:\n  - a\n  - b\n---')).toEqual(['a', 'b'])
  })

  it('lit les tags depuis une note complète', () => {
    expect(tagsFromFrontmatter('---\ntags: [a, b]\n---\n\n# Titre')).toEqual(['a', 'b'])
    expect(tagsFromFrontmatter('---\ntitle: Sans tag\n---\n\nCorps')).toEqual([])
  })

  it('écrit les tags sans perdre les autres clés', () => {
    expect(setFrontmatterTags('---\ntitle: Idée\ntags: [a, b]\n---', ['c'])).toBe(
      '---\ntitle: Idée\ntags: [c]\n---'
    )
    expect(setFrontmatterTags('---\ntitle: Idée\n---', ['a', 'b'])).toBe(
      '---\ntitle: Idée\ntags: [a, b]\n---'
    )
    expect(setFrontmatterTags('', ['mon projet'])).toBe('---\ntags: [mon-projet]\n---')
  })

  it('supprime le bloc quand il ne reste que des tags', () => {
    expect(setFrontmatterTags('---\ntags:\n  - a\n  - b\n---', [])).toBe('')
  })

  it('ajoute des tags au corps sans doublon', () => {
    expect(withTags('# Titre\n\nCorps', ['a', 'a'])).toBe(
      '---\ntags: [a]\n---\n\n# Titre\n\nCorps'
    )
  })
})

describe('retagMarkdown', () => {
  it('renomme un tag sans tenir compte de la casse', () => {
    const source = '---\ntitle: Test\ntags: [Projet, "Idée"]\n---\n\n# Titre\n\nCorps'
    expect(retagMarkdown(source, 'projet', 'Client')).toBe(
      '---\ntitle: Test\ntags: [Client, "Idée"]\n---\n\n# Titre\n\nCorps'
    )
  })

  it('supprime un tag et déduplique la cible', () => {
    expect(retagMarkdown('---\ntags: [a, b]\n---\n\nCorps', 'A', null)).toBe(
      '---\ntags: [b]\n---\n\nCorps'
    )
    expect(retagMarkdown('---\ntags: [a, b]\n---\n\nCorps', 'a', 'b')).toBe(
      '---\ntags: [b]\n---\n\nCorps'
    )
  })

  it('retire le frontmatter devenu vide et laisse le corps intact', () => {
    expect(retagMarkdown('---\ntags: [a]\n---\n\n# Titre', 'a', null)).toBe('# Titre')
  })

  it('ne modifie rien si le tag est absent', () => {
    const source = '---\ntags: [a]\ntitle: Test\n---\n\nCorps'
    expect(retagMarkdown(source, 'absent', 'b')).toBe(source)
  })
})

describe('recherche', () => {
  it('sépare les tags du texte libre', () => {
    expect(parseSearchQuery('#Projet #client facture')).toEqual({
      tags: ['Projet', 'client'],
      text: 'facture',
      date: null,
      dateEnd: null
    })
    expect(parseSearchQuery('tag:urgent #Maison')).toEqual({
      tags: ['urgent', 'Maison'],
      text: '',
      date: null,
      dateEnd: null
    })
    expect(parseSearchQuery('  #  ')).toEqual({
      tags: [],
      text: '',
      date: null,
      dateEnd: null
    })
  })

  it('extrait un filtre de date valide', () => {
    expect(parseSearchQuery('#Projet date:2026-10-23 facture')).toEqual({
      tags: ['Projet'],
      text: 'facture',
      date: '2026-10-23',
      dateEnd: null
    })
    expect(parseSearchQuery('date:2023-02-29')).toEqual({
      tags: [],
      text: 'date:2023-02-29',
      date: null,
      dateEnd: null
    })
  })

  it('lit une plage de dates et refuse les bornes inversées', () => {
    expect(parseSearchQuery('date:2026-10-01..2026-10-31 #projet')).toEqual({
      tags: ['projet'],
      text: '',
      date: '2026-10-01',
      dateEnd: '2026-10-31'
    })
    expect(parseSearchQuery('date:2026-11-01..2026-10-31')).toEqual({
      tags: [],
      text: 'date:2026-11-01..2026-10-31',
      date: null,
      dateEnd: null
    })
  })

  it('supprime un filtre individuellement', () => {
    const query = 'facture #Projet tag:client date:2026-10-01..2026-10-31'
    expect(removeSearchFilter(query, 'tag', 'projet')).toBe(
      'facture tag:client date:2026-10-01..2026-10-31'
    )
    expect(removeSearchFilter(query, 'date')).toBe('facture #Projet tag:client')
    expect(removeSearchFilter(query, 'text')).toBe(
      '#Projet tag:client date:2026-10-01..2026-10-31'
    )
  })

  it('prépare un texte de recherche lisible', () => {
    const markdown =
      '# Titre\n\n- Une liste\n\n> Une citation avec **facture**.\n\n`totales`\n\n```\nbloc\nfacture\n```'
    const text = plainTextFromMarkdown(markdown)
    expect(text).toBe('Titre Une liste Une citation avec facture. totales')
    expect(countOccurrences(text, 'fa')).toBe(1)
    expect(searchSnippet(markdown, 'facture')).toContain('citation avec facture.')
  })
})

describe('mergeNoteMarkdown', () => {
  it('fusionne les tags et retire le frontmatter de la source', () => {
    const target = '---\ntags: [a]\n---\n\n# Cible\n\nTexte'
    const source = '---\ntags: [b, a]\n---\n\n# Source\n\nSuite'
    expect(mergeNoteMarkdown(target, source)).toBe(
      '---\ntags: [a, b]\n---\n\n# Cible\n\nTexte\n\n# Source\n\nSuite\n'
    )
  })
})

describe('dates', () => {
  it('calcule une clé de date locale', () => {
    expect(dateKey(new Date(2026, 9, 23, 15, 30).getTime())).toBe('2026-10-23')
    expect(isDateKey('2024-02-29')).toBe(true)
    expect(isDateKey('2023-02-29')).toBe(false)
    expect(isDateKey('2026-13-01')).toBe(false)
  })

  it('lit et écrit la date de création', () => {
    expect(createdFromFrontmatter('---\ncreated: 2024-02-29\ntags: [a]\n---')).toBe(
      '2024-02-29'
    )
    expect(createdFromFrontmatter('---\ncreated: "2024-02-29T12:00:00Z"\n---')).toBe(
      '2024-02-29'
    )
    expect(createdFromFrontmatter('---\ntags: [a]\n---')).toBeNull()
    expect(setCreatedDate('---\ntitle: Test\n---', '2026-10-23')).toBe(
      '---\ntitle: Test\ncreated: 2026-10-23\n---'
    )
  })

  it('ajoute la date de création sans perdre le corps', () => {
    expect(ensureCreatedDate('# Titre\n\nCorps', '2026-10-23')).toBe(
      '---\ncreated: 2026-10-23\n---\n\n# Titre\n\nCorps'
    )
    const source = '---\ncreated: 2024-01-02\ntags: [a]\n---\n\nCorps'
    expect(ensureCreatedDate(source, '2026-10-23')).toBe(source)
  })
})

describe('rewriteWikiLinks', () => {
  it('réoriente les liens vers la note fusionnée', () => {
    const source = 'Voir [[idee]] et [[idee|mon idée]].'
    expect(rewriteWikiLinks(source, 'Idee', 'Projet', 'Grand projet')).toBe(
      'Voir [[Projet|Grand projet]] et [[Projet|mon idée]].'
    )
  })

  it('retire les liens sans toucher au texte', () => {
    const source = 'Voir [[idee]] et [[idee|mon idée]], pas [[autre]].'
    expect(rewriteWikiLinks(source, 'Idee', null)).toBe(
      'Voir idee et mon idée, pas [[autre]].'
    )
  })

  it('ignore la casse et ne touche pas aux autres liens', () => {
    const source = '[[IDÉE]] [[autre|Alias]]'
    expect(rewriteWikiLinks(source, 'idée', 'Suite', 'La suite')).toBe(
      '[[Suite|La suite]] [[autre|Alias]]'
    )
  })
})

describe('mergeMarkdown', () => {
  it('colle deux notes avec une ligne vide', () => {
    expect(mergeMarkdown('A\n', 'B\n')).toBe('A\n\nB\n')
  })

  it('gère les notes vides', () => {
    expect(mergeMarkdown('', 'B')).toBe('B\n')
    expect(mergeMarkdown('A', '   ')).toBe('A\n')
  })
})

describe('splitMarkdownByBlocks', () => {
  it('coupe avant le bloc demandé', () => {
    const result = splitMarkdownByBlocks('Bloc 1\n\nBloc 2\n\nBloc 3', 2)
    expect(result.before).toBe('Bloc 1\n\nBloc 2')
    expect(result.after).toBe('Bloc 3')
  })

  it('ne coupe pas à l’intérieur d’un bloc de code', () => {
    const markdown = 'Intro\n\n```\nA\n\nB\n```\n\nFin'
    const result = splitMarkdownByBlocks(markdown, 1)
    expect(result.before).toBe('Intro')
    expect(result.after).toContain('```')
  })
})
