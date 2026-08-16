import { describe, it, expect } from 'vitest'
import { renderRazorExtendScript } from '@/razor-extend-template'

describe('renderRazorExtendScript', () => {
  const lua = renderRazorExtendScript({ label: 'LUNA: Extend Fwd', spec: 'luna.toml', move: 41042, moveName: 'fwd' })

  it('reads/writes the razor area, scoped to selected tracks', () => {
    expect(lua).toContain('P_RAZOREDITS')
    expect(lua).toContain('CountSelectedTracks')
  })

  it('interpolates the move and probes direction via the cursor', () => {
    expect(lua).toContain('local MOVE = 41042')
    expect(lua).toContain('GetCursorPosition')
  })

  it('drives transport/loop/repeat from the new area', () => {
    expect(lua).toContain('42474')
    expect(lua).toContain('SetEditCurPos')
    expect(lua).toContain('GetSetRepeat(1)')
  })

  it('wraps in an undo block carrying the label', () => {
    expect(lua).toContain('Undo_BeginBlock')
    expect(lua).toContain('Undo_EndBlock("LUNA: Extend Fwd", -1)')
  })
})
