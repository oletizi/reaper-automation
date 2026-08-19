/**
 * Reconcile the Linux desktop's own keybindings with ours.
 *
 * GNOME grabs some combos before any application sees them -- Alt+Tab most
 * consequentially, which shadows LUNA's reverse tab-to-transient. Per
 * CONSTITUTION.md Principle 5 the 2D selection vocabulary outranks a native
 * default, and the window manager's is a native default, so the combo goes to
 * us. This module works out which of our bindings the desktop is currently
 * swallowing and what to remove to free them.
 *
 * Pure functions only: reading and writing gsettings lives in the CLI, so the
 * planning is testable without a desktop session.
 */

export const GNOME_WM_SCHEMA = 'org.gnome.desktop.wm.keybindings'

export type Mod = 'ctrl' | 'alt' | 'super' | 'shift'
export interface Accel {
  mods: Set<Mod>
  key: string
}

/** GNOME key names that mean the same thing as one of ours, spelled differently. */
const GNOME_KEY_ALIASES: Record<string, string> = {
  backspace: 'backspace',
  page_up: 'pgup',
  page_down: 'pgdn',
  prior: 'pgup',
  next: 'pgdn',
  escape: 'esc',
  enter: 'return',
  kp_enter: 'return',
}

function canonKey(k: string): string {
  const low = k.toLowerCase()
  return GNOME_KEY_ALIASES[low] ?? low
}

/** Parse the array gsettings prints: `@as []` or `['<Super>Tab', '<Alt>Tab']`. */
export function parseGsettingsList(raw: string): string[] {
  const s = raw.trim()
  if (s === '@as []' || s === '[]') return []
  const out: string[] = []
  for (const m of s.matchAll(/'((?:[^'\\]|\\.)*)'/g)) out.push(m[1].replace(/\\(.)/g, '$1'))
  return out
}

/** `<Shift><Alt>Tab` -> {mods:{shift,alt}, key:'tab'}. Null for anything exotic. */
export function parseGnomeAccel(a: string): Accel | null {
  const mods = new Set<Mod>()
  let rest = a
  for (;;) {
    const m = /^<([A-Za-z]+)>/.exec(rest)
    if (!m) break
    const name = m[1].toLowerCase()
    if (name === 'control' || name === 'primary' || name === 'ctrl') mods.add('ctrl')
    else if (name === 'alt' || name === 'mod1') mods.add('alt')
    else if (name === 'super' || name === 'mod4') mods.add('super')
    else if (name === 'shift') mods.add('shift')
    else return null // Hyper, Meta, Release, ... : don't claim to understand it
    rest = rest.slice(m[0].length)
  }
  if (!rest || rest.startsWith('XF86') || rest.startsWith('KP_')) return null
  return { mods, key: canonKey(rest) }
}

/** Our own Linux-rendered label (`Alt+Shift+Tab`) in the same shape. */
export function parseOurLinuxLabel(label: string): Accel | null {
  const parts = label.split('+').filter((p) => p !== '')
  if (!parts.length) return null
  const key = parts.pop() as string
  const mods = new Set<Mod>()
  for (const p of parts) {
    const low = p.toLowerCase()
    if (low === 'ctrl') mods.add('ctrl')
    else if (low === 'alt') mods.add('alt')
    else if (low === 'super') mods.add('super')
    else if (low === 'shift') mods.add('shift')
    else return null
  }
  return { mods, key: canonKey(key) }
}

export function sameAccel(a: Accel, b: Accel): boolean {
  if (a.key !== b.key) return false
  if (a.mods.size !== b.mods.size) return false
  for (const m of a.mods) if (!b.mods.has(m)) return false
  return true
}

export interface Shadow {
  schemaKey: string
  accel: string
  ourLabel: string
  ourBinding: string
}
export interface Plan {
  shadows: Shadow[]
  /** schemaKey -> the accels that should remain after freeing ours. */
  updates: Map<string, string[]>
  /** schemaKey values that would be emptied entirely. */
  emptied: string[]
}

/**
 * Work out which desktop bindings shadow ours and what each setting becomes
 * once ours are removed. Only the colliding accel is dropped -- every other
 * accel on that action is preserved, so freeing Alt+Tab leaves Super+Tab
 * switching applications exactly as before.
 */
export function planFreeing(
  current: Map<string, string[]>,
  ours: { label: string; binding: string }[],
): Plan {
  const parsedOurs = ours
    .map((o) => ({ ...o, accel: parseOurLinuxLabel(o.label) }))
    .filter((o): o is typeof o & { accel: Accel } => o.accel !== null)

  const shadows: Shadow[] = []
  const updates = new Map<string, string[]>()
  const emptied: string[] = []

  for (const [schemaKey, accels] of current) {
    const keep: string[] = []
    let hit = false
    for (const a of accels) {
      const parsed = parseGnomeAccel(a)
      const match = parsed && parsedOurs.find((o) => sameAccel(o.accel, parsed))
      if (match) {
        hit = true
        shadows.push({ schemaKey, accel: a, ourLabel: match.label, ourBinding: match.binding })
      } else {
        keep.push(a)
      }
    }
    if (hit) {
      updates.set(schemaKey, keep)
      if (!keep.length) emptied.push(schemaKey)
    }
  }
  return { shadows, updates, emptied }
}

/** Render an accel list back into the literal gsettings wants. */
export function formatGsettingsList(accels: string[]): string {
  return '[' + accels.map((a) => `'${a.replace(/'/g, "\\'")}'`).join(', ') + ']'
}

export type SessionType = 'wayland' | 'x11' | 'unknown'

/**
 * Pick the graphical session's type out of `loginctl show-session` results.
 *
 * DISPLAY and the presence of mutter-x11-frames are NOT evidence of an X11
 * session: an X11 client under XWayland sees both. Getting this wrong matters,
 * because the two sessions have different remedies and only one of them exists
 * on Wayland.
 */
export function chooseSessionType(sessions: { type: string; active: boolean; seat: string }[]): SessionType {
  const graphical = sessions.filter((s) => s.type === 'wayland' || s.type === 'x11')
  const seated = graphical.filter((s) => s.seat && s.seat !== '-')
  const pick = seated.find((s) => s.active) ?? seated[0] ?? graphical.find((s) => s.active) ?? graphical[0]
  if (!pick) return 'unknown'
  return pick.type === 'wayland' ? 'wayland' : 'x11'
}

/** How to make a stale compositor grab go away, for this session type. */
export function restartAdvice(t: SessionType): string[] {
  if (t === 'wayland') {
    return [
      'This is a Wayland session: there is no in-place restart of GNOME Shell.',
      'If the desktop still swallows the combo, log out and back in.',
    ]
  }
  if (t === 'x11') {
    return [
      'This is an X11 session: if the desktop still swallows the combo, its grab',
      'is stale -- press Alt+F2, type `r`, Enter to restart GNOME Shell in place',
      '(windows survive).',
    ]
  }
  return [
    'Could not determine the session type. If the desktop still swallows the',
    'combo: on X11 press Alt+F2 then `r`; on Wayland log out and back in.',
  ]
}

