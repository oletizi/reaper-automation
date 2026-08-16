import { join, dirname } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { installArtifacts } from '@/install'
import { resolveResourceDir } from '@/reaper-paths'
import { detectReaTooledSection } from '@/reatooled'
import { parseInstall } from '@/cli/args'
import { fileURLToPath } from 'node:url'

export function cmdInstall(argv: string[]): number {
  const a = parseInstall(argv)
  const keymap = a.keymap ?? fileURLToPath(new URL('../../build/luna-macos.ReaperKeyMap', import.meta.url))
  const resourceDir = resolveResourceDir({ override: a.resourceDir })
  let section = a.section
  let detected = false
  if (section === undefined) {
    const kb = join(resourceDir, 'reaper-kb.ini')
    section = existsSync(kb) ? detectReaTooledSection(readFileSync(kb, 'utf8')) : 0
    detected = section === 16
  }
  console.log(`section: ${section}${detected ? ' (ReaTooled detected)' : ''}`)
  const out = installArtifacts({
    keymapPath: keymap,
    scriptsDir: join(dirname(keymap), 'Scripts', 'luna'),
    resourceDir,
  })
  console.log(`keymap  -> ${out.keymap}`)
  console.log(`scripts -> ${out.scripts.length} file(s)`)
  console.log('Now in REAPER: Actions > Show action list > Key map > Import...')
  return 0
}
