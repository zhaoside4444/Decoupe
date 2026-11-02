export interface TableContext {
  row: number
  col: number
  rows: number
  cols: number
}

export function canDeleteTableRow(table: TableContext): boolean {
  // Le schéma GFM exige un en-tête suivi d'au moins une ligne de contenu.
  return table.rows > 2
}

export function canDeleteTableColumn(table: TableContext): boolean {
  return table.cols > 1
}

interface TableToolsProps extends TableContext {
  onAddRow: () => void
  onAddColumn: () => void
  onDeleteRow: () => void
  onDeleteColumn: () => void
  onDeleteTable: () => void
}

export function TableTools({
  row,
  col,
  rows,
  cols,
  onAddRow,
  onAddColumn,
  onDeleteRow,
  onDeleteColumn,
  onDeleteTable
}: TableToolsProps) {
  const table = { row, col, rows, cols }
  const deleteRow = canDeleteTableRow(table)
  const deleteColumn = canDeleteTableColumn(table)

  return (
    <span
      className="table-tools"
      role="group"
      aria-label={`Tableau ${cols} colonnes × ${rows} lignes — ligne ${row + 1}, colonne ${col + 1}`}
    >
      <span className="table-tools-label" aria-hidden="true">
        Tableau {cols}×{rows}
        <span className="table-tools-position">
          L{row + 1}·C{col + 1}
        </span>
      </span>
      <button
        type="button"
        className="table-tools-btn"
        title="Ajouter une ligne après la ligne courante"
        aria-label="Ajouter une ligne"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onAddRow}
      >
        + Ligne
      </button>
      <button
        type="button"
        className="table-tools-btn"
        title="Ajouter une colonne après la colonne courante"
        aria-label="Ajouter une colonne"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onAddColumn}
      >
        + Colonne
      </button>
      <button
        type="button"
        className="table-tools-btn is-danger"
        title={
          deleteRow
            ? `Supprimer la ligne ${row + 1}`
            : 'Le tableau doit garder une ligne sous l’en-tête'
        }
        aria-label={`Supprimer la ligne ${row + 1}`}
        disabled={!deleteRow}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onDeleteRow}
      >
        − Ligne
      </button>
      <button
        type="button"
        className="table-tools-btn is-danger"
        title={
          deleteColumn
            ? `Supprimer la colonne ${col + 1}`
            : 'Le tableau doit garder au moins une colonne'
        }
        aria-label={`Supprimer la colonne ${col + 1}`}
        disabled={!deleteColumn}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onDeleteColumn}
      >
        − Colonne
      </button>
      <button
        type="button"
        className="table-tools-btn is-danger"
        title="Supprimer tout le tableau"
        aria-label="Supprimer le tableau"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onDeleteTable}
      >
        − Tableau
      </button>
    </span>
  )
}
