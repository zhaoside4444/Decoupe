import { Feather, Plus } from 'lucide-react'

interface EmptyEditorProps {
  onNew: () => void
}

export function EmptyEditor({ onNew }: EmptyEditorProps) {
  return (
    <div className="empty-editor">
      <Feather size={28} />
      <h2>Une page blanche, rien d’autre.</h2>
      <p>Choisissez une note à gauche, ou commencez tout de suite.</p>
      <button type="button" className="primary-btn" onClick={onNew}>
        <Plus size={16} />
        Nouvelle note
      </button>
      <span className="empty-hint">Ctrl+Entrée fait la même chose, où que vous soyez.</span>
    </div>
  )
}
