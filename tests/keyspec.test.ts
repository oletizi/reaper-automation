import { describe, it, expect } from 'vitest'
import { parse, describe as describeKey, KeySpecError } from '@/keyspec'

describe('parse', () => {
  it('plain letter -> virtkey + ASCII code', () => {
    expect(parse('A')).toEqual({ flags: 1, keycode: 65 })
  })
  it('Cmd -> bit 8, Opt -> bit 16, Control -> bit 32, Shift -> bit 4', () => {
    expect(parse('Cmd+A')).toEqual({ flags: 1 | 8, keycode: 65 })
    expect(parse('Opt+A')).toEqual({ flags: 1 | 16, keycode: 65 })
    expect(parse('Control+A')).toEqual({ flags: 1 | 32, keycode: 65 })
    expect(parse('Shift+A')).toEqual({ flags: 1 | 4, keycode: 65 })
  })
  it('extended nav keys carry the +32768 offset (Left = 32805)', () => {
    expect(parse('Left').keycode).toBe(37 + 32768)
    expect(parse('Cmd+Shift+Left')).toEqual({ flags: 1 | 8 | 4, keycode: 32805 })
  })
  it('keeps a literal + intact', () => {
    expect(parse('Cmd++').keycode).toBe(187) // "=" / "+" OEM key
  })
  it('rejects Linux-flavoured tokens Ctrl / Super / Alt', () => {
    for (const s of ['Ctrl+A', 'Super+A', 'Alt+A']) {
      expect(() => parse(s)).toThrow(KeySpecError)
    }
  })
  it('rejects duplicate modifier and unknown key', () => {
    expect(() => parse('Cmd+Cmd+A')).toThrow(KeySpecError)
    expect(() => parse('Cmd+Nope')).toThrow(KeySpecError)
  })
})

describe('describe', () => {
  it('renders Mac labels on macos and Linux labels on linux', () => {
    const p = parse('Cmd+Shift+Left')
    expect(describeKey(p.flags, p.keycode, 'macos')).toBe('Cmd+Shift+Left')
    expect(describeKey(p.flags, p.keycode, 'linux')).toBe('Ctrl+Shift+Left')
  })
  it('round-trips within a target', () => {
    for (const s of ['Space', 'Cmd+Space', 'Control+L', 'Opt+Home', 'Shift+]']) {
      const p = parse(s)
      const back = describeKey(p.flags, p.keycode, 'macos')
      expect(parse(back)).toEqual(p)
    }
  })
})
