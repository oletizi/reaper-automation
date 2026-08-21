import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { parseRefresh } from '@/cli/args'
import { runBuild, repoRoot } from '@/adapters/reaper/build-run'
import { installArtifacts } from '@/adapters/reaper/install'
import { resolveResourceDir } from '@/adapters/reaper/paths'
import { hostTarget } from '@/core/target'

// One-shot: build -> install -> verify installed == built. This is what the
// in-REAPER reload button runs. It prints a machine-readable `BINDINGS:
// changed|unchanged` line the button greps to decide whether a one-time
// re-import is needed.
export function cmdRefresh(argv: string[]): number {
  const a = parseRefresh(argv)
  const root = repoRoot()
  const target = a.target ?? hostTarget()
  const mapping = a.mapping ?? join(root, 'mappings', 'luna.toml')
  const out = a.out ?? join(root, 'build', `luna-${target}.ReaperKeyMap`)
  const resourceDir = resolveResourceDir({ override: a.resourceDir })

  const b = runBuild({ mapping, out, target: a.target, section: a.section })
  console.log(`section: ${b.section}${b.detected ? ' (ReaTooled detected)' : ''}  stamp: ${b.stamp}`)

  const inst = installArtifacts({ keymapPath: b.keymapPath, scriptsDir: b.scriptsDir, resourceDir })
  console.log(`keymap  -> ${inst.keymap}`)
  console.log(`scripts -> ${inst.scripts.length} file(s)${inst.pruned.length ? `, pruned ${inst.pruned.length} stale` : ''}`)

  // Verify installed bytes match the build, so "refresh succeeded" is never a lie.
  const mismatches: string[] = []
  if (readFileSync(inst.keymap, 'utf8') !== b.result.keymapText) mismatches.push('keymap')
  for (const [name, src] of b.result.scripts) {
    const installed = join(resourceDir, 'Scripts', 'luna', name)
    if (readFileSync(installed, 'utf8') !== src) mismatches.push(name)
  }
  if (mismatches.length) {
    console.error(`refresh: installed files differ from the build: ${mismatches.join(', ')}`)
    return 1
  }

  console.log(`BINDINGS: ${inst.keymapChanged ? 'changed' : 'unchanged'}`)
  if (inst.keymapChanged) {
    console.log('Key bindings changed -- re-import once: Actions > Show action list > Key map > Import > LUNA (Pro Tools).')
  } else {
    console.log('Bindings unchanged -- script changes are already live.')
  }
  return 0
}
