import { describe, it, expect } from 'vitest'
import { renderRazorExtendScript } from '@/adapters/reaper/templates/razor-extend'

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

  it('does NOT touch item selection for a plain move (no selectItems)', () => {
    expect(lua).not.toContain('SetMediaItemSelected')
  })

  it('selects items on the target tracks (and restores) when selectItems is set', () => {
    // Transient moves (40375/40376) only act on selected items, so the extend
    // must select them for the probe/move to work, then restore the prior selection.
    const t = renderRazorExtendScript({ label: 'LUNA: Extend Transient', spec: 'luna.toml', move: 40375, moveName: 'next transient', selectItems: true })
    expect(t).toContain('SetMediaItemSelected')
    expect(t).toContain('CountSelectedMediaItems') // saves prior selection
    expect(t).toContain('SelectAllMediaItems(0, false)') // clears before/after
  })

  it('restores the item selection BEFORE painting (restore clears the razor)', () => {
    // SelectAllMediaItems(0,false) clears razor edits, so restoreItems must run
    // before paint() or it wipes the area we just painted.
    const t = renderRazorExtendScript({ label: 'x', spec: 's', move: 40375, moveName: 'tr', selectItems: true })
    const restore = t.indexOf('restoreItems(__saved)')
    const paint = t.indexOf('paint(new_start, new_end)')
    expect(restore).toBeGreaterThanOrEqual(0)
    expect(paint).toBeGreaterThanOrEqual(0)
    expect(restore).toBeLessThan(paint)
  })

  it('reads the existing span BEFORE selecting items (selection clears the razor)', () => {
    const t = renderRazorExtendScript({ label: 'x', spec: 's', move: 40375, moveName: 'tr', selectItems: true })
    // Compare the CALL sites (not the function definitions).
    expect(t.indexOf('sel_start, sel_end = readSpan()')).toBeLessThan(t.indexOf('__saved = selectTargetItems()'))
  })
})

describe('renderRazorExtendScript paint scoping', () => {
  const lua = renderRazorExtendScript({ label: 'LUNA: Extend Fwd', spec: 'luna.toml', move: 41042, moveName: 'fwd' })

  it('falls back to all tracks when none are selected, so the area is never written nowhere', () => {
    // Regression: paint() scoped strictly to CountSelectedTracks, so with zero
    // selected tracks every track got "" -- the area was computed and then
    // erased on write, and the gesture silently did nothing.
    const paint = lua.slice(lua.indexOf('local function paint'), lua.indexOf('local function extend'))
    expect(paint).toContain('CountSelectedTracks')
    expect(paint).toContain('GetTrack')
    expect(paint).toMatch(/if nsel > 0 then[\s\S]*else[\s\S]*CountTracks/)
  })

  it('agrees with the item-selection half, which already fell back to all tracks', () => {
    // Both halves of a select_items script must scope the same way, or the
    // script picks transients from every track and then paints onto none.
    const withSel = renderRazorExtendScript({ label: 'LUNA: Ext', spec: 'luna.toml', move: 40375, moveName: 'transient', selectItems: true })
    const select = withSel.slice(withSel.indexOf('local function selectTargetItems'), withSel.indexOf('local function restoreItems'))
    const paint = withSel.slice(withSel.indexOf('local function paint'), withSel.indexOf('local function extend'))
    for (const half of [select, paint]) {
      expect(half).toMatch(/if nsel > 0 then[\s\S]*else[\s\S]*CountTracks/)
    }
  })
})

