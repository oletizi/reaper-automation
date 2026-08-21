import { describe, it, expect } from 'vitest'
import { loadActions, ActionIndex } from '@/adapters/reaper/actions'

const rows = loadActions()
const idx = new ActionIndex(rows)

describe('actions', () => {
  it('loads thousands of rows with a header skipped', () => {
    expect(rows.length).toBeGreaterThan(5000)
    expect(rows[0].section).not.toBe('section') // header not included
  })
  it('resolves known main-section ids used by the mapping', () => {
    expect(idx.byId('40044')).toContain('Play') // Transport: Play/stop
    expect(idx.has('40044')).toBe(true)
    expect(idx.has('99999999')).toBe(false)
  })
  it('find() is AND across terms, case-insensitive', () => {
    const hits = idx.find(['zoom', 'horizontal'])
    expect(hits.length).toBeGreaterThan(0)
    for (const h of hits) {
      const n = h.actionName.toLowerCase()
      expect(n.includes('zoom') && n.includes('horizontal')).toBe(true)
    }
  })
})
