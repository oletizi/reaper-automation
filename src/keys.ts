// The portable key-combo grammar.
//
// This module knows what `Cmd+Shift+Left` *means* and nothing about how any host
// writes it down. Principle 5 calls the 2D selection vocabulary the portable
// core, and this is the piece of it a machine can act on: the same combo has to
// mean the same thing on macOS and Linux and in every DAW backend, so no host's
// encoding may leak in here. REAPER's virtual-key encoding lives in the REAPER
// adapter (`reaper-keycodes.ts`); the desktop adapter renders its own.
//
// Modifier tokens are Mac-native (Cmd/Opt/Control/Shift), matching LUNA's own
// names -- see mappings/luna.toml. Linux-flavoured tokens (Ctrl/Super/Alt) are
// rejected rather than translated, because translation is a *display* concern
// (describeCombo) and accepting both spellings on input would let the same combo
// be written two ways and collide with itself.

export class KeySpecError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KeySpecError'
  }
}

export interface KeyCombo {
  shift: boolean
  cmd: boolean
  opt: boolean
  control: boolean
  /** Canonical key token: a letter, a digit, a punctuation token, or a named key. */
  key: string
}

type ModifierName = 'shift' | 'cmd' | 'opt' | 'control'

const MODIFIERS: Record<string, ModifierName> = {
  shift: 'shift',
  cmd: 'cmd',
  command: 'cmd',
  opt: 'opt',
  option: 'opt',
  control: 'control',
}

/** Navigation/editing keys that hosts typically encode apart from the character keys. */
export const EXTENDED_KEYS: ReadonlySet<string> = new Set([
  'pgup', 'pgdn', 'end', 'home', 'left', 'up', 'right', 'down', 'insert', 'delete',
])

/** Punctuation keys, canonical as themselves and displayed verbatim. */
export const PUNCTUATION_KEYS: ReadonlySet<string> = new Set([
  ';', '=', ',', '-', '.', '/', '`', '[', '\\', ']', "'",
])

const NAMED_KEYS: ReadonlySet<string> = new Set([
  'backspace', 'tab', 'return', 'esc', 'space',
  'nummultiply', 'numplus', 'numminus', 'numdecimal', 'numdivide',
  ...Array.from({ length: 10 }, (_, i) => `num${i}`),
  ...Array.from({ length: 24 }, (_, i) => `f${i + 1}`),
])

// Spellings that name a key we already have a canonical token for. Collapsing
// them here is what keeps two spellings of one combo from being treated as two
// different bindings.
const KEY_ALIASES: Record<string, string> = {
  enter: 'return',
  escape: 'esc',
  del: 'delete',
  '+': '=', // the same physical OEM key
}

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

function canonicalKey(raw: string, spec: string): string {
  const low = raw.toLowerCase()
  const token = KEY_ALIASES[low] ?? low
  if (EXTENDED_KEYS.has(token) || NAMED_KEYS.has(token) || PUNCTUATION_KEYS.has(token)) return token
  if (raw.length === 1) {
    if (token >= 'a' && token <= 'z') return token
    if (token >= '0' && token <= '9') return token
  }
  throw new KeySpecError(`unknown key ${JSON.stringify(raw)} in ${JSON.stringify(spec)}`)
}

export function parseCombo(spec: string): KeyCombo {
  if (!spec || !spec.trim()) throw new KeySpecError('empty key spec')
  const parts = splitSpec(spec.trim())
  const raw = parts[parts.length - 1]

  const combo: KeyCombo = { shift: false, cmd: false, opt: false, control: false, key: '' }
  for (const m of parts.slice(0, -1)) {
    const name = MODIFIERS[m.toLowerCase()]
    if (name === undefined) throw new KeySpecError(`unknown modifier ${JSON.stringify(m)} in ${JSON.stringify(spec)}`)
    if (combo[name]) throw new KeySpecError(`duplicate modifier ${JSON.stringify(m)} in ${JSON.stringify(spec)}`)
    combo[name] = true
  }
  combo.key = canonicalKey(raw, spec)
  return combo
}

/**
 * A stable string identifying the combo, for collision detection and map keys.
 * Two specs that mean the same combo produce the same identity.
 */
export function comboIdentity(c: KeyCombo): string {
  return `${c.cmd ? 'C' : ''}${c.opt ? 'O' : ''}${c.control ? 'T' : ''}${c.shift ? 'S' : ''}:${c.key}`
}

function displayKey(key: string): string {
  if (PUNCTUATION_KEYS.has(key)) return key
  if (key.length === 1) return key.toUpperCase()
  return key.charAt(0).toUpperCase() + key.slice(1)
}

/**
 * Human-readable combo, rendered with the modifier names the given platform's
 * users actually say. This is presentation only -- the combo is unchanged.
 */
export function describeCombo(c: KeyCombo, target: 'macos' | 'linux'): string {
  const labels =
    target === 'macos'
      ? { cmd: 'Cmd', opt: 'Opt', control: 'Control' }
      : { cmd: 'Ctrl', opt: 'Alt', control: 'Super' }

  const names: string[] = []
  if (c.cmd) names.push(labels.cmd)
  if (c.opt) names.push(labels.opt)
  if (c.control) names.push(labels.control)
  if (c.shift) names.push('Shift')

  return [...names, displayKey(c.key)].join('+')
}
