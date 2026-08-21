import { describe, it, expect } from 'vitest'
import { parseTarget, hostTarget, superWarning } from '@/translate'
import { parseCombo } from '@/keys'

describe('parseTarget', () => {
  it('accepts macos and linux', () => {
    expect(parseTarget('macos')).toBe('macos')
    expect(parseTarget('linux')).toBe('linux')
  })
  it('throws on anything else (including windows)', () => {
    expect(() => parseTarget('windows')).toThrow()
    expect(() => parseTarget('')).toThrow()
  })
})

describe('superWarning', () => {
  it('warns for a mac-Control binding on linux', () => {
    const w = superWarning(parseCombo('Control+L'), 'linux', 'Loop Playback')
    expect(w).toContain('Super')
    expect(w).toContain('Loop Playback')
  })
  it('is silent for mac-Control on macos and for non-Control on linux', () => {
    expect(superWarning(parseCombo('Control+L'), 'macos', 'x')).toBeNull()
    expect(superWarning(parseCombo('Cmd+L'), 'linux', 'x')).toBeNull()
  })
})

describe('hostTarget', () => {
  it('maps darwin to macos and linux to linux', () => {
    expect(hostTarget('darwin')).toBe('macos')
    expect(hostTarget('linux')).toBe('linux')
  })
  it('maps any other platform to linux rather than throwing', () => {
    // resolveResourceDir is where an unsupported host gets rejected.
    expect(hostTarget('win32')).toBe('linux')
    expect(hostTarget('freebsd')).toBe('linux')
  })
  it('defaults to the running platform', () => {
    expect(hostTarget()).toBe(process.platform === 'darwin' ? 'macos' : 'linux')
  })
})
