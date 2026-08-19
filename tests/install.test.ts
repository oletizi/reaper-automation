import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { installArtifacts } from '@/install'
import { defaultKeymapPath } from '@/cli/install'
import { repoRoot } from '@/build-run'
import { hostTarget } from '@/translate'

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

  it('prunes installed scripts that the current build no longer emits', () => {
    const src = join(work, 'build')
    mkdirSync(join(src, 'Scripts', 'luna'), { recursive: true })
    writeFileSync(join(src, 'luna.ReaperKeyMap'), 'KEY 1 32 40044 0\n')
    writeFileSync(join(src, 'Scripts', 'luna', 'keep.lua'), '-- keep')
    const res = join(work, 'REAPER')
    mkdirSync(join(res, 'Scripts', 'luna'), { recursive: true })
    writeFileSync(join(res, 'Scripts', 'luna', 'orphan.lua'), '-- stale from a removed feature')

    const out = installArtifacts({
      keymapPath: join(src, 'luna.ReaperKeyMap'),
      scriptsDir: join(src, 'Scripts', 'luna'),
      resourceDir: res,
    })

    expect(existsSync(join(res, 'Scripts', 'luna', 'keep.lua'))).toBe(true)
    expect(existsSync(join(res, 'Scripts', 'luna', 'orphan.lua'))).toBe(false)
    expect(out.pruned).toEqual([join(res, 'Scripts', 'luna', 'orphan.lua')])
  })

  it('reports the keymap as changed when there was no prior install, unchanged when identical', () => {
    const src = join(work, 'build')
    mkdirSync(src, { recursive: true })
    writeFileSync(join(src, 'luna.ReaperKeyMap'), 'KEY 1 32 40044 0\n')
    const res = join(work, 'REAPER')
    mkdirSync(res)

    const first = installArtifacts({ keymapPath: join(src, 'luna.ReaperKeyMap'), resourceDir: res })
    expect(first.keymapChanged).toBe(true) // nothing was there before

    const second = installArtifacts({ keymapPath: join(src, 'luna.ReaperKeyMap'), resourceDir: res })
    expect(second.keymapChanged).toBe(false) // identical bytes re-installed

    writeFileSync(join(src, 'luna.ReaperKeyMap'), 'KEY 1 32 40044 0\nKEY 1 66 41383 0\n')
    const third = installArtifacts({ keymapPath: join(src, 'luna.ReaperKeyMap'), resourceDir: res })
    expect(third.keymapChanged).toBe(true) // bindings differ now
  })
})

describe('defaultKeymapPath', () => {
  it('picks the artifact built for the host, not a hardcoded macos one', () => {
    expect(defaultKeymapPath('darwin').endsWith('build/luna-macos.ReaperKeyMap')).toBe(true)
    expect(defaultKeymapPath('linux').endsWith('build/luna-linux.ReaperKeyMap')).toBe(true)
  })
  it('agrees with what build/refresh/doctor name for the same host', () => {
    // The four verbs must not disagree about which file is "the" artifact.
    for (const p of ['darwin', 'linux'] as const) {
      expect(defaultKeymapPath(p)).toBe(join(repoRoot(), 'build', `luna-${hostTarget(p)}.ReaperKeyMap`))
    }
  })
})
