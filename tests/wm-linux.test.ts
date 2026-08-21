import { describe, it, expect } from 'vitest'
import {
  parseOverrideProfiles,
  unionAccels,
  dconfPathFor,
  chooseSessionType,
  restartAdvice,
  parseGsettingsList,
  parseGnomeAccel,
  parseOurLinuxLabel,
  sameAccel,
  planFreeing,
  formatGsettingsList,
} from '@/adapters/desktop/gnome'

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

describe('chooseSessionType', () => {
  it('picks the seated graphical session, not a tty one', () => {
    // The real case that misled a human: a tty session and a wayland session
    // coexist, and DISPLAY is set because REAPER runs under XWayland.
    expect(chooseSessionType([
      { type: 'tty', active: true, seat: '' },
      { type: 'wayland', active: true, seat: 'seat0' },
      { type: 'unspecified', active: true, seat: '' },
    ])).toBe('wayland')
  })
  it('reports x11 when that is what is seated', () => {
    expect(chooseSessionType([{ type: 'x11', active: true, seat: 'seat0' }])).toBe('x11')
  })
  it('admits it does not know rather than assuming x11', () => {
    expect(chooseSessionType([{ type: 'tty', active: true, seat: '' }])).toBe('unknown')
    expect(chooseSessionType([])).toBe('unknown')
  })
})

describe('restartAdvice', () => {
  it('never offers Alt+F2 on Wayland, where it does not exist', () => {
    const w = restartAdvice('wayland').join(' ')
    expect(w).not.toContain('Alt+F2')
    expect(w).toContain('log out')
  })
  it('offers the in-place restart on X11', () => {
    expect(restartAdvice('x11').join(' ')).toContain('Alt+F2')
  })
  it('gives both when the session type is unknown', () => {
    const u = restartAdvice('unknown').join(' ')
    expect(u).toContain('Alt+F2')
    expect(u).toContain('log out')
  })
})

describe('dconfPathFor', () => {
  it('converts a schema key to the dconf path GNOME actually reads', () => {
    expect(dconfPathFor('org.gnome.desktop.wm.keybindings', 'switch-applications'))
      .toBe('/org/gnome/desktop/wm/keybindings/switch-applications')
  })
  it('keeps hyphenated keys intact', () => {
    expect(dconfPathFor('org.gnome.desktop.wm.keybindings', 'switch-applications-backward'))
      .toBe('/org/gnome/desktop/wm/keybindings/switch-applications-backward')
  })
})

describe('parseOverrideProfiles', () => {
  const override = [
    '[org.gnome.desktop.wm.keybindings]',
    'maximize=@as []',
    '[org.gnome.desktop.wm.keybindings:ubuntu]',
    "switch-windows=['<Alt>Tab']",
    '[org.gnome.settings-daemon.plugins.media-keys:Regolith]',
    "screensaver=['']",
  ].join('\n')

  it('finds the profiles that redefine this schema', () => {
    expect(parseOverrideProfiles(override, 'org.gnome.desktop.wm.keybindings')).toEqual(['ubuntu'])
  })
  it('ignores profiles belonging to a different schema', () => {
    expect(parseOverrideProfiles(override, 'org.gnome.desktop.interface')).toEqual([])
  })
  it('does not treat the unprofiled header as a profile', () => {
    expect(parseOverrideProfiles('[org.gnome.desktop.wm.keybindings]\nmaximize=@as []', 'org.gnome.desktop.wm.keybindings')).toEqual([])
  })
})

describe('unionAccels', () => {
  it('merges profile-specific defaults without duplicating', () => {
    // The real case: switch-windows is [] in the base profile and ['<Alt>Tab']
    // under `ubuntu`. Consulting only the base profile hides the grab entirely.
    expect(unionAccels([[], ['<Alt>Tab'], ['<Alt>Tab', '<Super>Tab']])).toEqual(['<Alt>Tab', '<Super>Tab'])
  })
  it('is empty when every profile is empty', () => {
    expect(unionAccels([[], []])).toEqual([])
  })
})

