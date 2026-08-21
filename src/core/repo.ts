import { fileURLToPath } from 'node:url'

/**
 * Absolute repo root, with a trailing separator, derived from this module's own
 * location. Kept in one place because it is relative to the source layout: every
 * module that recomputed it would have to be edited whenever a file moved between
 * directories, and a wrong count fails as a bad path rather than a loud error.
 */
export function repoRoot(): string {
  return fileURLToPath(new URL('../../', import.meta.url))
}
