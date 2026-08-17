import { join, dirname } from 'node:path'
import { installArtifacts } from '@/install'
import { resolveResourceDir } from '@/reaper-paths'
import { parseInstall } from '@/cli/args'
import { fileURLToPath } from 'node:url'

export function cmdInstall(argv: string[]): number {
  const a = parseInstall(argv)
  const keymap = a.keymap ?? fileURLToPath(new URL('../../build/luna-macos.ReaperKeyMap', import.meta.url))
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
