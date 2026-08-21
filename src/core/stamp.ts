import { execFileSync } from 'node:child_process'

export interface Stamp {
  sha: string
  dirty: boolean
}

/**
 * Render a version stamp for embedding in generated artifacts and debug logs.
 * A clean commit is its short sha; an uncommitted tree gets a `-dirty` suffix;
 * an unknown sha (git unavailable / not a repo) renders `unknown`.
 */
export function formatStamp(stamp: Stamp): string {
  if (!stamp.sha) return 'unknown'
  return stamp.dirty ? `${stamp.sha}-dirty` : stamp.sha
}

/**
 * Read the current git stamp for a repo. Never throws: if git is unavailable or
 * `cwd` is not a repository, returns an empty sha so `formatStamp` yields
 * `unknown` rather than failing a build.
 */
export function readGitStamp(cwd: string): Stamp {
  try {
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd, encoding: 'utf8' }).trim()
    const status = execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' })
    return { sha, dirty: status.trim().length > 0 }
  } catch {
    return { sha: '', dirty: false }
  }
}
