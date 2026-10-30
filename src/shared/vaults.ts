export const RECENT_VAULTS_LIMIT = 5

/** Place `path` en tête de la liste des dossiers récents, sans doublon. */
export function updateRecentVaults(
  recent: readonly string[],
  path: string,
  limit = RECENT_VAULTS_LIMIT
): string[] {
  const normalized = path.trim()
  if (!normalized) return recent.slice(0, limit)
  return [normalized, ...recent.filter((entry) => entry !== normalized)].slice(0, limit)
}

/** Dernier segment d'un chemin Windows ou POSIX, utilisé comme libellé. */
export function vaultBaseName(value: string): string {
  const parts = value.split(/[\\/]/).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : value
}
