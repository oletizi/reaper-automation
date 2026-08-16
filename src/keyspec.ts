export const FLAG_VIRTKEY = 1
export const FLAG_SHIFT = 4
export const FLAG_CMD = 8
export const FLAG_OPT = 16
export const FLAG_CONTROL = 32

export class KeySpecError extends Error {}

// Input token -> bit. Mac-native only; Ctrl/Super/Win/Meta/Alt are rejected.
const MODIFIERS: Record<string, number> = {
  shift: FLAG_SHIFT,
  cmd: FLAG_CMD,
  command: FLAG_CMD,
  opt: FLAG_OPT,
  option: FLAG_OPT,
  control: FLAG_CONTROL,
}

const EXTENDED_OFFSET = 32768
const EXTENDED: Record<string, number> = {
  pgup: 33, pgdn: 34, end: 35, home: 36, left: 37, up: 38,
  right: 39, down: 40, insert: 45, delete: 46, del: 46,
}

const NAMED: Record<string, number> = {
  backspace: 8, tab: 9, return: 13, enter: 13, esc: 27, escape: 27, space: 32,
  ';': 186, '=': 187, '+': 187, ',': 188, '-': 189, '.': 190, '/': 191,
  '`': 192, '[': 219, '\\': 220, ']': 221, "'": 222,
  nummultiply: 106, numplus: 107, numminus: 109, numdecimal: 110, numdivide: 111,
}
for (let i = 0; i < 10; i++) NAMED[`num${i}`] = 96 + i
for (let i = 1; i <= 24; i++) NAMED[`f${i}`] = 111 + i

function splitSpec(spec: string): string[] {
  // Split on '+' but keep a literal '+' key intact (e.g. "Cmd++").
  const parts: string[] = []
  let buf = ''
  for (let i = 0; i < spec.length; i++) {
    const ch = spec[i]
    if (ch === '+' && buf && i !== spec.length - 1) {
      parts.push(buf)
      buf = ''
    } else {
      buf += ch
    }
  }
  parts.push(buf)
  const filtered = parts.filter((p) => p !== '')
  return filtered.length ? filtered : [spec]
}

function keycodeOf(key: string, spec: string): number {
  const low = key.toLowerCase()
  if (low in EXTENDED) return EXTENDED[low] + EXTENDED_OFFSET
  if (low in NAMED) return NAMED[low]
  if (key.length === 1) {
    const ch = key.toUpperCase()
    if ((ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9')) return ch.charCodeAt(0)
  }
  throw new KeySpecError(`unknown key ${JSON.stringify(key)} in ${JSON.stringify(spec)}`)
}

export function parse(spec: string): { flags: number; keycode: number } {
  if (!spec || !spec.trim()) throw new KeySpecError('empty key spec')
  const parts = splitSpec(spec.trim())
  const key = parts[parts.length - 1]
  const mods = parts.slice(0, -1)

  let flags = FLAG_VIRTKEY
  for (const m of mods) {
    const low = m.toLowerCase()
    const bit = MODIFIERS[low]
    if (bit === undefined) throw new KeySpecError(`unknown modifier ${JSON.stringify(m)} in ${JSON.stringify(spec)}`)
    if (flags & bit) throw new KeySpecError(`duplicate modifier ${JSON.stringify(m)} in ${JSON.stringify(spec)}`)
    flags |= bit
  }
  return { flags, keycode: keycodeOf(key, spec) }
}

export function describe(flags: number, keycode: number, target: 'macos' | 'linux'): string {
  const labels =
    target === 'macos'
      ? { cmd: 'Cmd', opt: 'Opt', control: 'Control' }
      : { cmd: 'Ctrl', opt: 'Alt', control: 'Super' }

  const names: string[] = []
  if (flags & FLAG_CMD) names.push(labels.cmd)
  if (flags & FLAG_OPT) names.push(labels.opt)
  if (flags & FLAG_CONTROL) names.push(labels.control)
  if (flags & FLAG_SHIFT) names.push('Shift')

  let label: string | null = null
  if (keycode > EXTENDED_OFFSET) {
    const raw = keycode - EXTENDED_OFFSET
    for (const [k, v] of Object.entries(EXTENDED)) {
      if (v === raw) { label = k.charAt(0).toUpperCase() + k.slice(1); break }
    }
  }
  if (label === null) {
    for (const [k, v] of Object.entries(NAMED)) {
      if (v === keycode) { label = /^[a-z0-9]+$/i.test(k) ? k.charAt(0).toUpperCase() + k.slice(1) : k; break }
    }
  }
  if (label === null && keycode > 32 && keycode < 127) label = String.fromCharCode(keycode)
  if (label === null) label = `VK${keycode}`

  return [...names, label].join('+')
}
