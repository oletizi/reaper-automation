import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
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
} from '@/wm-linux'

function gsettings(args: string[]): string {
  return execFileSync('gsettings', args, { encoding: 'utf8' }).trim()
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
  const current = new Map<string, string[]>()
  for (const k of keys) {
    const accels = parseGsettingsList(gsettings(['get', GNOME_WM_SCHEMA, k]))
    if (accels.length) current.set(k, accels)
  }

  if (a.revert) {
    // Reset to the schema defaults rather than replaying a saved backup: GNOME
    // knows its own defaults, and a stale backup file would be worse than none.
    const touched = [...current.keys()]
    for (const k of touched) {
      if (a.apply) gsettings(['reset', GNOME_WM_SCHEMA, k])
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
    gsettings(['set', GNOME_WM_SCHEMA, k, formatGsettingsList(keep)])
  }
  console.log('')
  console.log(`freed ${plan.shadows.length} combo(s). REAPER sees them from the next keypress; no restart needed.`)
  return 0
}
