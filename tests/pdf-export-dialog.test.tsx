// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PdfExportDialog, type PdfExportOptions } from '../src/renderer/src/components/PdfExportDialog'
import { DEFAULT_UI_SETTINGS } from '../src/shared/settings'
import type { NoteSummary } from '../src/shared/types'

const notes: NoteSummary[] = [
  {
    path: 'Notes/Personnages/Alice.md',
    title: 'Alice',
    base: 'Alice',
    space: 'Personnages',
    createdAt: '2026-10-01',
    updatedAt: 3,
    excerpt: 'Héroïne.',
    tags: ['personnage']
  },
  {
    path: 'Notes/Personnages/Bob.md',
    title: 'Bob',
    base: 'Bob',
    space: 'Personnages',
    createdAt: '2026-10-02',
    updatedAt: 2,
    excerpt: 'Allié.',
    tags: ['personnage']
  },
  {
    path: 'Notes/Lieux/Brumeval.md',
    title: 'Brumeval',
    base: 'Brumeval',
    space: 'Lieux',
    createdAt: '2026-10-03',
    updatedAt: 1,
    excerpt: 'Ville.',
    tags: ['lieu']
  }
]

const baseProps = {
  title: 'Alice',
  space: 'Personnages',
  createdAt: '2026-10-01',
  updatedAt: 3,
  tags: ['personnage'],
  notes,
  currentPath: 'Notes/Personnages/Alice.md',
  currentBase: 'Alice',
  currentLinks: [] as string[],
  uiSettings: DEFAULT_UI_SETTINGS
}

function renderDialog(overrides: Partial<typeof baseProps> = {}) {
  const onClose = vi.fn()
  const onExport = vi.fn(async (_options: PdfExportOptions) => {})
  render(
    <PdfExportDialog
      {...baseProps}
      {...overrides}
      onClose={onClose}
      onExport={onExport}
    />
  )
  return { onClose, onExport }
}

function exportButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Exporter en PDF' })
}

describe('PdfExportDialog — options', () => {
  it('ouvre sur la note seule, en pastel, avec les métadonnées', () => {
    renderDialog()

    expect(screen.getByRole('dialog', { name: 'Exporter en PDF' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Aucune \(note seule\)/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Thème pastel/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Inclure les métadonnées' })).toBeChecked()
  })

  it('désactive les options de notes liées quand il n’y en a aucune', () => {
    renderDialog({ notes: [notes[0]] })

    expect(screen.getByRole('radio', { name: /Index de synthèse/ })).toBeDisabled()
    expect(screen.getByRole('radio', { name: /Annexes complètes/ })).toBeDisabled()
  })

  it('exporte les valeurs par défaut', async () => {
    const user = userEvent.setup()
    const { onExport } = renderDialog()

    await user.click(exportButton())

    await waitFor(() =>
      expect(onExport).toHaveBeenCalledWith({
        relatedMode: 'none',
        selectedRelatedPaths: [],
        themeMode: 'pastel',
        includeMetadata: true
      })
    )
  })

  it('exporte les annexes avec les notes liées sélectionnées', async () => {
    const user = userEvent.setup()
    const { onExport } = renderDialog()

    await user.click(screen.getByRole('radio', { name: /Annexes complètes/ }))
    const bob = screen.getByRole('checkbox', { name: /Bob/ })
    expect(bob).toBeChecked()

    await user.click(exportButton())

    await waitFor(() =>
      expect(onExport).toHaveBeenCalledWith({
        relatedMode: 'full',
        selectedRelatedPaths: ['Notes/Personnages/Bob.md'],
        themeMode: 'pastel',
        includeMetadata: true
      })
    )
  })

  it('permet d’exclure une note liée des annexes', async () => {
    const user = userEvent.setup()
    const { onExport } = renderDialog()

    await user.click(screen.getByRole('radio', { name: /Annexes complètes/ }))
    await user.click(screen.getByRole('checkbox', { name: /Bob/ }))
    await user.click(exportButton())

    await waitFor(() =>
      expect(onExport).toHaveBeenCalledWith(
        expect.objectContaining({ relatedMode: 'full', selectedRelatedPaths: [] })
      )
    )
  })

  it('exporte en monochrome sans métadonnées', async () => {
    const user = userEvent.setup()
    const { onExport } = renderDialog()

    await user.click(screen.getByRole('radio', { name: /Épuré/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Inclure les métadonnées' }))
    await user.click(exportButton())

    await waitFor(() =>
      expect(onExport).toHaveBeenCalledWith(
        expect.objectContaining({ themeMode: 'monochrome', includeMetadata: false })
      )
    )
  })
})

describe('PdfExportDialog — fermeture', () => {
  it('ferme avec Échap et avec Annuler', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog()

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
