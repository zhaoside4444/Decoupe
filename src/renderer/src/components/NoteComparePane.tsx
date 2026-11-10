import { useEffect, useRef } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { Editor, defaultValueCtx, editorViewOptionsCtx, rootCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { listener } from '@milkdown/kit/plugin/listener'
import { stripFrontmatter } from '@shared/text'
import { fixVaultImages, readOnlyPlugin, wikiLinkPlugin } from '../milkdown-note'

interface NoteComparePaneProps {
  title: string
  space: string
  content: string
  loading: boolean
  error: string | null
  ratio: number
  onOpen: () => void
  onClose: () => void
  onLink: (target: string) => void
}

/**
 * Seconde note affichée en lecture seule à côté de l'éditeur.
 * Le rendu réutilise exactement les greffons Milkdown de l'éditeur ; les
 * transactions qui modifient le document sont bloquées, y compris les cases
 * à cocher des listes de tâches.
 */
export function NoteComparePane({
  title,
  space,
  content,
  loading,
  error,
  ratio,
  onOpen,
  onClose,
  onLink
}: NoteComparePaneProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const onLinkRef = useRef(onLink)
  const spaceLabel = space || 'Boîte d’entrée'
  const ready = !loading && !error

  useEffect(() => {
    onLinkRef.current = onLink
  }, [onLink])

  useEffect(() => {
    const root = rootRef.current
    if (!root || !ready) return
    let cancelled = false
    let editor: Editor | null = null
    let frame = 0

    const fix = (): void => fixVaultImages(root)
    const observer = new MutationObserver(() => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(fix)
    })

    const onClick = (event: MouseEvent): void => {
      const target = (event.target as HTMLElement | null)?.closest('.wiki-link')
      if (!target) return
      event.preventDefault()
      const name = target.getAttribute('data-target')
      if (name) onLinkRef.current(name)
    }

    root.replaceChildren()
    root.addEventListener('click', onClick)

    const setup = async (): Promise<void> => {
      const created = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root)
          ctx.set(defaultValueCtx, stripFrontmatter(content).body)
          ctx.set(editorViewOptionsCtx, { editable: () => false })
        })
        .use(commonmark)
        .use(gfm)
        .use(listener)
        .use(wikiLinkPlugin)
        .use(readOnlyPlugin)
        .create()
      if (cancelled) {
        void created.destroy()
        return
      }
      editor = created
      observer.observe(root, { childList: true, subtree: true })
      window.requestAnimationFrame(fix)
    }

    void setup()

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      root.removeEventListener('click', onClick)
      if (editor) void editor.destroy()
    }
  }, [content, ready])

  return (
    <aside
      className="compare-pane"
      aria-label={`Comparaison avec ${title}`}
      style={{ flexBasis: `${ratio * 100}%` }}
    >
      <header className="compare-head">
        <div className="crumb" title={`${spaceLabel} / ${title}`}>
          <span>{spaceLabel}</span>
          <span className="crumb-sep">/</span>
          <strong>{title}</strong>
        </div>
        <span className="compare-badge">Lecture seule</span>
        <div className="head-actions">
          <button
            type="button"
            className="icon-btn"
            title="Ouvrir cette note dans l’éditeur"
            aria-label={`Ouvrir ${title} dans l’éditeur`}
            onClick={onOpen}
          >
            <ArrowRight size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Fermer la comparaison"
            aria-label="Fermer la comparaison"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="compare-scroll">
        <div className="compare-page">
          {loading ? (
            <p className="compare-status">Chargement de la note…</p>
          ) : error ? (
            <p className="compare-status is-error">{error}</p>
          ) : (
            <div className="editor-root compare-root" ref={rootRef} />
          )}
        </div>
      </div>
    </aside>
  )
}
