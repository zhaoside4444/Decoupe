import { useEffect, useRef, useState } from 'react'
import { CornerDownLeft, Feather } from 'lucide-react'

export function QuickCapture() {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  async function save(): Promise<void> {
    const content = value.trim()
    if (!content || busy) return
    setBusy(true)
    try {
      await window.api.createNote('', content)
      await window.api.closeCapture()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="capture">
      <header className="capture-head">
        <span className="capture-title">
          <Feather size={13} /> Capture rapide
        </span>
        <span className="capture-hint">Ctrl+Entrée enregistrer · Échap fermer</span>
      </header>
      <textarea
        ref={ref}
        value={value}
        placeholder="Écrivez, collez, respirez…"
        spellCheck={false}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            void window.api.closeCapture()
          }
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault()
            void save()
          }
        }}
      />
      <footer className="capture-foot">
        <span>{value.trim() ? 'Boîte d’entrée' : ''}</span>
        <button type="button" className="capture-save" disabled={!value.trim() || busy} onClick={() => void save()}>
          <CornerDownLeft size={13} />
          Enregistrer
        </button>
      </footer>
    </div>
  )
}
