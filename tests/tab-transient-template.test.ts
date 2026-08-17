import { describe, it, expect } from 'vitest'
import { renderTabNavScript, renderTabToggleScript } from '@/tab-transient-template'

describe('renderTabNavScript', () => {
  const next = renderTabNavScript({ label: 'LUNA: Tab next', spec: 'luna.toml', forward: true })
  const prev = renderTabNavScript({ label: 'LUNA: Tab prev', spec: 'luna.toml', forward: false })
  it('reads the toggle and uses edge + transient actions per direction', () => {
    expect(next).toContain('tab_to_transient')
    expect(next).toContain('41168') // next item edge
    expect(next).toContain('40375') // next transient
    expect(prev).toContain('41167') // prev item edge
    expect(prev).toContain('40376') // prev transient
  })
  it('collapses the edit area and is undo-wrapped', () => {
    expect(next).toContain('42406') // clear razor
    expect(next).toContain('40289') // unselect items
    expect(next).toContain('Undo_BeginBlock')
  })
})

describe('renderTabToggleScript', () => {
  const t = renderTabToggleScript({ label: 'LUNA: Toggle TTT', spec: 'luna.toml' })
  it('flips the ExtState and reflects the toggle command state', () => {
    expect(t).toContain('SetExtState')
    expect(t).toContain('tab_to_transient')
    expect(t).toContain('SetToggleCommandState')
  })
})
