import { join, dirname } from 'node:path'
import { installArtifacts } from '@/adapters/reaper/install'
import { resolveResourceDir } from '@/adapters/reaper/paths'
import { parseInstall } from '@/cli/args'
import { hostTarget } from '@/core/target'
import { fileURLToPath } from 'node:url'

/**
 * The artifact `install` stages when no --keymap is given: the one built for
 * this host, matching build/refresh/doctor. A hardcoded macos default would
 * silently stage mac-modifier bindings (and the builder's baked --section) on a
 * Linux host.
 */
export function defaultKeymapPath(platform?: NodeJS.Platform): string {
  return fileURLToPath(new URL(`../../build/luna-${hostTarget(platform)}.ReaperKeyMap`, import.meta.url))
}

export function cmdInstall(argv: string[]): number {
  const a = parseInstall(argv)
  const keymap = a.keymap ?? defaultKeymapPath()
  const resourceDir = resolveResourceDir({ override: a.resourceDir })
  const out = installArtifacts({
    keymapPath: keymap,
    scriptsDir: join(dirname(keymap), 'Scripts', 'luna'),
    resourceDir,
  })
  console.log(`keymap  -> ${out.keymap}`)
  console.log(`scripts -> ${out.scripts.length} file(s)${out.pruned.length ? `, pruned ${out.pruned.length} stale` : ''}`)
  if (out.keymapChanged) {
    console.log('Bindings changed. Now in REAPER: Actions > Show action list > Key map > Import...')
  } else {
    console.log('Bindings unchanged -- script changes are already live; no re-import needed.')
  }
  return 0
}
