import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCli } from '@/index'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const luna = join(repoRoot, 'mappings', 'luna.toml')
let work: string
let out: string
let res: string
beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), 'ra-refresh-'))
  out = join(work, 'build', 'luna.ReaperKeyMap')
  res = join(work, 'REAPER')
  mkdirSync(res, { recursive: true })
})

function capture() {
  const lines: string[] = []
  const spy = vi.spyOn(console, 'log').mockImplementation((...a) => { lines.push(a.join(' ')) })
  return { lines, restore: () => spy.mockRestore() }
}

describe('runCli refresh', () => {
  it('builds, installs, and reports whether bindings changed', async () => {
    const cap = capture()
    const code = await runCli(['refresh', '--mapping', luna, '--out', out, '--resource-dir', res, '--target', 'macos'])
    cap.restore()
    expect(code).toBe(0)
    // staged into the resource dir
    expect(existsSync(join(res, 'KeyMaps', 'LUNA (Pro Tools).ReaperKeyMap'))).toBe(true)
    expect(existsSync(join(res, 'Scripts', 'luna', 'luna_reload.lua'))).toBe(true)
    expect(existsSync(join(res, 'Scripts', 'luna', 'luna_debug.lua'))).toBe(true)
    // machine-readable token the in-REAPER button greps for
    expect(cap.lines.join('\n')).toMatch(/BINDINGS: (changed|unchanged)/)
  })

  it('verifies installed bytes match the build (installed == built)', async () => {
    const cap = capture()
    await runCli(['refresh', '--mapping', luna, '--out', out, '--resource-dir', res, '--target', 'macos'])
    cap.restore()
    const builtKeymap = readFileSync(out, 'utf8')
    const installedKeymap = readFileSync(join(res, 'KeyMaps', 'LUNA (Pro Tools).ReaperKeyMap'), 'utf8')
    expect(installedKeymap).toBe(builtKeymap)
  })

  it('reports bindings unchanged on a second identical refresh', async () => {
    await runCli(['refresh', '--mapping', luna, '--out', out, '--resource-dir', res, '--target', 'macos'])
    const cap = capture()
    await runCli(['refresh', '--mapping', luna, '--out', out, '--resource-dir', res, '--target', 'macos'])
    cap.restore()
    expect(cap.lines.join('\n')).toContain('BINDINGS: unchanged')
  })
})

describe('runCli doctor', () => {
  it('reports the source / build / installed version chain and exits 0', async () => {
    await runCli(['refresh', '--mapping', luna, '--out', out, '--resource-dir', res, '--target', 'macos'])
    const cap = capture()
    const code = await runCli(['doctor', '--out', out, '--resource-dir', res])
    cap.restore()
    expect(code).toBe(0)
    const text = cap.lines.join('\n')
    expect(text).toMatch(/source/i)
    expect(text).toMatch(/installed/i)
  })

  it('flags drift when the installed stamp differs from the build', async () => {
    // build+install once, then point doctor at an empty resource dir => installed missing
    await runCli(['refresh', '--mapping', luna, '--out', out, '--resource-dir', res, '--target', 'macos'])
    const empty = join(work, 'EMPTY')
    mkdirSync(empty, { recursive: true })
    const cap = capture()
    const code = await runCli(['doctor', '--out', out, '--resource-dir', empty])
    cap.restore()
    expect(cap.lines.join('\n')).toMatch(/drift|missing|not installed/i)
    expect(code).not.toBe(0)
  })
})
