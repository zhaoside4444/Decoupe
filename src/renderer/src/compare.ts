/** Préférences de la comparaison de deux notes (largeur du panneau de droite). */

export const COMPARE_RATIO_KEY = 'decoupe.compareRatio'
export const COMPARE_RATIO_DEFAULT = 0.46
export const COMPARE_RATIO_MIN = 0.28
export const COMPARE_RATIO_MAX = 0.68
export const COMPARE_RATIO_STEP = 0.02

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

/** Borne le ratio du panneau comparé, en retombant sur la valeur par défaut. */
export function clampCompareRatio(value: number): number {
  if (!Number.isFinite(value)) return COMPARE_RATIO_DEFAULT
  return Math.min(COMPARE_RATIO_MAX, Math.max(COMPARE_RATIO_MIN, value))
}

export function loadCompareRatio(): number {
  const store = storage()
  if (!store) return COMPARE_RATIO_DEFAULT
  try {
    const raw = store.getItem(COMPARE_RATIO_KEY)
    if (raw === null) return COMPARE_RATIO_DEFAULT
    const value = Number.parseFloat(raw)
    return Number.isFinite(value) ? clampCompareRatio(value) : COMPARE_RATIO_DEFAULT
  } catch {
    return COMPARE_RATIO_DEFAULT
  }
}

export function saveCompareRatio(value: number): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(COMPARE_RATIO_KEY, String(clampCompareRatio(value)))
  } catch {
    // Stockage indisponible : le ratio tient pour la session.
  }
}
