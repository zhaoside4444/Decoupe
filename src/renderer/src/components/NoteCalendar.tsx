import { useRef, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { dateKey } from '@shared/text'
import { formatDateKey } from '../util'

interface NoteCalendarProps {
  month: Date
  activeDate: string | null
  counts: Map<string, number>
  onMonthChange: (offset: number) => void
  onSelect: (date: string | null) => void
  onClose: () => void
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export function NoteCalendar({
  month,
  activeDate,
  counts,
  onMonthChange,
  onSelect,
  onClose
}: NoteCalendarProps) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const offset = (first.getDay() + 6) % 7
  const today = dateKey(Date.now())
  const cells: (Date | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)
    )
  ]

  const gridRef = useRef<HTMLDivElement>(null)

  function handleGridKey(event: KeyboardEvent<HTMLDivElement>): void {
    const keys = [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown'
    ]
    if (!keys.includes(event.key)) return
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      onMonthChange(event.key === 'PageUp' ? -1 : 1)
      return
    }
    const days = Array.from(
      gridRef.current?.querySelectorAll<HTMLButtonElement>(
        'button.calendar-day:not(:disabled)'
      ) ?? []
    )
    if (!days.length) return
    event.preventDefault()
    const current = days.indexOf(document.activeElement as HTMLButtonElement)
    let next = 0
    if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = days.length - 1
    else {
      const step =
        event.key === 'ArrowLeft'
          ? -1
          : event.key === 'ArrowRight'
            ? 1
            : event.key === 'ArrowUp'
              ? -7
              : 7
      next = (current === -1 ? 0 : current) + step
    }
    days[Math.max(0, Math.min(next, days.length - 1))]?.focus()
  }

  return (
    <div className="calendar-popover" role="dialog" aria-label="Calendrier des notes">
      <div className="calendar-head">
        <button
          type="button"
          className="calendar-nav"
          onClick={() => onMonthChange(-1)}
          aria-label="Mois précédent"
        >
          <ChevronLeft size={14} />
        </button>
        <strong className="calendar-title">
          {month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </strong>
        <button
          type="button"
          className="calendar-nav"
          onClick={() => onMonthChange(1)}
          aria-label="Mois suivant"
        >
          <ChevronRight size={14} />
        </button>
        <button
          type="button"
          className="calendar-close"
          onClick={onClose}
          aria-label="Fermer le calendrier"
        >
          <X size={13} />
        </button>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>

      <div className="calendar-grid" ref={gridRef} onKeyDown={handleGridKey}>
        {cells.map((date, index) => {
          if (!date) return <span key={`blank-${index}`} className="calendar-blank" />
          const key = dateKey(date.getTime())
          const count = counts.get(key) ?? 0
          return (
            <button
              key={key}
              type="button"
              className={`calendar-day ${key === today ? 'is-today' : ''} ${
                key === activeDate ? 'is-active' : ''
              }`}
              disabled={!count}
              aria-pressed={key === activeDate}
              title={
                count
                  ? `${formatDateKey(key, true)} — ${count} note${count > 1 ? 's' : ''}`
                  : `${formatDateKey(key, true)} — aucune note`
              }
              onClick={() => onSelect(key)}
            >
              <span>{date.getDate()}</span>
              {count ? (
                <span className="calendar-count">{count > 9 ? '9+' : count}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="calendar-foot">
        <span>
          {counts.size} jour{counts.size > 1 ? 's' : ''} avec notes
        </span>
        {activeDate ? (
          <button
            type="button"
            className="calendar-clear"
            onClick={() => onSelect(null)}
          >
            Effacer le filtre
          </button>
        ) : null}
      </div>
    </div>
  )
}
