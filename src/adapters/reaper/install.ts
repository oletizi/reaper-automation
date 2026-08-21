import { copyFileSync, mkdirSync, readdirSync, statSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

export interface InstallResult {
  keymap: string
  scripts: string[]
  /** Installed .lua files removed because the current build no longer emits them. */
  pruned: string[]
  /** Whether the keymap bytes differ from what was previously installed (a re-import is needed). */
  keymapChanged: boolean
}

export function installArtifacts(opts: {
  keymapPath: string
  scriptsDir?: string
  resourceDir: string
  keymapName?: string
  scriptSubdir?: string
}): InstallResult {
  const keymapName = opts.keymapName ?? 'LUNA (Pro Tools).ReaperKeyMap'
  const scriptSubdir = opts.scriptSubdir ?? 'luna'

  if (!statSync(opts.resourceDir).isDirectory()) {
    throw new Error(`${opts.resourceDir} is not a REAPER resource directory`)
  }

  const copiedScripts: string[] = []
  const pruned: string[] = []
  if (opts.scriptsDir) {
    const dst = join(opts.resourceDir, 'Scripts', scriptSubdir)
    mkdirSync(dst, { recursive: true })

    const incoming = readdirSync(opts.scriptsDir).filter((n) => n.endsWith('.lua'))
    const incomingSet = new Set(incoming)

    // Prune installed scripts the current build no longer emits, so the
    // installed set mirrors the build exactly (no stale, removed-feature scripts
    // lingering where they can silently keep firing).
    for (const name of readdirSync(dst)) {
      if (name.endsWith('.lua') && !incomingSet.has(name)) {
        const p = join(dst, name)
        rmSync(p)
        pruned.push(p)
      }
    }

    for (const name of incoming.sort()) {
      const to = join(dst, name)
      copyFileSync(join(opts.scriptsDir, name), to)
      copiedScripts.push(to)
    }
  }

  const keymaps = join(opts.resourceDir, 'KeyMaps')
  mkdirSync(keymaps, { recursive: true })
  const keymapDst = join(keymaps, keymapName)

  // Detect whether the bindings changed. A pure script-body change leaves the
  // keymap identical (scripts reload from disk on each run), so no re-import is
  // needed; a keymap-byte change means a key binding moved and REAPER must
  // re-import to see it.
  const incoming = readFileSync(opts.keymapPath, 'utf8')
  const keymapChanged = !existsSync(keymapDst) || readFileSync(keymapDst, 'utf8') !== incoming
  copyFileSync(opts.keymapPath, keymapDst)

  return { keymap: keymapDst, scripts: copiedScripts, pruned, keymapChanged }
}
