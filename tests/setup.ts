import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom n'implémente pas scrollIntoView, utilisé par la palette de commandes.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// Les tests de logique pure tournent en environnement node : ne nettoyer que si un DOM existe.
afterEach(() => {
  if (typeof document !== 'undefined') cleanup()
})
