import { parse as parseToml } from 'smol-toml'
import type { IniEntry } from '@/ini'
import { readValue } from '@/ini'

/**
 * Declared DAW preferences: the settings this project asserts, so a fresh
 * machine can be brought to the maintainer's configuration in one command.
 *
 * Values are CAPTURED, never reverse-engineered. Most of REAPER's ini keys are
 * opaque bitfields with no documented encoding, and guessing at one means
 * writing a number into a file the user depends on. The workflow is instead:
 * snapshot, change the setting in the DAW's own UI, capture the delta. What
 * gets declared is then a value REAPER itself produced.
 */

export class PrefsError extends Error {}

export interface Pref {
  section: string
  key: string
  value: string
  why?: string
}
export interface PrefsDoc {
  daw: string
  prefs: Pref[]
}

export function parsePrefs(tomlText: string): PrefsDoc {
  const doc: unknown = parseToml(tomlText)
  if (typeof doc !== 'object' || doc === null) throw new PrefsError('prefs: top-level TOML is not a table')
  const rec = doc as Record<string, unknown>
  const meta = (rec.meta ?? {}) as Record<string, unknown>
  if (typeof meta.daw !== 'string') throw new PrefsError("prefs: meta.daw missing or not a string")

  const raw = rec.pref
  if (raw !== undefined && !Array.isArray(raw)) throw new PrefsError('prefs: [[pref]] is not an array')
  const prefs = (Array.isArray(raw) ? raw : []).map((p, i) => {
    const where = `prefs.pref[${i}]`
    if (typeof p !== 'object' || p === null) throw new PrefsError(`${where}: not a table`)
    const r = p as Record<string, unknown>
    for (const f of ['section', 'key', 'value'] as const) {
      if (typeof r[f] !== 'string') throw new PrefsError(`${where}.${f}: missing or not a string`)
    }
    if (r.why !== undefined && typeof r.why !== 'string') throw new PrefsError(`${where}.why: not a string`)
    return { section: r.section as string, key: r.key as string, value: r.value as string, why: r.why as string | undefined }
  })
  return { daw: meta.daw, prefs }
}

export interface PrefStatus {
  pref: Pref
  actual: string | undefined
  state: 'match' | 'differs' | 'absent'
}

/** Compare every declared pref against what the ini currently holds. */
export function statusOf(prefs: Pref[], entries: IniEntry[]): PrefStatus[] {
  return prefs.map((pref) => {
    const actual = readValue(entries, pref.section, pref.key)
    const state: PrefStatus['state'] = actual === undefined ? 'absent' : actual === pref.value ? 'match' : 'differs'
    return { pref, actual, state }
  })
}

/** Render a captured ini change as the TOML block to paste into the prefs file. */
export function toPrefBlock(section: string, key: string, value: string, why: string): string {
  return ['[[pref]]', `section = "${section}"`, `key = "${key}"`, `value = "${value}"`, `why = "${why}"`].join('\n')
}
