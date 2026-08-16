import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export function installArtifacts(opts: {
  keymapPath: string
  scriptsDir?: string
  resourceDir: string
  keymapName?: string
  scriptSubdir?: string
}): { keymap: string; scripts: string[] } {
  const keymapName = opts.keymapName ?? 'LUNA (Pro Tools).ReaperKeyMap'
  const scriptSubdir = opts.scriptSubdir ?? 'luna'

  if (!statSync(opts.resourceDir).isDirectory()) {
    throw new Error(`${opts.resourceDir} is not a REAPER resource directory`)
  }

  const copiedScripts: string[] = []
  if (opts.scriptsDir) {
    const dst = join(opts.resourceDir, 'Scripts', scriptSubdir)
    mkdirSync(dst, { recursive: true })
    for (const name of readdirSync(opts.scriptsDir).sort()) {
      if (!name.endsWith('.lua')) continue
      const to = join(dst, name)
      copyFileSync(join(opts.scriptsDir, name), to)
      copiedScripts.push(to)
    }
  }

  const keymaps = join(opts.resourceDir, 'KeyMaps')
  mkdirSync(keymaps, { recursive: true })
  const keymapDst = join(keymaps, keymapName)
  copyFileSync(opts.keymapPath, keymapDst)

  return { keymap: keymapDst, scripts: copiedScripts }
}
