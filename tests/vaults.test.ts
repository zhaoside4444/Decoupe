import { describe, expect, it } from 'vitest'
import { RECENT_VAULTS_LIMIT, updateRecentVaults, vaultBaseName } from '../src/shared/vaults'

describe('updateRecentVaults', () => {
  it('place le nouveau dossier en tête', () => {
    expect(updateRecentVaults(['C:\\a', 'C:\\b'], 'C:\\c')).toEqual(['C:\\c', 'C:\\a', 'C:\\b'])
  })

  it('remonte un dossier déjà présent sans créer de doublon', () => {
    expect(updateRecentVaults(['C:\\a', 'C:\\b'], 'C:\\b')).toEqual(['C:\\b', 'C:\\a'])
  })

  it('tronque à la limite demandée', () => {
    const recent = ['1', '2', '3', '4', '5']
    const updated = updateRecentVaults(recent, '6')
    expect(updated).toHaveLength(RECENT_VAULTS_LIMIT)
    expect(updated[0]).toBe('6')
    expect(updated).not.toContain('5')
  })

  it('ignore un chemin vide', () => {
    expect(updateRecentVaults(['C:\\a'], '   ')).toEqual(['C:\\a'])
  })
})

describe('vaultBaseName', () => {
  it('extrait le dernier segment d’un chemin Windows', () => {
    expect(vaultBaseName('C:\\Users\\Luxinlong\\Mes notes')).toBe('Mes notes')
  })

  it('extrait le dernier segment d’un chemin POSIX', () => {
    expect(vaultBaseName('/home/luxin/vault')).toBe('vault')
  })

  it('ignore un séparateur final', () => {
    expect(vaultBaseName('C:\\Users\\Luxinlong\\Mes notes\\')).toBe('Mes notes')
  })

  it('retourne la valeur brute si aucun segment', () => {
    expect(vaultBaseName('')).toBe('')
  })
})
