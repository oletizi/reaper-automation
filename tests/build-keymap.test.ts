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

describe('razor_extend kind emission', () => {
  it('emits one SCR per distinct move, deduped', () => {
    const m = parseMapping(
      '[meta]\nname="x"\n' +
        '[[binding]]\nluna="Extend Next"\nkey="B"\nrazor_extend=41042\n' +
        '[[binding]]\nluna="Extend Next Again"\nkey="C"\nrazor_extend=41042\n' +
        '[[binding]]\nluna="Extend Prev"\nkey="D"\nrazor_extend=41043\n',
    )
    const r = buildKeymap(m, idx, 'macos')
    const scr = r.keymapText.split('\n').filter((l) => l.startsWith('SCR '))
    expect(scr).toHaveLength(2)
    // B (66) and C (67) both bind to the same script id (deduped on move 41042)
    const bLine = r.keymapText.split('\n').find((l) => /^KEY 1 66 /.test(l))
    const cLine = r.keymapText.split('\n').find((l) => /^KEY 1 67 /.test(l))
    expect(bLine).toBeDefined()
    expect(cLine).toBeDefined()
    const bCmd = bLine?.split(' ')[3]
    const cCmd = cLine?.split(' ')[3]
    expect(bCmd).toBe(cCmd)
  })
  it('throws when the move id does not exist', () => {
    const m = parseMapping('[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\nrazor_extend=99999999\n')
    expect(() => buildKeymap(m, idx, 'macos')).toThrow(/unknown/)
  })
})

describe('razor_track kind emission', () => {
  const m = parseMapping(
    '[meta]\nname="x"\n' +
      '[[binding]]\nluna="Track Up"\nkey="B"\nrazor_track=40286\n' +
      '[[binding]]\nluna="Track Down"\nkey="C"\nrazor_track=40287\n',
  )
  const r = buildKeymap(m, idx, 'macos')
  it('emits the shared repaint SCR exactly once', () => {
    const scr = r.keymapText.split('\n').filter((l) => l.startsWith('SCR ') && l.includes('luna_razor_repaint.lua'))
    expect(scr).toHaveLength(1)
    expect(r.scripts.has('luna_razor_repaint.lua')).toBe(true)
  })
  it('emits an ACT [track, _repaint] per binding and binds the key to it', () => {
    expect(r.keymapText).toMatch(/^ACT 0 0 "[0-9a-f]{32}" "Custom: LUNA: Track Up" 40286 _[0-9a-f]{32}$/m)
    expect(r.keymapText).toMatch(/^ACT 0 0 "[0-9a-f]{32}" "Custom: LUNA: Track Down" 40287 _[0-9a-f]{32}$/m)
  })
  it('throws when the track action id does not exist', () => {
    const bad = parseMapping('[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\nrazor_track=99999999\n')
    expect(() => buildKeymap(bad, idx, 'macos')).toThrow(/unknown/)
  })
})

describe('razor kind emission', () => {
  it('emits ACT [42957, action] and binds the key to it', () => {
    const m = parseMapping('[meta]\nname="x"\n[[binding]]\nluna="Del"\nkey="Delete"\nrazor=40006\n')
    const r = buildKeymap(m, idx, 'macos')
    expect(r.keymapText).toMatch(/^ACT 0 0 "[0-9a-f]{32}" "Custom: LUNA: Del" 42957 40006$/m)
  })
  it('throws when the action id does not exist', () => {
    const m = parseMapping('[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\nrazor=99999999\n')
    expect(() => buildKeymap(m, idx, 'macos')).toThrow(/unknown/)
  })
})

describe('separate kind emission', () => {
  const m = parseMapping('[meta]\nname="x"\n[[binding]]\nluna="Sep"\nkey="B"\nseparate=true\n[[binding]]\nluna="Sep2"\nkey="E"\nseparate=true\n')
  const r = buildKeymap(m, idx, 'macos')
  it('emits the shared separate SCR exactly once for multiple bindings', () => {
    const scr = r.keymapText.split('\n').filter((l) => l.startsWith('SCR ') && l.includes('luna_separate.lua'))
    expect(scr).toHaveLength(1)
  })
  it('binds the keys directly to the separate script', () => {
    expect(r.keymapText).toMatch(/^KEY 1 66 _[0-9a-f]{32} 0/m)
  })
})
