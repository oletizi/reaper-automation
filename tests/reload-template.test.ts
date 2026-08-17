import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderReloadScript } from '@/reload-template'

function luacAvailable(): boolean {
  try { execFileSync('luac', ['-v'], { stdio: 'ignore' }); return true } catch { return false }
}

describe('renderReloadScript', () => {
  const lua = renderReloadScript({ repoRoot: '/Users/orion/work/reaper-automation', spec: 'luna.toml' })

  it('bakes the repo root so the button knows where to build from', () => {
    expect(lua).toContain('/Users/orion/work/reaper-automation')
  })
  it('shells out through a login shell and runs the refresh verb', () => {
    expect(lua).toContain('reaper.ExecProcess')
    expect(lua).toContain('/bin/sh -lc')
    expect(lua).toContain('pnpm ra refresh')
  })
  it('distinguishes a bindings-changed refresh (needs re-import) from bindings-unchanged', () => {
    expect(lua).toContain('BINDINGS: changed')
    expect(lua).toContain('ShowMessageBox')
  })
  it('reports a non-zero refresh as a failure rather than claiming success', () => {
    expect(lua).toContain('FAILED')
  })
  it('logs its outcome through the shared debug hook', () => {
    expect(lua).toContain('_log')
  })

  it.runIf(luacAvailable())('parses as valid Lua', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ra-lua-'))
    const p = join(dir, 'luna_reload.lua')
    writeFileSync(p, lua)
    expect(() => execFileSync('luac', ['-p', p])).not.toThrow()
  })
})
