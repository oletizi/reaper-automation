import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCli } from '@/index'

const luna = fileURLToPath(new URL('../mappings/luna.toml', import.meta.url))
let work: string
beforeEach(() => { work = mkdtempSync(join(tmpdir(), 'ra-cli-')) })

describe('runCli build', () => {
  it('writes a keymap and its scripts, target macos', async () => {
    const out = join(work, 'luna.ReaperKeyMap')
    const code = await runCli(['build', luna, '-o', out, '--target', 'macos'])
    expect(code).toBe(0)
    expect(existsSync(out)).toBe(true)
    expect(readFileSync(out, 'utf8')).toMatch(/^KEY /m)
    expect(existsSync(join(work, 'Scripts', 'luna'))).toBe(true)
  })
  it('exits non-zero and writes nothing on a validation error', async () => {
    const bad = join(work, 'bad.toml')
    const { writeFileSync } = await import('node:fs')
    writeFileSync(bad, '[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\naction=99999999\n')
    const out = join(work, 'bad.ReaperKeyMap')
    const code = await runCli(['build', bad, '-o', out])
    expect(code).not.toBe(0)
    expect(existsSync(out)).toBe(false)
  })
})

describe('runCli find-action', () => {
  it('returns 0 and prints matches (smoke)', async () => {
    expect(await runCli(['find-action', 'zoom', 'horizontal'])).toBe(0)
    expect(await runCli(['find-action', '--id', '40044'])).toBe(0)
  })
})
