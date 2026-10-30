import { useState } from 'react'
import { AlertTriangle, FolderInput, RefreshCw, Save, X } from 'lucide-react'
import type { ExternalChange } from '@shared/external'
import { baseFromPath } from '@shared/text'

interface ExternalChangeDialogProps {
  change: ExternalChange
  onReload: () => Promise<void>
  onKeepLocal: () => Promise<void>
  onOpenMoved: () => Promise<void>
  onCloseNote: () => Promise<void>
}

export function ExternalChangeDialog({
  change,
  onReload,
  onKeepLocal,
  onOpenMoved,
  onCloseNote
}: ExternalChangeDialogProps) {
  const [pending, setPending] = useState<'primary' | 'secondary' | null>(null)
  const name = baseFromPath(change.path)
  const busy = pending !== null

  async function run(action: 'primary' | 'secondary', callback: () => Promise<void>): Promise<void> {
    if (busy) return
    setPending(action)
    try {
      await callback()
    } finally {
      setPending(null)
    }
  }

  let title = 'Modification externe'
  let description = `« ${name} » a été modifiée en dehors de Decoupe. Aucune modification n’a été écrasée.`
  let primaryLabel = 'Recharger'
  let secondaryLabel = 'Conserver ma version'
  let primaryIcon = <RefreshCw size={15} />
  let secondaryIcon = <Save size={15} />
  let primary = onReload
  let secondary = onKeepLocal

  if (change.kind === 'moved') {
    title = 'Note déplacée'
    description = `« ${name} » a été déplacée vers « ${change.movedTo ?? ''} » en dehors de Decoupe. Les modifications non enregistrées seront perdues si vous ouvrez la note déplacée.`
    primaryLabel = 'Ouvrir la note déplacée'
    secondaryLabel = 'Conserver ici'
    primaryIcon = <FolderInput size={15} />
    primary = onOpenMoved
  } else if (change.kind === 'deleted') {
    title = 'Note supprimée'
    description = `« ${name} » a été supprimée ou déplacée hors de Decoupe. Vous pouvez la recréer avec le contenu de l’éditeur ou la fermer.`
    primaryLabel = 'Recréer la note'
    secondaryLabel = 'Fermer la note'
    primaryIcon = <Save size={15} />
    secondaryIcon = <X size={15} />
    primary = onKeepLocal
    secondary = onCloseNote
  }

  return (
    <div className="trash-overlay external-overlay">
      <section
        className="trash-dialog external-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="external-title"
        aria-describedby="external-description"
      >
        <header className="external-head">
          <span className="external-icon" aria-hidden="true">
            <AlertTriangle size={18} />
          </span>
          <div>
            <h2 id="external-title">{title}</h2>
            <p id="external-description">{description}</p>
          </div>
        </header>
        <div className="external-note">
          L’enregistrement automatique est suspendu jusqu’à votre choix.
        </div>
        <div className="external-actions">
          <button
            type="button"
            className="backup-primary"
            disabled={busy}
            autoFocus
            onClick={() => void run('primary', primary)}
          >
            {primaryIcon}
            {pending === 'primary' ? 'Traitement…' : primaryLabel}
          </button>
          <button
            type="button"
            className="backup-secondary"
            disabled={busy}
            onClick={() => void run('secondary', secondary)}
          >
            {secondaryIcon}
            {pending === 'secondary' ? 'Traitement…' : secondaryLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
