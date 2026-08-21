import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { repoRoot } from '@/core/repo'
import { parseMapping } from '@/adapters/reaper/mapping'
import { loadActions, ActionIndex } from '@/adapters/reaper/actions'
import { buildKeymap, type BuildResult } from '@/adapters/reaper/build-keymap'
import { parseTarget, hostTarget, type Target } from '@/core/target'
import { resolveResourceDir } from '@/adapters/reaper/paths'
import { detectReaTooledSection } from '@/adapters/reaper/reatooled'
import { readGitStamp, formatStamp } from '@/core/stamp'

export { repoRoot } from '@/core/repo'

/**
 * PATH prefix (colon-separated bin dirs) to bake into the reload button so it
 * can find node/pnpm from inside REAPER's GUI environment, which does not
 * inherit the interactive shell PATH. Detected from the running node binary and
 * a best-effort `command -v pnpm`.
 */
export function detectReloadPathPrefix(): string {
  const dirs = new Set<string>()
  dirs.add(dirname(process.execPath)) // node's bin dir (pnpm usually sits alongside)
  try {
    const pnpm = execFileSync('sh', ['-lc', 'command -v pnpm'], { encoding: 'utf8' }).trim()
    if (pnpm) dirs.add(dirname(pnpm))
  } catch {
    // pnpm not resolvable in this shell; node's bin dir is the high-confidence fallback
  }
  return [...dirs].join(':')
}

export interface RunBuildOptions {
  mapping: string
  out: string
  target?: string
  section?: number
}

export interface RunBuildOutput {
  result: BuildResult
  keymapPath: string
  scriptsDir: string
  section: number
  target: Target
  detected: boolean
  stamp: string
}

/**
 * The build core shared by the `build` and `refresh` verbs: resolve target and
 * section, bake the git stamp + repo root, build, then clean-write the keymap
 * and its scripts (removing stale *.lua so the build dir mirrors this build).
 */
export function runBuild(opts: RunBuildOptions): RunBuildOutput {
  const root = repoRoot()
  const target: Target = opts.target ? parseTarget(opts.target) : hostTarget()
  const mapping = parseMapping(readFileSync(opts.mapping, 'utf8'))
  const idx = new ActionIndex(loadActions())

  let section = opts.section
  let detected = false
  if (section === undefined) {
    const kb = join(resolveResourceDir(), 'reaper-kb.ini')
    section = existsSync(kb) ? detectReaTooledSection(readFileSync(kb, 'utf8')) : 0
    detected = section === 16
  }

  const stamp = formatStamp(readGitStamp(root))
  const result = buildKeymap(mapping, idx, target, section, {
    stamp,
    repoRoot: root,
    reloadPathPrefix: detectReloadPathPrefix(),
  })

  mkdirSync(dirname(opts.out), { recursive: true })
  writeFileSync(opts.out, result.keymapText)

  const scriptsDir = join(dirname(opts.out), 'Scripts', 'luna')
  mkdirSync(scriptsDir, { recursive: true })
  // Clean slate: drop stale *.lua from a previous build so the dir mirrors this one.
  for (const name of readdirSync(scriptsDir)) {
    if (name.endsWith('.lua') && !result.scripts.has(name)) rmSync(join(scriptsDir, name))
  }
  for (const [name, src] of result.scripts) writeFileSync(join(scriptsDir, name), src)

  return { result, keymapPath: opts.out, scriptsDir, section, target, detected, stamp }
}

/** Read the version stamp a built/installed tree carries (its luna_stamp.lua). */
export function readInstalledStamp(scriptsDir: string): string {
  const p = join(scriptsDir, 'luna_stamp.lua')
  if (!existsSync(p)) return ''
  const m = readFileSync(p, 'utf8').match(/return\s+"((?:[^"\\]|\\.)*)"/)
  return m ? m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') : ''
}
