// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TableTools, type TableContext } from '../src/renderer/src/components/TableTools'

function renderTools(table: Partial<TableContext> = {}) {
  const props = {
    row: 1,
    col: 2,
    rows: 3,
    cols: 4,
    onAddRow: vi.fn(),
    onAddColumn: vi.fn(),
    onDeleteRow: vi.fn(),
    onDeleteColumn: vi.fn(),
    onDeleteTable: vi.fn(),
    ...table
  }
  const view = render(<TableTools {...props} />)
  return { ...props, container: view.container }
}

describe('TableTools', () => {
  it('annonce la position courante et les actions disponibles', () => {
    renderTools()

    expect(
      screen.getByRole('group', { name: 'Tableau — ligne 2 sur 3, colonne 3 sur 4' })
    ).toBeInTheDocument()
    expect(screen.getByText('Tableau 2·3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ajouter une ligne' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Ajouter une colonne' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Supprimer la ligne 2' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Supprimer la colonne 3' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Supprimer le tableau' })).toBeEnabled()
  })

  it('déclenche chaque action au clic sans voler la sélection', async () => {
    const user = userEvent.setup()
    const props = renderTools()

    for (const name of [
      'Ajouter une ligne',
      'Ajouter une colonne',
      'Supprimer la ligne 2',
      'Supprimer la colonne 3',
      'Supprimer le tableau'
    ]) {
      const button = screen.getByRole('button', { name })
      expect(fireEvent.mouseDown(button)).toBe(false)
      await user.click(button)
    }

    expect(props.onAddRow).toHaveBeenCalledTimes(1)
    expect(props.onAddColumn).toHaveBeenCalledTimes(1)
    expect(props.onDeleteRow).toHaveBeenCalledTimes(1)
    expect(props.onDeleteColumn).toHaveBeenCalledTimes(1)
    expect(props.onDeleteTable).toHaveBeenCalledTimes(1)
  })

  it('protège la dernière ligne et la dernière colonne', async () => {
    const user = userEvent.setup()
    const props = renderTools({ row: 0, col: 0, rows: 1, cols: 1 })

    const deleteRow = screen.getByRole('button', { name: 'Supprimer la ligne 1' })
    const deleteColumn = screen.getByRole('button', { name: 'Supprimer la colonne 1' })

    expect(deleteRow).toBeDisabled()
    expect(deleteRow).toHaveAttribute('title', 'Le tableau doit garder au moins une ligne')
    expect(deleteColumn).toBeDisabled()
    expect(deleteColumn).toHaveAttribute('title', 'Le tableau doit garder au moins une colonne')
    expect(screen.getByRole('button', { name: 'Supprimer le tableau' })).toBeEnabled()

    await user.click(deleteRow)
    await user.click(deleteColumn)
    expect(props.onDeleteRow).not.toHaveBeenCalled()
    expect(props.onDeleteColumn).not.toHaveBeenCalled()
  })
})
