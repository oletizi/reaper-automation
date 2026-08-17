import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderDebugModule, renderStampModule, debugHook } from '@/debug-runtime'

// Parse Lua with luac -p when available. REAPER's own Lua is not runnable
// standalone, so this is our only pre-flight guard against a syntax error that
// would silently break every generated script in REAPER.
function luacAvailable(): boolean {
  try { execFileSync('luac', ['-v'], { stdio: 'ignore' }); return true } catch { return false }
}

function assertParses(name: string, lua: string) {
  const dir = mkdtempSync(join(tmpdir(), 'ra-lua-'))
  const p = join(dir, name)
  writeFileSync(p, lua)
  // throws (non-zero exit) if the chunk does not parse
  execFileSync('luac', ['-p', p])
}

describe.runIf(luacAvailable())('generated Lua parses', () => {
  it('luna_debug.lua parses', () => {
    expect(() => assertParses('luna_debug.lua', renderDebugModule())).not.toThrow()
  })
  it('luna_stamp.lua parses', () => {
    expect(() => assertParses('luna_stamp.lua', renderStampModule('7aec6b4-dirty'))).not.toThrow()
  })
  it('a script carrying the debug hook parses', () => {
    const script = `${debugHook('demo')}\n_log("hello")\n`
    expect(() => assertParses('demo.lua', script)).not.toThrow()
  })
})
