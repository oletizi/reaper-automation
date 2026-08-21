// REAPER's key encoding: the flag bits and virtual key codes a `KEY` line in
// reaper-kb.ini carries. This is host vocabulary and belongs to the REAPER
// adapter -- `keys.ts` holds the portable combo and knows none of it.

import { type KeyCombo, KeySpecError } from '@/core/keys'

export const FLAG_VIRTKEY = 1
export const FLAG_SHIFT = 4
export const FLAG_CMD = 8
export const FLAG_OPT = 16
export const FLAG_CONTROL = 32

/** Extended (navigation) keys are the virtual key code plus this offset. */
const EXTENDED_OFFSET = 32768

const EXTENDED: Record<string, number> = {
  pgup: 33, pgdn: 34, end: 35, home: 36, left: 37, up: 38,
  right: 39, down: 40, insert: 45, delete: 46,
}

const NAMED: Record<string, number> = {
  backspace: 8, tab: 9, return: 13, esc: 27, space: 32,
  ';': 186, '=': 187, ',': 188, '-': 189, '.': 190, '/': 191,
  '`': 192, '[': 219, '\\': 220, ']': 221, "'": 222,
  nummultiply: 106, numplus: 107, numminus: 109, numdecimal: 110, numdivide: 111,
}
for (let i = 0; i < 10; i++) NAMED[`num${i}`] = 96 + i
for (let i = 1; i <= 24; i++) NAMED[`f${i}`] = 111 + i

export interface ReaperKey {
  flags: number
  keycode: number
}

/** Encode a portable combo as the flags/keycode pair a reaper-kb.ini KEY line wants. */
export function encodeCombo(c: KeyCombo): ReaperKey {
  let flags = FLAG_VIRTKEY
  if (c.shift) flags |= FLAG_SHIFT
  if (c.cmd) flags |= FLAG_CMD
  if (c.opt) flags |= FLAG_OPT
  if (c.control) flags |= FLAG_CONTROL

  if (c.key in EXTENDED) return { flags, keycode: EXTENDED[c.key] + EXTENDED_OFFSET }
  if (c.key in NAMED) return { flags, keycode: NAMED[c.key] }
  if (c.key.length === 1) {
    const ch = c.key.toUpperCase()
    if ((ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9')) return { flags, keycode: ch.charCodeAt(0) }
  }
  // Unreachable via parseCombo, which rejects unknown keys; a guard rather than
  // a silent 0 keycode if a KeyCombo is ever constructed by hand (Principle 2).
  throw new KeySpecError(`no REAPER key code for ${JSON.stringify(c.key)}`)
}
