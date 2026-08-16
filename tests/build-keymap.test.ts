import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseMapping } from '@/mapping'
import { loadActions, ActionIndex } from '@/actions'
import { buildKeymap } from '@/build-keymap'

const idx = new ActionIndex(loadActions())
const mini = parseMapping(readFileSync(fileURLToPath(new URL('./fixtures/mini.toml', import.meta.url)), 'utf8'))

describe('buildKeymap (mini fixture, target macos)', () => {
  const r = buildKeymap(mini, idx, 'macos')

  it('emits a direct KEY line for Play', () => {
    expect(r.keymapText).toMatch(/^KEY 1 32 40044 0/m)
  })
  it('emits an ACT with the contract id and a KEY referencing it', () => {
    expect(r.keymapText).toMatch(/^ACT 0 0 "9457b692efcdc0fa6d1a838e640ccc96" "Custom: Increase all track heights" 40296 41325$/m)
    expect(r.keymapText).toMatch(/_9457b692efcdc0fa6d1a838e640ccc96 0/)
  })
  it('emits an SCR with the contract id and writes the Lua file', () => {
    expect(r.keymapText).toMatch(/^SCR 4 0 "76372f6ae70342495f98647bb34897d0" "Custom: LUNA: Extend Selection To Next Bar" luna\/luna_extend_selection_to_next_bar\.lua$/m)
    expect(r.scripts.has('luna_extend_selection_to_next_bar.lua')).toBe(true)
  })
  it('counts unmapped separately and omits it from output', () => {
    expect(r.stats.unmapped).toBe(1)
  })
})

describe('buildKeymap section override (ReaTooled coexistence)', () => {
  const r16 = buildKeymap(mini, idx, 'macos', 16)
  it('emits KEY lines in the given section', () => {
    expect(r16.keymapText).toMatch(/^KEY 1 32 40044 16/m)
  })
  it('emits ACT and SCR definitions in the given section', () => {
    expect(r16.keymapText).toMatch(/^ACT 0 16 "9457b692efcdc0fa6d1a838e640ccc96"/m)
    expect(r16.keymapText).toMatch(/^SCR 4 16 "76372f6ae70342495f98647bb34897d0"/m)
  })
  it('defaults to section 0 when omitted', () => {
    expect(buildKeymap(mini, idx, 'macos').keymapText).toMatch(/^KEY 1 32 40044 0/m)
  })
})

describe('buildKeymap strict validation', () => {
  it('throws when an action id does not exist', () => {
    const m = parseMapping('[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\naction=99999999\n')
    expect(() => buildKeymap(m, idx, 'macos')).toThrow(/unknown/)
  })
  it('throws when two bindings collide on the same combo', () => {
    const m = parseMapping('[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\naction=40044\n[[binding]]\nluna="C"\nkey="A"\naction=1013\n')
    expect(() => buildKeymap(m, idx, 'macos')).toThrow(/already bound/)
  })
})
