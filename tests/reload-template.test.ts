import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderReloadScript } from '@/adapters/reaper/templates/reload'

function luacAvailable(): boolean {
  try { execFileSync('luac', ['-v'], { stdio: 'ignore' }); return true } catch { return false }
}

describe('renderReloadScript', () => {
  const lua = renderReloadScript({
    repoRoot: '/Users/orion/work/reaper-automation',
    spec: 'luna.toml',
    pathPrefix: '/Users/orion/.nvm/versions/node/v22.19.0/bin',
  })

  it('bakes the repo root so the button knows where to build from', () => {
    expect(lua).toContain('/Users/orion/work/reaper-automation')
  })
  it('shells out and runs the refresh verb', () => {
    expect(lua).toContain('reaper.ExecProcess')
    expect(lua).toContain('/bin/sh')
    expect(lua).toContain('pnpm ra refresh')
  })
  it('bakes the node/pnpm bin dir onto PATH (a GUI app does not inherit the shell PATH)', () => {
    expect(lua).toContain('/Users/orion/.nvm/versions/node/v22.19.0/bin')
    expect(lua).toContain('PATH=')
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
