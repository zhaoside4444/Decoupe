export interface TableContext {
  row: number
  col: number
  rows: number
  cols: number
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
  const singleRow = rows <= 1
  const singleCol = cols <= 1

  return (
    <span
      className="table-tools"
      role="group"
      aria-label={`Tableau — ligne ${row + 1} sur ${rows}, colonne ${col + 1} sur ${cols}`}
    >
      <span className="table-tools-label" aria-hidden="true">
        Tableau {row + 1}·{col + 1}
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
          singleRow
            ? 'Le tableau doit garder au moins une ligne'
            : `Supprimer la ligne ${row + 1}`
        }
        aria-label={`Supprimer la ligne ${row + 1}`}
        disabled={singleRow}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onDeleteRow}
      >
        − Ligne
      </button>
      <button
        type="button"
        className="table-tools-btn is-danger"
        title={
          singleCol
            ? 'Le tableau doit garder au moins une colonne'
            : `Supprimer la colonne ${col + 1}`
        }
        aria-label={`Supprimer la colonne ${col + 1}`}
        disabled={singleCol}
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
