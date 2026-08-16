import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

describe('scaffold', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2)
  })
  it('golden reference fixture is present and non-empty', () => {
    const p = fileURLToPath(new URL('./fixtures/luna-linux.reference.ReaperKeyMap', import.meta.url))
    expect(readFileSync(p, 'utf8').length).toBeGreaterThan(1000)
  })
})
