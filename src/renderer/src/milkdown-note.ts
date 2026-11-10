import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'

/** Souligne les liens wiki sans les transformer en nœuds du document. */
export const wikiLinkPlugin = $prose(
  () =>
    new Plugin({
      key: new PluginKey('decoupe-wiki-links'),
      props: {
        decorations(state) {
          const decorations: Decoration[] = []
          state.doc.descendants((node, pos) => {
            if (!node.isText || !node.text) return
            const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
            let match: RegExpExecArray | null
            while ((match = regex.exec(node.text))) {
              const from = pos + match.index
              const to = from + match[0].length
              decorations.push(
                Decoration.inline(from, to, {
                  class: 'wiki-link',
                  'data-target': match[1].trim(),
                  title: match[2]?.trim() || match[1].trim()
                })
              )
            }
          })
          return DecorationSet.create(state.doc, decorations)
        }
      }
    })
)

/** Interdit toute modification du document (lecture seule réelle, cases à cocher comprises). */
export const readOnlyPlugin = $prose(
  () => new Plugin({ filterTransaction: (transaction) => !transaction.docChanged })
)

/** Réécrit les chemins relatifs des images vers le protocole `vault://`. */
export function fixVaultImages(root: HTMLElement | null): void {
  if (!root) return
  root.querySelectorAll('img').forEach((img) => {
    const raw = img.getAttribute('src') ?? ''
    if (!raw || raw.startsWith('vault://') || raw.startsWith('data:')) return
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return
    const encoded = raw
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')
    img.src = `vault://files/${encoded}`
    img.loading = 'lazy'
  })
}
