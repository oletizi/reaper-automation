import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderDebugModule, renderStampModule } from '@/adapters/reaper/debug-runtime'

// Exercise the REAL luna_debug.lua in a Lua interpreter (its logging path uses
// only stdlib io/os, no reaper.* calls), proving it actually writes a stamped,
// capped line to <resource>/luna-debug.log -- not merely that it parses.
function luaAvailable(): boolean {
  try { execFileSync('lua', ['-v'], { stdio: 'ignore' }); return true } catch { return false }
}

describe.runIf(luaAvailable())('luna_debug.lua writes to the log', () => {
  function stage() {
    const resource = mkdtempSync(join(tmpdir(), 'ra-reslog-'))
    const dir = join(resource, 'Scripts', 'luna')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'luna_debug.lua'), renderDebugModule())
    writeFileSync(join(dir, 'luna_stamp.lua'), renderStampModule('7aec6b4-dirty'))
    return { resource, dir }
  }

  it('appends a stamped line at the resource root', () => {
    const { resource, dir } = stage()
    const driver = `
      local dbg = dofile("${join(dir, 'luna_debug.lua')}")
      dbg.log("tab_transient_next", "cur=1.000->2.500 moved=true")
    `
    const driverPath = join(dir, 'driver.lua')
    writeFileSync(driverPath, driver)
    execFileSync('lua', [driverPath])

    const logPath = join(resource, 'luna-debug.log')
    expect(existsSync(logPath)).toBe(true)
    const contents = readFileSync(logPath, 'utf8')
    expect(contents).toContain('tab_transient_next')
    expect(contents).toContain('sha=7aec6b4-dirty')
    expect(contents).toContain('moved=true')
  })

  it('caps the log so it cannot grow without bound', () => {
    const { resource, dir } = stage()
    const logPath = join(resource, 'luna-debug.log')
    // Pre-fill well past the 1MB cap, then log once and confirm it was trimmed.
    writeFileSync(logPath, 'x'.repeat(3 * 1024 * 1024) + '\n')
    const driverPath = join(dir, 'driver.lua')
    writeFileSync(driverPath, `local d = dofile("${join(dir, 'luna_debug.lua')}"); d.log("reload", "ok")`)
    execFileSync('lua', [driverPath])
    const size = readFileSync(logPath).length
    expect(size).toBeLessThan(2 * 1024 * 1024)
    expect(readFileSync(logPath, 'utf8')).toContain('reload')
  })
})
