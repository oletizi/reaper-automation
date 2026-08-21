import { describe, it, expect } from 'vitest'
import { parseCombo, KeySpecError } from '@/core/keys'
import { encodeCombo, FLAG_VIRTKEY, FLAG_SHIFT, FLAG_CMD, FLAG_OPT, FLAG_CONTROL } from '@/adapters/reaper/keycodes'

const enc = (s: string) => encodeCombo(parseCombo(s))

describe('encodeCombo', () => {
  it('plain letter -> virtkey + ASCII code', () => {
    expect(enc('A')).toEqual({ flags: FLAG_VIRTKEY, keycode: 65 })
  })
  it('Cmd -> bit 8, Opt -> bit 16, Control -> bit 32, Shift -> bit 4', () => {
    expect(enc('Cmd+A')).toEqual({ flags: FLAG_VIRTKEY | FLAG_CMD, keycode: 65 })
    expect(enc('Opt+A')).toEqual({ flags: FLAG_VIRTKEY | FLAG_OPT, keycode: 65 })
    expect(enc('Control+A')).toEqual({ flags: FLAG_VIRTKEY | FLAG_CONTROL, keycode: 65 })
    expect(enc('Shift+A')).toEqual({ flags: FLAG_VIRTKEY | FLAG_SHIFT, keycode: 65 })
  })
  it('extended nav keys carry the +32768 offset (Left = 32805)', () => {
    expect(enc('Left').keycode).toBe(37 + 32768)
    expect(enc('Cmd+Shift+Left')).toEqual({ flags: FLAG_VIRTKEY | FLAG_CMD | FLAG_SHIFT, keycode: 32805 })
  })
  it('folds + onto the = / + OEM key', () => {
    expect(enc('Cmd++').keycode).toBe(187)
  })
  it('encodes the numpad and function rows', () => {
    expect(enc('Num3').keycode).toBe(99)
    expect(enc('F1').keycode).toBe(112)
    expect(enc('F24').keycode).toBe(135)
  })
  it('refuses a hand-built combo with no REAPER key code rather than emitting 0', () => {
    expect(() => encodeCombo({ shift: false, cmd: false, opt: false, control: false, key: 'nope' }))
      .toThrow(KeySpecError)
  })
})
