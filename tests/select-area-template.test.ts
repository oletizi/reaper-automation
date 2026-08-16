import { describe, it, expect } from 'vitest'
import { renderSelectAreaScript } from '@/select-area-template'

describe('renderSelectAreaScript', () => {
  const lua = renderSelectAreaScript({ label: 'LUNA: Select Area', spec: 'luna.toml' })
  it('scopes to selected tracks (falls back to all when none) and reads the time range', () => {
    expect(lua).toContain('CountSelectedTracks')
    expect(lua).toContain('GetSelectedTrack')
    expect(lua).toContain('GetSet_LoopTimeRange(false, false')
  })
  it('splits at interior points and selects the enclosed clips', () => {
    expect(lua).toContain('SplitMediaItem')
    expect(lua).toContain('SelectAllMediaItems(0, false)')
    expect(lua).toContain('SetMediaItemSelected')
  })
  it('is wrapped in an undo block and names the label', () => {
    expect(lua).toContain('Undo_BeginBlock')
    expect(lua).toContain('Undo_EndBlock("LUNA: Select Area"')
  })
})
