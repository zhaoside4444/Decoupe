// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Toast, type ToastState } from '../src/renderer/src/components/Toast'

function toast(overrides: Partial<ToastState> = {}): ToastState {
  return { id: 1, message: 'Note déplacée.', ...overrides }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Toast — affichage', () => {
  it('annonce le message et se ferme tout seul', () => {
    const onClose = vi.fn()
    render(<Toast toast={toast()} onClose={onClose} />)

    expect(screen.getByRole('status')).toHaveTextContent('Note déplacée.')
    expect(screen.queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument()

    act(() => vi.advanceTimersByTime(4999))
    expect(onClose).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('laisse plus de temps quand une action est proposée', () => {
    const onClose = vi.fn()
    render(
      <Toast
        toast={toast({ action: { label: 'Annuler', run: vi.fn() } })}
        onClose={onClose}
      />
    )

    act(() => vi.advanceTimersByTime(5000))
    expect(onClose).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(5000))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('Toast — actions', () => {
  it('exécute l’action puis ferme', () => {
    const onClose = vi.fn()
    const run = vi.fn()
    render(<Toast toast={toast({ action: { label: 'Annuler', run } })} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(run).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ferme avec le bouton dédié', () => {
    const onClose = vi.fn()
    render(<Toast toast={toast()} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('réarme le minuteur quand un nouveau toast arrive', () => {
    const onClose = vi.fn()
    const { rerender } = render(<Toast toast={toast()} onClose={onClose} />)

    act(() => vi.advanceTimersByTime(3000))
    rerender(<Toast toast={toast({ id: 2, message: 'Note restaurée.' })} onClose={onClose} />)

    act(() => vi.advanceTimersByTime(4999))
    expect(onClose).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
