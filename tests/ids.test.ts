import { describe, it, expect } from 'vitest'
import { stableId, slugify } from '@/adapters/reaper/ids'

describe('stableId (migration contract — must match Python exactly)', () => {
  it('matches the committed custom-action id', () => {
    expect(stableId('Increase all track heights')).toBe('9457b692efcdc0fa6d1a838e640ccc96')
  })
  it('matches the committed script id', () => {
    expect(stableId('LUNA: Extend Selection To Next Bar')).toBe('76372f6ae70342495f98647bb34897d0')
  })
})

describe('slugify', () => {
  it('lowercases, collapses non-alnum to single underscore, trims', () => {
    expect(slugify('Extend Selection To Next Bar')).toBe('extend_selection_to_next_bar')
    expect(slugify('Foo (bar)')).toBe('foo_bar')
  })
})
