import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseMapping } from '@/mapping'
import { loadActions, ActionIndex } from '@/actions'
import { buildKeymap } from '@/build-keymap'
import { parseTarget, type Target } from '@/translate'
import { parseBuild } from '@/cli/args'

export function cmdBuild(argv: string[]): number {
  const a = parseBuild(argv)
  const target: Target = a.target ? parseTarget(a.target) : (process.platform === 'darwin' ? 'macos' : 'linux')
  const mapping = parseMapping(readFileSync(a.mapping, 'utf8'))
  const idx = new ActionIndex(loadActions())
  const result = buildKeymap(mapping, idx, target, a.section ?? 0) // throws on validation error -> nothing written
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
