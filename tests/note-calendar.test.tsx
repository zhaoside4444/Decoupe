// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NoteCalendar } from '../src/renderer/src/components/NoteCalendar'
import { dateKey } from '../src/shared/text'

const OCTOBER = new Date(2026, 9, 1)

const counts = new Map<string, number>([
  ['2026-10-01', 1],
  ['2026-10-02', 12],
  ['2026-10-15', 2]
])

function renderCalendar(overrides: Partial<Parameters<typeof NoteCalendar>[0]> = {}) {
  const onMonthChange = vi.fn()
  const onSelect = vi.fn()
  const onClose = vi.fn()
  const view = render(
    <NoteCalendar
      month={OCTOBER}
      activeDate={null}
      counts={counts}
      onMonthChange={onMonthChange}
      onSelect={onSelect}
      onClose={onClose}
      {...overrides}
    />
  )
  return { ...view, onMonthChange, onSelect, onClose }
}

function dayButton(container: HTMLElement, day: number): HTMLButtonElement {
  const button = Array.from(
    container.querySelectorAll<HTMLButtonElement>('.calendar-day')
  ).find((candidate) => candidate.querySelector('span')?.textContent === String(day))
  if (!button) throw new Error(`Jour ${day} introuvable`)
  return button
}

describe('NoteCalendar — affichage', () => {
  it('affiche le mois, les jours et les compteurs', () => {
    const { container } = renderCalendar()

    expect(screen.getByRole('dialog', { name: 'Calendrier des notes' })).toBeInTheDocument()
    expect(screen.getByText('octobre 2026')).toBeInTheDocument()
    expect(container.querySelectorAll('.calendar-weekdays span')).toHaveLength(7)
    expect(container.querySelectorAll('.calendar-day')).toHaveLength(31)

    expect(dayButton(container, 1)).toBeEnabled()
    expect(dayButton(container, 1)).toHaveTextContent('1')
    expect(dayButton(container, 2)).toHaveTextContent('9+')
    expect(dayButton(container, 15)).toHaveTextContent('2')
    expect(dayButton(container, 3)).toBeDisabled()
    expect(dayButton(container, 3)).toHaveAttribute(
      'title',
      expect.stringContaining('aucune note')
    )
  })

  it('marque le jour actif et laisse effacer le filtre', async () => {
    const user = userEvent.setup()
    const { container, onSelect } = renderCalendar({ activeDate: '2026-10-15' })

    const active = dayButton(container, 15)
    expect(active).toHaveClass('is-active')
    expect(active).toHaveAttribute('aria-pressed', 'true')
    expect(dayButton(container, 1)).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'Effacer le filtre' }))
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('affiche le nombre de jours avec notes et masque l’effacement sans filtre', () => {
    renderCalendar()

    expect(screen.getByText('3 jours avec notes')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Effacer le filtre' })).not.toBeInTheDocument()
  })

  it('accorde le libellé au singulier', () => {
    renderCalendar({
      counts: new Map([['2026-10-01', 1]]),
      activeDate: '2026-10-01'
    })

    expect(screen.getByText('1 jour avec notes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Effacer le filtre' })).toBeInTheDocument()
  })

  it('marque la date du jour', () => {
    const today = new Date()
    const { container } = renderCalendar({ month: today, counts: new Map() })

    const key = dateKey(Date.now())
    const [year, month, day] = key.split('-').map(Number)
    expect(month).toBe(today.getMonth() + 1)
    expect(year).toBe(today.getFullYear())
    expect(dayButton(container, day)).toHaveClass('is-today')
  })
})

describe('NoteCalendar — navigation', () => {
  it('sélectionne un jour au clic', async () => {
    const user = userEvent.setup()
    const { container, onSelect } = renderCalendar()

    await user.click(dayButton(container, 2))
    expect(onSelect).toHaveBeenCalledWith('2026-10-02')
  })

  it('change de mois avec les flèches et ferme', async () => {
    const user = userEvent.setup()
    const { onMonthChange, onClose } = renderCalendar()

    await user.click(screen.getByRole('button', { name: 'Mois précédent' }))
    expect(onMonthChange).toHaveBeenLastCalledWith(-1)

    await user.click(screen.getByRole('button', { name: 'Mois suivant' }))
    expect(onMonthChange).toHaveBeenLastCalledWith(1)

    await user.click(screen.getByRole('button', { name: 'Fermer le calendrier' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('navigue au clavier entre les jours disponibles', async () => {
    const user = userEvent.setup()
    const { container, onMonthChange } = renderCalendar()

    dayButton(container, 1).focus()
    await user.keyboard('{ArrowRight}')
    expect(dayButton(container, 2)).toHaveFocus()

    await user.keyboard('{End}')
    expect(dayButton(container, 15)).toHaveFocus()

    await user.keyboard('{Home}')
    expect(dayButton(container, 1)).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(dayButton(container, 15)).toHaveFocus()

    await user.keyboard('{PageDown}')
    expect(onMonthChange).toHaveBeenLastCalledWith(1)

    await user.keyboard('{PageUp}')
    expect(onMonthChange).toHaveBeenLastCalledWith(-1)
  })

  it('ignore les flèches quand un modificateur est enfoncé', () => {
    const { container, onMonthChange } = renderCalendar()
    const grid = container.querySelector('.calendar-grid') as HTMLElement

    dayButton(container, 1).focus()
    fireEvent.keyDown(grid, { key: 'ArrowRight', ctrlKey: true })

    expect(dayButton(container, 1)).toHaveFocus()
    expect(onMonthChange).not.toHaveBeenCalled()
  })
})
