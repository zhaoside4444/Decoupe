import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initVault, readOrder, writeOrder } from '../src/main/vault'

let root = ''

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'decoupe-order-'))
  await initVault(root)
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

async function writeOrderFile(value: unknown): Promise<void> {
  await fs.mkdir(path.join(root, '.decoupe'), { recursive: true })
  await fs.writeFile(
    path.join(root, '.decoupe', 'order.json'),
    JSON.stringify(value),
    'utf8'
  )
}

describe('ordre manuel du vault', () => {
  it('retourne un ordre vide quand le fichier est absent ou illisible', async () => {
    expect(await readOrder(root)).toEqual({})

    await fs.mkdir(path.join(root, '.decoupe'), { recursive: true })
    await fs.writeFile(path.join(root, '.decoupe', 'order.json'), '{pas du json', 'utf8')
    expect(await readOrder(root)).toEqual({})
  })

  it('écrit et relit l’ordre par espace', async () => {
    await writeOrder(root, {
      '': ['Notes/Journal.md'],
      Personnages: ['Notes/Personnages/Bob.md', 'Notes/Personnages/Alice.md']
    })

    expect(await readOrder(root)).toEqual({
      '': ['Notes/Journal.md'],
      Personnages: ['Notes/Personnages/Bob.md', 'Notes/Personnages/Alice.md']
    })
  })

  it('nettoie les entrées invalides, les doublons et les clés dangereuses', async () => {
    const payload = JSON.parse(
      '{"version":1,"spaces":{"":["Notes/A.md","Notes/A.md","Notes/../secret.md","C:/Windows/Notes/B.md","/Notes/C.md","Notes/D.txt","ailleurs/E.md","Notes/F.md"],"__proto__":["Notes/Prototype.md"]}}'
    ) as unknown
    await writeOrderFile(payload)

    const order = await readOrder(root)
    expect(order['']).toEqual(['Notes/A.md', 'Notes/F.md'])
    expect(Object.prototype.hasOwnProperty.call(order, '__proto__')).toBe(false)
    expect(Object.getPrototypeOf(order)).toBe(Object.prototype)
  })

  it('accepte un ancien fichier sans enveloppe versionnée', async () => {
    await writeOrderFile({ Personnages: ['Notes/Alice.md'] })
    expect(await readOrder(root)).toEqual({ Personnages: ['Notes/Alice.md'] })
  })

  it('sérialise les écritures concurrentes', async () => {
    await Promise.all([
      writeOrder(root, { Personnages: ['Notes/A.md'] }),
      writeOrder(root, { Personnages: ['Notes/B.md'], Chapitres: ['Notes/C.md'] })
    ])

    const order = await readOrder(root)
    expect(order.Chapitres).toEqual(['Notes/C.md'])
    expect(order.Personnages).toEqual(['Notes/B.md'])
  })
})
