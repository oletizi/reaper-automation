import { describe, it, expect } from 'vitest'
import { renderStampModule, renderDebugModule, debugHook, DEBUG_MODULE_FILE, STAMP_MODULE_FILE } from '@/debug-runtime'

describe('renderStampModule', () => {
  it('returns the stamp string as a Lua literal', () => {
    expect(renderStampModule('7aec6b4-dirty')).toContain('return "7aec6b4-dirty"')
  })
  it('escapes embedded quotes and backslashes so it stays valid Lua', () => {
    const lua = renderStampModule('a"b\\c')
    expect(lua).toContain('return "a\\"b\\\\c"')
  })
})

describe('renderDebugModule', () => {
  const lua = renderDebugModule()
  it('appends to a luna-debug.log under the REAPER resource root', () => {
    expect(lua).toContain('luna-debug.log')
  })
  it('caps the log so it cannot grow unbounded', () => {
    expect(lua).toMatch(/CAP\s*=/)
  })
  it('reads the version stamp from the sibling stamp module', () => {
    expect(lua).toContain(STAMP_MODULE_FILE)
  })
  it('exposes a log function on the returned table', () => {
    expect(lua).toContain('function M.log')
    expect(lua).toContain('return M')
  })
})

describe('debugHook', () => {
  const hook = debugHook('tab_transient_next')
  it('resolves the sibling debug module from the running action path', () => {
    expect(hook).toContain('reaper.get_action_context')
    expect(hook).toContain(DEBUG_MODULE_FILE)
  })
  it('defines a _log helper tagged with the script key', () => {
    expect(hook).toContain('local function _log')
    expect(hook).toContain('tab_transient_next')
  })
  it('never lets a logging failure break the action (pcall-guarded)', () => {
    expect(hook).toContain('pcall')
  })
})
