import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseMapping } from '@/mapping'
import { loadActions, ActionIndex } from '@/actions'
import { buildKeymap } from '@/build-keymap'
import { parseTarget, type Target } from '@/translate'
import { parseBuild } from '@/cli/args'
import { resolveResourceDir } from '@/reaper-paths'
import { detectReaTooledSection } from '@/reatooled'

export function cmdBuild(argv: string[]): number {
  const a = parseBuild(argv)
  const target: Target = a.target ? parseTarget(a.target) : (process.platform === 'darwin' ? 'macos' : 'linux')
  const mapping = parseMapping(readFileSync(a.mapping, 'utf8'))
  const idx = new ActionIndex(loadActions())
  let section = a.section
  let detected = false
  if (section === undefined) {
    const kb = join(resolveResourceDir(), 'reaper-kb.ini')
    section = existsSync(kb) ? detectReaTooledSection(readFileSync(kb, 'utf8')) : 0
    detected = section === 16
  }
  console.log(`section: ${section}${detected ? ' (ReaTooled detected)' : ''}`)
  const result = buildKeymap(mapping, idx, target, section) // throws on validation error -> nothing written
  mkdirSync(dirname(a.out), { recursive: true })
  writeFileSync(a.out, result.keymapText)
  if (result.scripts.size) {
    const dir = join(dirname(a.out), 'Scripts', 'luna')
    mkdirSync(dir, { recursive: true })
    for (const [name, src] of result.scripts) writeFileSync(join(dir, name), src)
  }
  for (const w of result.warnings) console.error(w)
  const s = result.stats
  console.log(`wrote ${a.out}  (${s.direct} direct, ${s.macro} macro, ${s.script} script, ${s.disabled} disabled; ${s.unmapped} unmapped)`)
  return 0
}
