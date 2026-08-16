import { describe, it, expect } from 'vitest'
import { renderRazorRepaintScript } from '@/razor-repaint-template'

describe('renderRazorRepaintScript', () => {
  const lua = renderRazorRepaintScript({ label: 'LUNA: Repaint Area', spec: 'luna.toml' })
  it('reads and writes P_RAZOREDITS and scopes to selected tracks', () => {
    expect(lua).toContain('P_RAZOREDITS')
    expect(lua).toContain('CountSelectedTracks')
    expect(lua).toContain('GetSelectedTrack')
  })
  it('drives transport/loop from the razor', () => {
    expect(lua).toContain('42474')
    expect(lua).toContain('SetEditCurPos')
    expect(lua).toContain('GetSetRepeat(1)')
    expect(lua).toContain('Undo_BeginBlock')
  })
})
