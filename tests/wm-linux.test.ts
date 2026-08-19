import { describe, it, expect } from 'vitest'
import {
  parseGsettingsList,
  parseGnomeAccel,
  parseOurLinuxLabel,
  sameAccel,
  planFreeing,
  formatGsettingsList,
} from '@/wm-linux'

describe('parseGsettingsList', () => {
  it('reads the empty form gsettings prints', () => {
    expect(parseGsettingsList('@as []')).toEqual([])
    expect(parseGsettingsList('[]')).toEqual([])
  })
  it('reads a populated list', () => {
    expect(parseGsettingsList("['<Super>Tab', '<Alt>Tab']")).toEqual(['<Super>Tab', '<Alt>Tab'])
  })
})

describe('parseGnomeAccel', () => {
  it('parses modifiers in any order', () => {
    const a = parseGnomeAccel('<Shift><Alt>Tab')!
    expect(a.key).toBe('tab')
    expect([...a.mods].sort()).toEqual(['alt', 'shift'])
  })
  it('treats <Primary> and <Control> alike', () => {
    expect(sameAccel(parseGnomeAccel('<Primary>a')!, parseGnomeAccel('<Control>a')!)).toBe(true)
  })
  it('refuses what it does not understand rather than guessing', () => {
    // A wrong guess here would silently delete one of the user's shortcuts.
    expect(parseGnomeAccel('<Hyper>Tab')).toBeNull()
    expect(parseGnomeAccel('XF86Keyboard')).toBeNull()
    expect(parseGnomeAccel('<Super>KP_Next')).toBeNull()
  })
})

describe('parseOurLinuxLabel', () => {
  it('matches our rendering against GNOME spelling', () => {
    expect(sameAccel(parseOurLinuxLabel('Alt+Shift+Tab')!, parseGnomeAccel('<Shift><Alt>Tab')!)).toBe(true)
    expect(sameAccel(parseOurLinuxLabel('Super+Down')!, parseGnomeAccel('<Super>Down')!)).toBe(true)
  })
  it('reconciles differing names for the same key', () => {
    expect(sameAccel(parseOurLinuxLabel('Alt+PgUp')!, parseGnomeAccel('<Alt>Page_Up')!)).toBe(true)
  })
  it('does not match a different modifier set', () => {
    expect(sameAccel(parseOurLinuxLabel('Alt+Tab')!, parseGnomeAccel('<Super>Tab')!)).toBe(false)
    expect(sameAccel(parseOurLinuxLabel('Alt+Tab')!, parseGnomeAccel('<Shift><Alt>Tab')!)).toBe(false)
  })
})

describe('planFreeing', () => {
  const current = new Map<string, string[]>([
    ['switch-applications', ['<Super>Tab', '<Alt>Tab']],
    ['switch-applications-backward', ['<Shift><Super>Tab', '<Shift><Alt>Tab']],
    ['close', ['<Alt>F4']],
  ])
  const ours = [
    { label: 'Alt+Tab', binding: 'Tab to Transient (previous)' },
    { label: 'Alt+Shift+Tab', binding: 'Extend Selection To Previous Transient' },
  ]

  it('finds only the combos that actually collide', () => {
    const p = planFreeing(current, ours)
    expect(p.shadows.map((s) => s.accel).sort()).toEqual(['<Alt>Tab', '<Shift><Alt>Tab'])
    expect(p.updates.has('close')).toBe(false)
  })

  it('removes only our accel and keeps the rest of that action', () => {
    // The whole point: freeing Alt+Tab must leave Super+Tab switching apps.
    const p = planFreeing(current, ours)
    expect(p.updates.get('switch-applications')).toEqual(['<Super>Tab'])
    expect(p.updates.get('switch-applications-backward')).toEqual(['<Shift><Super>Tab'])
    expect(p.emptied).toEqual([])
  })

  it('reports an action that would be left with no shortcut at all', () => {
    const p = planFreeing(new Map([['cycle-windows', ['<Alt>Escape']]]), [
      { label: 'Alt+Esc', binding: 'Something' },
    ])
    expect(p.emptied).toEqual(['cycle-windows'])
  })

  it('is a no-op when nothing collides', () => {
    const p = planFreeing(current, [{ label: 'Ctrl+Shift+Q', binding: 'x' }])
    expect(p.shadows).toEqual([])
    expect(p.updates.size).toBe(0)
  })
})

describe('formatGsettingsList', () => {
  it('round-trips through the parser', () => {
    const v = ['<Super>Tab', '<Shift><Super>Tab']
    expect(parseGsettingsList(formatGsettingsList(v))).toEqual(v)
  })
  it('emits the empty list gsettings accepts', () => {
    expect(formatGsettingsList([])).toBe('[]')
  })
})
