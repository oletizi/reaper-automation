import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseMapping } from '@/mapping'
import { loadActions, ActionIndex } from '@/actions'
import { buildKeymap } from '@/build-keymap'
import { parseKb, observeAgainstReatooled } from '@/reatooled'
import { resolveResourceDir } from '@/reaper-paths'
import { parseReport } from '@/cli/args'
import { fileURLToPath } from 'node:url'

export function cmdReport(argv: string[]): number {
  const a = parseReport(argv)
  const kbPath = a.kb ?? join(resolveResourceDir(), 'reaper-kb.ini')
  const lunaPath = fileURLToPath(new URL('../../mappings/luna.toml', import.meta.url))
  const mapping = parseMapping(readFileSync(lunaPath, 'utf8'))
  const built = buildKeymap(mapping, new ActionIndex(loadActions()), 'macos')
  const ours: { flags: number; keycode: number }[] = []
  for (const line of built.keymapText.split('\n')) {
    if (!line.startsWith('KEY ')) continue
    const f = line.split(/\s+/)
    ours.push({ flags: Number(f[1]), keycode: Number(f[2]) })
  }
  const kb = parseKb(readFileSync(kbPath, 'utf8'))
  const o = observeAgainstReatooled(ours, kb)
  console.log(`ours: ${o.ourCount} bindings`)
  console.log(`reaper-kb.ini sections seen: ${o.sectionsSeen.join(', ')}`)
  console.log(`same (section,flags,keycode) slot present: ${o.sameSlotSameSection}`)
  console.log('NOTE: raw observation only — OVERRIDE/FREE semantics await the section-precedence probe (see spec).')
  return 0
}
