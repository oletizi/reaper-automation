import { describe, it, expect } from 'vitest'
import { renderTabTransientScript } from '@/tab-transient-template'

describe('renderTabTransientScript', () => {
  const next = renderTabTransientScript({ label: 'LUNA: Tab next', spec: 'luna.toml', forward: true })
  const prev = renderTabTransientScript({ label: 'LUNA: Tab prev', spec: 'luna.toml', forward: false })
  it('uses the correct transient action per direction', () => {
    expect(next).toContain('40375') // next transient
    expect(prev).toContain('40376') // previous transient
  })
  it('selects target-track items, navigates, and restores the prior selection', () => {
    expect(next).toContain('CountSelectedTracks')
    expect(next).toContain('CountSelectedMediaItems') // save selection
    expect(next).toContain('SelectAllMediaItems(0, false)') // clear before/after
    expect(next).toContain('SetMediaItemSelected')
  })
})
