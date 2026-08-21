import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseKb, observeAgainstReatooled, detectReaTooledSection } from '@/adapters/reaper/reatooled'

const slice = readFileSync(fileURLToPath(new URL('./fixtures/reatooled-slice.ini', import.meta.url)), 'utf8')

describe('parseKb', () => {
  it('parses only KEY lines into flags/keycode/command/section', () => {
    const rows = parseKb(slice)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual({ flags: 1, keycode: 85, command: '40033', section: 0 })
    expect(rows[1].section).toBe(16)
  })
})

describe('observeAgainstReatooled (raw, no OVERRIDE/FREE)', () => {
  it('reports counts and the sections it saw without asserting coexistence', () => {
    const rows = parseKb(slice)
    const o = observeAgainstReatooled([{ flags: 1, keycode: 85 }], rows)
    expect(o.ourCount).toBe(1)
    expect(o.sectionsSeen.sort()).toEqual([0, 16])
    expect(o.sameSlotSameSection).toBe(1) // 1/85 matches the section-0 row; observation only
    // deliberately: no `override`/`free` field exists on the result yet
    expect('override' in o).toBe(false)
  })
})

describe('detectReaTooledSection', () => {
  it('returns 16 when section-16 Main bindings are present', () => {
    expect(detectReaTooledSection('KEY 1 76 41167 16\nKEY 1 65 40044 0\n')).toBe(16)
  })
  it('returns 0 for a stock kb (only section 0)', () => {
    expect(detectReaTooledSection('KEY 1 65 40044 0\nKEY 1 66 40045 0\n')).toBe(0)
  })
})
