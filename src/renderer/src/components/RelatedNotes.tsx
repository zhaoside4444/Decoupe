import { useState } from 'react'
import { ArrowUpRight, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import type { RelatedNote } from '@shared/related'
import { formatRelationReason } from '@shared/related'
import { formatDate } from '../util'

interface RelatedNotesProps {
  related: RelatedNote[]
  onOpenNote: (path: string) => void
  onTagFilter?: (tag: string) => void
}

export function RelatedNotes({
  related,
  onOpenNote,
  onTagFilter
}: RelatedNotesProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (!related.length) return null

  return (
    <section className="related-notes-section" aria-label="Notes liées">
      <header className="related-notes-head">
        <div className="related-notes-title">
          <Sparkles size={14} className="related-icon" />
          <h3>Notes liées</h3>
          <span className="related-count">{related.length}</span>
        </div>
        <button
          type="button"
          className="related-collapse-btn"
          aria-expanded={!collapsed}
          title={collapsed ? 'Déplier les notes liées' : 'Replier les notes liées'}
          aria-label={collapsed ? 'Déplier les notes liées' : 'Replier les notes liées'}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </header>

      {!collapsed && (
        <div className="related-notes-grid" role="list">
          {related.map((item) => (
            <div
              key={item.path}
              className="related-note-card"
              role="listitem"
              onClick={() => onOpenNote(item.path)}
            >
              <div className="related-card-top">
                <span className="related-card-title">{item.title}</span>
                <ArrowUpRight size={13} className="related-card-arrow" />
              </div>

              <div className="related-card-meta">
                <span className="related-space">{item.space || 'Boîte d’entrée'}</span>
                <span className="related-sep">·</span>
                <span className="related-date">{formatDate(item.updatedAt)}</span>
              </div>

              <div className="related-card-reasons">
                <span className="related-reason-text" title={formatRelationReason(item)}>
                  {formatRelationReason(item)}
                </span>
                {item.sharedTags.length > 0 && onTagFilter && (
                  <div className="related-tags-list">
                    {item.sharedTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="related-tag-chip"
                        title={`Filtrer par #${tag}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          onTagFilter(tag)
                        }}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {item.excerpt ? (
                <p className="related-card-excerpt">{item.excerpt}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
