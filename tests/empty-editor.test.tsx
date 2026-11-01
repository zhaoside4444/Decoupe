// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyEditor } from '../src/renderer/src/components/EmptyEditor'

describe('EmptyEditor', () => {
  it('invite à choisir ou créer une note', () => {
    render(<EmptyEditor onNew={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Une page blanche, rien d’autre.' })).toBeInTheDocument()
    expect(
      screen.getByText('Choisissez une note à gauche, ou commencez tout de suite.')
    ).toBeInTheDocument()
    expect(screen.getByText(/Ctrl\+Entrée fait la même chose/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nouvelle note/ })).toBeInTheDocument()
  })

  it('crée une note au clic', async () => {
    const user = userEvent.setup()
    const onNew = vi.fn()
    render(<EmptyEditor onNew={onNew} />)

    await user.click(screen.getByRole('button', { name: /Nouvelle note/ }))
    expect(onNew).toHaveBeenCalledTimes(1)
  })
})
