import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { installArtifacts } from '@/install'

let work: string
beforeEach(() => { work = mkdtempSync(join(tmpdir(), 'ra-install-')) })

describe('installArtifacts', () => {
  it('stages the keymap and scripts and never writes reaper-kb.ini', () => {
    const src = join(work, 'build')
    mkdirSync(join(src, 'Scripts', 'luna'), { recursive: true })
    writeFileSync(join(src, 'luna.ReaperKeyMap'), 'KEY 1 32 40044 0\n')
    writeFileSync(join(src, 'Scripts', 'luna', 'a.lua'), '-- a')
    const res = join(work, 'REAPER')
    mkdirSync(res)

    const out = installArtifacts({
      keymapPath: join(src, 'luna.ReaperKeyMap'),
      scriptsDir: join(src, 'Scripts', 'luna'),
      resourceDir: res,
      keymapName: 'LUNA (Pro Tools).ReaperKeyMap',
    })

    expect(existsSync(join(res, 'KeyMaps', 'LUNA (Pro Tools).ReaperKeyMap'))).toBe(true)
    expect(existsSync(join(res, 'Scripts', 'luna', 'a.lua'))).toBe(true)
    expect(existsSync(join(res, 'reaper-kb.ini'))).toBe(false)
    expect(out.scripts).toHaveLength(1)
  })
})
