export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Une erreur est survenue.'
  let message = error.message
  const marker = message.lastIndexOf('Error: ')
  if (message.startsWith('Error invoking remote method') && marker !== -1) {
    message = message.slice(marker + 7)
  }
  return message || 'Une erreur est survenue.'
}

/** Rend le focus à l'élément précédent si le panneau l'avait capté puis disparu. */
export function restoreFocusIfLost(previous: HTMLElement | null): void {
  if (!previous?.isConnected) return
  const active = document.activeElement
  if (active && active !== document.body) return
  previous.focus?.()
}

export function formatDateKey(value: string, long = false): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  if (
    !year ||
    !month ||
    !day ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return value
  }
  if (long) {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    ...(year === new Date().getFullYear() ? {} : { year: 'numeric' })
  })
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 o'
  const units = ['o', 'Ko', 'Mo', 'Go']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value.toLocaleString('fr-FR', {
    maximumFractionDigits: index === 0 ? 0 : 1
  })} ${units[index]}`
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const day = 24 * 60 * 60 * 1000

  if (startOfDate === startOfToday) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  if (startOfToday - startOfDate === day) return 'Hier'
  if (startOfToday - startOfDate < 6 * day) {
    return date.toLocaleDateString('fr-FR', { weekday: 'long' })
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  }
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
