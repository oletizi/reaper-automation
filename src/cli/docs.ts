import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseDocs } from '@/cli/args'
import { repoRoot } from '@/adapters/reaper/build-run'
import { parseMapping } from '@/adapters/reaper/mapping'
import { loadActions, ActionIndex } from '@/adapters/reaper/actions'
import { renderKeybindingsDoc } from '@/adapters/reaper/keybindings-doc'

// Generate KEYBINDINGS.md from the mapping table. --check regenerates in memory
// and fails when the committed file has drifted, so the doc can't quietly stop
// describing the keymap it documents.
export function cmdDocs(argv: string[]): number {
  const a = parseDocs(argv)
  const root = repoRoot()
  const mappingPath = a.mapping ?? join(root, 'mappings', 'luna.toml')
  const out = a.out ?? join(root, 'KEYBINDINGS.md')

  const mapping = parseMapping(readFileSync(mappingPath, 'utf8'))
  const text = renderKeybindingsDoc(mapping, new ActionIndex(loadActions()))

  if (a.check) {
    if (!existsSync(out)) {
      console.error(`docs --check: ${out} does not exist; run \`ra docs\``)
      return 1
    }
    if (readFileSync(out, 'utf8') !== text) {
      console.error(`docs --check: ${out} is out of date with ${mappingPath}; run \`ra docs\``)
      return 1
    }
    console.log(`docs: ${out} is up to date`)
    return 0
  }

  writeFileSync(out, text)
  console.log(`wrote ${out}`)
  return 0
}
