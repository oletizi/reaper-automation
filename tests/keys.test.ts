import { describe, it, expect } from 'vitest'
import { parseCombo, describeCombo, comboIdentity, KeySpecError } from '@/core/keys'

const bare = { shift: false, cmd: false, opt: false, control: false }

describe('parseCombo', () => {
  it('plain letter -> canonical lowercase token, no modifiers', () => {
    expect(parseCombo('A')).toEqual({ ...bare, key: 'a' })
  })
  it('each modifier token sets its own flag', () => {
    expect(parseCombo('Cmd+A')).toEqual({ ...bare, cmd: true, key: 'a' })
    expect(parseCombo('Opt+A')).toEqual({ ...bare, opt: true, key: 'a' })
    expect(parseCombo('Control+A')).toEqual({ ...bare, control: true, key: 'a' })
    expect(parseCombo('Shift+A')).toEqual({ ...bare, shift: true, key: 'a' })
  })
  it('accepts the long modifier spellings', () => {
    expect(parseCombo('Command+A')).toEqual(parseCombo('Cmd+A'))
    expect(parseCombo('Option+A')).toEqual(parseCombo('Opt+A'))
  })
  it('canonicalizes navigation keys', () => {
    expect(parseCombo('Left').key).toBe('left')
    expect(parseCombo('Cmd+Shift+Left')).toEqual({ ...bare, cmd: true, shift: true, key: 'left' })
  })
  it('collapses aliases onto one canonical token', () => {
    expect(parseCombo('Enter').key).toBe('return')
    expect(parseCombo('Escape').key).toBe('esc')
    expect(parseCombo('Del').key).toBe('delete')
  })
  it('keeps a literal + intact and folds it onto the = key', () => {
    expect(parseCombo('Cmd++')).toEqual({ ...bare, cmd: true, key: '=' })
  })
  it('rejects Linux-flavoured tokens Ctrl / Super / Alt', () => {
    // Translation is a display concern; accepting both spellings on input would
    // let one combo be written two ways and collide with itself.
    for (const s of ['Ctrl+A', 'Super+A', 'Alt+A']) {
      expect(() => parseCombo(s)).toThrow(KeySpecError)
    }
  })
  it('rejects duplicate modifier, unknown key and empty spec', () => {
    expect(() => parseCombo('Cmd+Cmd+A')).toThrow(KeySpecError)
    expect(() => parseCombo('Cmd+Nope')).toThrow(KeySpecError)
    expect(() => parseCombo('   ')).toThrow(KeySpecError)
  })
})

describe('comboIdentity', () => {
  it('is equal for two spellings of the same combo', () => {
    expect(comboIdentity(parseCombo('Cmd+Enter'))).toBe(comboIdentity(parseCombo('Command+Return')))
  })
  it('differs when any modifier or the key differs', () => {
    const id = (s: string) => comboIdentity(parseCombo(s))
    expect(id('Cmd+A')).not.toBe(id('Opt+A'))
    expect(id('Cmd+A')).not.toBe(id('Cmd+Shift+A'))
    expect(id('Cmd+A')).not.toBe(id('Cmd+B'))
  })
})

describe('describeCombo', () => {
  it('renders Mac labels on macos and Linux labels on linux', () => {
    const c = parseCombo('Cmd+Shift+Left')
    expect(describeCombo(c, 'macos')).toBe('Cmd+Shift+Left')
    expect(describeCombo(c, 'linux')).toBe('Ctrl+Shift+Left')
  })
  it('renders punctuation verbatim and named keys capitalized', () => {
    expect(describeCombo(parseCombo('Shift+]'), 'macos')).toBe('Shift+]')
    expect(describeCombo(parseCombo('Num3'), 'macos')).toBe('Num3')
    expect(describeCombo(parseCombo('f10'), 'macos')).toBe('F10')
  })
  it('round-trips within a target', () => {
    for (const s of ['Space', 'Cmd+Space', 'Control+L', 'Opt+Home', 'Shift+]']) {
      const c = parseCombo(s)
      expect(parseCombo(describeCombo(c, 'macos'))).toEqual(c)
    }
  })
})
