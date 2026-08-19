import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseWm } from '@/cli/args'
import { repoRoot } from '@/build-run'
import { parseMapping } from '@/mapping'
import { parse as parseKey, describe } from '@/keyspec'
import {
  GNOME_WM_SCHEMA,
  parseGsettingsList,
  planFreeing,
  formatGsettingsList,
  dconfPathFor,
  parseOverrideProfiles,
  unionAccels,
  chooseSessionType,
  restartAdvice,
  type SessionType,
} from '@/wm-linux'

function gsettings(args: string[]): string {
  return execFileSync('gsettings', args, { encoding: 'utf8' }).trim()
}

function dconf(args: string[]): string {
  return execFileSync('dconf', args, { encoding: 'utf8' }).trim()
}

const SCHEMA_DIR = '/usr/share/glib-2.0/schemas'

/**
 * Desktop profiles whose schema defaults we must consult. The session's own
 * XDG_CURRENT_DESKTOP when we have it; otherwise every profile any installed
 * override names for this schema, so a profile-specific default cannot hide.
 */
function desktopProfiles(): { profiles: string[]; guessed: boolean } {
  const env = (process.env.XDG_CURRENT_DESKTOP ?? '').trim()
  if (env) return { profiles: [env], guessed: false }
  const found = new Set<string>()
  try {
    for (const f of readdirSync(SCHEMA_DIR)) {
      if (!f.endsWith('.override')) continue
      for (const p of parseOverrideProfiles(readFileSync(`${SCHEMA_DIR}/${f}`, 'utf8'), GNOME_WM_SCHEMA)) found.add(p)
    }
  } catch {
    // no schema dir: fall back to the base defaults alone
  }
  return { profiles: ['', ...found], guessed: true }
}

/**
 * Schema defaults, read with the memory backend so a gsettings instance bound
 * to some other backend cannot feed us a stale value it once accepted.
 */
function readDefaults(key: string, profiles: string[]): string[] {
  return unionAccels(profiles.map((p) => {
    try {
      const out = execFileSync('gsettings', ['get', GNOME_WM_SCHEMA, key], {
        encoding: 'utf8',
        env: { ...process.env, GSETTINGS_BACKEND: 'memory', XDG_CURRENT_DESKTOP: p },
      }).trim()
      return parseGsettingsList(out)
    } catch {
      return []
    }
  }))
}

/**
 * The effective value GNOME acts on: the dconf user value when the key is set
 * there, otherwise the schema default for this desktop profile. Never
 * `gsettings get` against the ambient backend -- it can report a value GNOME
 * has never seen.
 */
function readAccels(key: string, profiles: string[]): string[] {
  try {
    const raw = dconf(['read', dconfPathFor(GNOME_WM_SCHEMA, key)])
    if (raw) return parseGsettingsList(raw)
  } catch {
    // dconf absent: fall through to defaults
  }
  return readDefaults(key, profiles)
}

/** Write, then read back through dconf and refuse to claim success on a mismatch. */
function writeAccelsVerified(key: string, accels: string[]): void {
  const path = dconfPathFor(GNOME_WM_SCHEMA, key)
  const want = formatGsettingsList(accels)
  dconf(['write', path, want])
  const got = parseGsettingsList(dconf(['read', path]))
  const same = got.length === accels.length && got.every((a, i) => a === accels[i])
  if (!same) {
    throw new Error(
      `wm: wrote ${key} = ${want} but dconf reads back ${formatGsettingsList(got)} -- ` +
        'the change did not take, so nothing was freed',
    )
  }
}

/**
 * Ask logind, not the environment: DISPLAY is set and mutter-x11-frames runs
 * under XWayland too, so neither distinguishes an X11 session from a Wayland
 * one -- and the remedy for a stale grab differs between them.
 */
function detectSessionType(): SessionType {
  try {
    const ids = execFileSync('loginctl', ['list-sessions', '--no-legend'], { encoding: 'utf8' })
      .split('\n').map((l) => l.trim().split(/\s+/)[0]).filter(Boolean)
    const sessions = ids.map((id) => {
      const out = execFileSync('loginctl', ['show-session', id, '-p', 'Type', '-p', 'Active', '-p', 'Seat'], { encoding: 'utf8' })
      const get = (k: string) => (new RegExp(`^${k}=(.*)$`, 'm').exec(out)?.[1] ?? '').trim()
      return { type: get('Type'), active: get('Active') === 'yes', seat: get('Seat') }
    })
    return chooseSessionType(sessions)
  } catch {
    return 'unknown'
  }
}

function haveGsettings(): boolean {
  try {
    execFileSync('gsettings', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Free the combos the Linux desktop grabs before REAPER can see them.
 * Dry-run by default; --apply writes, --revert restores GNOME's own defaults.
 */
export function cmdWm(argv: string[]): number {
  const a = parseWm(argv)

  if (process.platform !== 'linux') {
    console.log(`wm: nothing to do on ${process.platform} -- this reconciles a Linux desktop's key grabs`)
    return 0
  }
  if (!haveGsettings()) {
    console.log('wm: gsettings not found; skipping (not a GNOME-style desktop?)')
    return 0
  }

  const keys = gsettings(['list-keys', GNOME_WM_SCHEMA]).split('\n').map((s) => s.trim()).filter(Boolean).sort()
  const { profiles, guessed } = desktopProfiles()
  if (guessed) {
    console.log(`wm: XDG_CURRENT_DESKTOP is unset; consulting profiles [${profiles.map((p) => p || '(base)').join(', ')}]`)
    console.log('    because a schema default can differ per desktop profile.')
  }
  const current = new Map<string, string[]>()
  for (const k of keys) {
    const accels = readAccels(k, profiles)
    if (accels.length) current.set(k, accels)
  }

  if (a.revert) {
    // Reset to the schema defaults rather than replaying a saved backup: GNOME
    // knows its own defaults, and a stale backup file would be worse than none.
    const touched = [...current.keys()]
    for (const k of touched) {
      if (a.apply) dconf(['reset', dconfPathFor(GNOME_WM_SCHEMA, k)])
    }
    console.log(
      a.apply
        ? `wm: reset ${touched.length} ${GNOME_WM_SCHEMA} key(s) to GNOME defaults`
        : `wm: would reset ${touched.length} ${GNOME_WM_SCHEMA} key(s) to GNOME defaults (dry run; pass --apply)`,
    )
    return 0
  }

  const mappingPath = a.mapping ?? join(repoRoot(), 'mappings', 'luna.toml')
  const mapping = parseMapping(readFileSync(mappingPath, 'utf8'))
  const ours: { label: string; binding: string }[] = []
  for (const b of mapping.bindings) {
    if (b.status !== 'ok' || !b.key) continue
    const { flags, keycode } = parseKey(b.key)
    ours.push({ label: describe(flags, keycode, 'linux'), binding: b.luna })
  }

  const plan = planFreeing(current, ours)
  if (!plan.shadows.length) {
    console.log('wm: the desktop grabs none of our combos -- nothing to free')
    return 0
  }

  console.log(`wm: the desktop grabs ${plan.shadows.length} combo(s) we bind:`)
  for (const s of plan.shadows) {
    console.log(`  ${s.accel.padEnd(24)} ${s.schemaKey}   shadows  ${s.ourLabel} (${s.ourBinding})`)
  }
  console.log('')
  for (const [k, keep] of plan.updates) {
    const shown = keep.length ? formatGsettingsList(keep) : '[] (nothing left on this action)'
    console.log(`  ${a.apply ? 'setting' : 'would set'} ${k} = ${shown}`)
  }
  if (plan.emptied.length) {
    console.log('')
    console.log(`  note: ${plan.emptied.join(', ')} would be left with no shortcut at all.`)
    console.log('  `ra wm --revert --apply` restores GNOME defaults.')
  }

  if (!a.apply) {
    console.log('')
    console.log('(dry run -- nothing changed; pass --apply to free them)')
    return 0
  }
  for (const [k, keep] of plan.updates) {
    writeAccelsVerified(k, keep)
  }
  console.log('')
  console.log(`freed ${plan.shadows.length} combo(s).`)
  // Mutter is supposed to rebind live, but an existing grab can outlive the
  // setting change. Say so rather than promising it already works.
  for (const line of restartAdvice(detectSessionType())) console.log(line)
  return 0
}
