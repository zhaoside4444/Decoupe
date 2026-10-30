import { useState } from 'react'
import { FolderOpen, NotebookPen, Scissors } from 'lucide-react'
import type { VaultInfo } from '@shared/types'
import { errorMessage } from '../util'

interface OnboardingProps {
  onReady: (vault: VaultInfo) => Promise<void>
  onError: (message: string) => void
}

export function Onboarding({ onReady, onError }: OnboardingProps) {
  const [busy, setBusy] = useState(false)

  async function pick(create: boolean): Promise<void> {
    if (busy) return
    setBusy(true)
    try {
      const vault = create ? await window.api.createVault() : await window.api.openVault()
      if (vault) await onReady(vault)
    } catch (error) {
      onError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-mark">
          <Scissors size={26} strokeWidth={2} />
        </div>
        <h1>Decoupe</h1>
        <p className="tagline">
          Prenez des notes sans réfléchir, découpez ce qui mérite sa propre page, rangez le reste
          d’un geste.
        </p>

        <div className="onboarding-actions">
          <button
            type="button"
            className="primary-btn"
            disabled={busy}
            onClick={() => void pick(true)}
          >
            <NotebookPen size={17} />
            Créer un dossier de notes
          </button>
          <button
            type="button"
            className="ghost-btn"
            disabled={busy}
            onClick={() => void pick(false)}
          >
            <FolderOpen size={17} />
            Ouvrir un dossier existant
          </button>
        </div>

        <ul className="onboarding-points">
          <li>Fichiers Markdown rangés sur votre disque, lisibles par Obsidian.</li>
          <li>Sélectionnez un passage, cliquez « Extraire » : il devient une note liée.</li>
          <li>Glissez une note sur une autre pour les fusionner, sans confirmation.</li>
        </ul>
      </div>
    </div>
  )
}
