import { describe, expect, it } from 'vitest'
import { moveListIndex, paletteMatches } from '../src/shared/nav'

describe('navigation clavier des listes', () => {
  it('part du premier élément vers le bas', () => {
    expect(moveListIndex(null, 'next', 5)).toBe(0)
  })

  it('part du dernier élément vers le haut', () => {
    expect(moveListIndex(null, 'prev', 5)).toBe(4)
  })

  it('avance et recule en restant dans les bornes', () => {
    expect(moveListIndex(0, 'next', 3)).toBe(1)
    expect(moveListIndex(2, 'next', 3)).toBe(2)
    expect(moveListIndex(1, 'prev', 3)).toBe(0)
    expect(moveListIndex(0, 'prev', 3)).toBe(0)
  })

  it('renvoie null pour une liste vide', () => {
    expect(moveListIndex(null, 'next', 0)).toBeNull()
    expect(moveListIndex(3, 'prev', 0)).toBeNull()
  })
})

describe('correspondance de la palette', () => {
  it('accepte tout quand la recherche est vide', () => {
    expect(paletteMatches('Nouvelle note', '')).toBe(true)
    expect(paletteMatches('Nouvelle note', '   ')).toBe(true)
  })

  it('ignore la casse et les accents', () => {
    expect(paletteMatches('Déplacer la note', 'deplacer')).toBe(true)
    expect(paletteMatches('Épingler la note', 'epingler')).toBe(true)
    expect(paletteMatches('Idées', 'idees')).toBe(true)
  })

  it('exige une sous-chaîne présente', () => {
    expect(paletteMatches('Sauvegardes locales', 'sauv')).toBe(true)
    expect(paletteMatches('Sauvegardes locales', 'corbeille')).toBe(false)
  })

  it('normalise les espaces multiples', () => {
    expect(paletteMatches('Nouvelle   note', 'nouvelle note')).toBe(true)
  })
})
