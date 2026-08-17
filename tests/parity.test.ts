import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseMapping } from '@/mapping'
import { loadActions, ActionIndex } from '@/actions'
import { buildKeymap } from '@/build-keymap'

const luna = parseMapping(readFileSync(fileURLToPath(new URL('../mappings/luna.toml', import.meta.url)), 'utf8'))
const built = buildKeymap(luna, new ActionIndex(loadActions()), 'macos')

interface Rec { key: string[]; act: string[]; scr: string[] }
function toRecords(text: string): Rec {
  const key: string[] = [], act: string[] = [], scr: string[] = []
  for (const raw of text.split('\n')) {
    const line = raw.split('\t')[0].trimEnd() // drop inline comments
    if (line.startsWith('KEY ')) {
      const [, flags, code, cmd, sec] = line.split(/\s+/)
      key.push([flags, code, cmd, sec].join(' '))
    } else if (line.startsWith('ACT ')) {
      const m = line.match(/^ACT \d+ \d+ "([^"]+)"(?: "[^"]*")? (.*)$/)
      if (m) act.push(`${m[1]} ${m[2]}`)
    } else if (line.startsWith('SCR ')) {
      const m = line.match(/^SCR \d+ \d+ "([^"]+)"(?: "[^"]*")? (\S+)$/)
      if (m) scr.push(`${m[1]} ${m[2]}`)
    }
  }
  return { key: key.sort(), act: act.sort(), scr: scr.sort() }
}

describe('golden parity', () => {
  // NOTE: the frozen Python-reference comparison (luna-linux.reference.ReaperKeyMap) was
  // retired here. It served its purpose while migrating Python -> TS (proving bit-for-bit
  // reproduction), but the edit-selection model deliberately diverges from that reference:
  // the edit area is now a REAPER razor edit (not the retired `area` primitive) -- Separate/
  // Delete/Cut act directly on the razor, other item ops go through `razor= [42957, id]`
  // (select the razor's items, then act), horizontal/vertical growth use `razor_extend`/
  // `razor_track` scripts, and the plain cursor-move family collapses the razor via
  // `[move, 42406]` macros instead of issuing the bare Python move actions. "Matches
  // Python exactly" is no longer the invariant we want. The non-vacuousness tripwire below
  // now points at the current TS build's own records so it still catches silent
  // build-keymap/parser breakage; the byte-for-byte drift guard further down is the real
  // regression baseline for the intended (post-migration, post-razor-rewire) output.
  const b = toRecords(built.keymapText)

  it('built records are non-empty (tripwire against silent build breakage)', () => {
    expect(b.key.length).toBeGreaterThan(0)
    expect(b.act.length).toBeGreaterThan(0)
    expect(b.scr.length).toBeGreaterThan(0)
  })
})

describe('byte-for-byte drift guard (TS vs TS)', () => {
  // Regression baseline for the intended (post-migration) output. B + the plain-move family
  // intentionally diverge from the original Python output (see note above); this fixture
  // captures that divergence as the new expected build so future builds are checked against
  // it rather than against the retired Python reference.
  const fx = fileURLToPath(new URL('./fixtures/luna-macos.tsbuild.ReaperKeyMap', import.meta.url))
  it('reproduces the captured TS macos build exactly', () => {
    if (!existsSync(fx)) {
      writeFileSync(fx, built.keymapText) // first run captures; commit it, then this asserts
    }
    expect(built.keymapText).toBe(readFileSync(fx, 'utf8'))
  })
})
