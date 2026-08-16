import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseMapping } from '@/mapping'
import { loadActions, ActionIndex } from '@/actions'
import { buildKeymap } from '@/build-keymap'

const ref = readFileSync(fileURLToPath(new URL('./fixtures/luna-linux.reference.ReaperKeyMap', import.meta.url)), 'utf8')
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
  const a = toRecords(ref)
  const b = toRecords(built.keymapText)

  it('KEY semantic records match the Python reference (bit parity across relabel)', () => {
    expect(b.key).toEqual(a.key)
  })
  it('ACT ids + steps match the Python reference', () => {
    expect(b.act).toEqual(a.act)
  })
  it('SCR ids + paths match the Python reference (id-stability)', () => {
    expect(b.scr).toEqual(a.scr)
  })
})

describe('byte-for-byte drift guard (TS vs TS)', () => {
  const fx = fileURLToPath(new URL('./fixtures/luna-macos.tsbuild.ReaperKeyMap', import.meta.url))
  it('reproduces the captured TS macos build exactly', () => {
    if (!existsSync(fx)) {
      writeFileSync(fx, built.keymapText) // first run captures; commit it, then this asserts
    }
    expect(built.keymapText).toBe(readFileSync(fx, 'utf8'))
  })
})
