import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { parsePrefsCmd } from '@/cli/args'
import { repoRoot } from '@/build-run'
import { resolveResourceDir } from '@/reaper-paths'
import { parseIni, writeValue, diffIni } from '@/ini'
import { parsePrefs, statusOf, toPrefBlock } from '@/prefs'

/**
 * `ra prefs` -- bring this machine's REAPER preferences to the declared set.
 *
 * REAPER rewrites reaper.ini wholesale when it exits, so any edit made while it
 * is running is discarded without a word. That is the same silent-no-op failure
 * `ra wm` was built to avoid, so this refuses to touch the file while REAPER is
 * running rather than appearing to succeed.
 */
export function cmdPrefs(argv: string[]): number {
  const a = parsePrefsCmd(argv)
  const root = repoRoot()
  const resourceDir = resolveResourceDir({ override: a.resourceDir })
  const iniPath = a.ini ?? join(resourceDir, 'reaper.ini')
  const snapshotPath = a.snapshot ?? join(resourceDir, 'reaper.ini.ra-snapshot')

  if (!existsSync(iniPath)) {
    console.error(`prefs: ${iniPath} does not exist`)
    return 1
  }

  // --snapshot: record the current file so a later --changed can show what the
  // DAW's own UI wrote. This is how a setting's real value is learned.
  if (a.snapshotMode) {
    copyFileSync(iniPath, snapshotPath)
    console.log(`snapshot -> ${snapshotPath}`)
    console.log('Now change the setting in REAPER, quit REAPER, and run `ra prefs --changed`.')
    return 0
  }

  // --changed: diff the live file against the snapshot. Every line is a value
  // REAPER itself produced, so it can be declared without guessing an encoding.
  if (a.changed) {
    if (!existsSync(snapshotPath)) {
      console.error(`prefs --changed: no snapshot at ${snapshotPath}; run \`ra prefs --snapshot\` first`)
      return 1
    }
    const before = parseIni(readFileSync(snapshotPath, 'utf8'))
    const after = parseIni(readFileSync(iniPath, 'utf8'))
    const changes = diffIni(before, after).filter((c) => !NOISY.test(c.key))
    if (!changes.length) {
      console.log('prefs: nothing changed since the snapshot')
      return 0
    }
    console.log(`prefs: ${changes.length} key(s) changed since the snapshot`)
    for (const c of changes) {
      console.log(`  [${c.section}] ${c.key}: ${c.before ?? '(absent)'} -> ${c.after ?? '(absent)'}`)
    }
    console.log('')
    console.log('Paste into prefs/reaper.toml the ones you meant to change:')
    for (const c of changes) {
      if (c.after === undefined) continue
      console.log('')
      console.log(toPrefBlock(c.section, c.key, c.after, 'TODO: why this setting'))
    }
    return 0
  }

  const prefsPath = a.prefs ?? join(root, 'prefs', 'reaper.toml')
  if (!existsSync(prefsPath)) {
    console.error(`prefs: ${prefsPath} does not exist`)
    return 1
  }
  const doc = parsePrefs(readFileSync(prefsPath, 'utf8'))
  const text = readFileSync(iniPath, 'utf8')
  const status = statusOf(doc.prefs, parseIni(text))

  if (!status.length) {
    console.log(`prefs: ${prefsPath} declares nothing yet -- use --snapshot / --changed to capture a setting`)
    return 0
  }

  const pending = status.filter((s) => s.state !== 'match')
  for (const s of status) {
    const mark = s.state === 'match' ? 'ok      ' : s.state === 'absent' ? 'absent  ' : 'differs '
    console.log(`  ${mark} [${s.pref.section}] ${s.pref.key} = ${s.pref.value}${s.state === 'differs' ? `  (currently ${s.actual})` : ''}`)
  }
  if (!pending.length) {
    console.log(`prefs: all ${status.length} declared setting(s) already match`)
    return 0
  }
  if (!a.apply) {
    console.log('')
    console.log(`(dry run -- ${pending.length} setting(s) would change; pass --apply)`)
    return 0
  }

  if (reaperRunning()) {
    console.error('prefs: REAPER is running. It rewrites reaper.ini on exit, so an edit now would be')
    console.error('       silently discarded. Quit REAPER and run this again.')
    return 1
  }

  const backup = `${iniPath}.ra-backup`
  copyFileSync(iniPath, backup)
  let next = text
  for (const s of pending) next = writeValue(next, s.pref.section, s.pref.key, s.pref.value)
  writeFileSync(iniPath, next)

  // Verify by re-reading the file, not by trusting the write.
  const after = parseIni(readFileSync(iniPath, 'utf8'))
  const bad = statusOf(doc.prefs, after).filter((s) => s.state !== 'match')
  if (bad.length) {
    console.error(`prefs: wrote ${iniPath} but ${bad.length} setting(s) did not take; backup at ${backup}`)
    return 1
  }
  console.log('')
  console.log(`applied ${pending.length} setting(s) to ${iniPath} (backup: ${backup})`)
  return 0
}

/**
 * Keys REAPER rewrites as a side effect of being used -- last-opened paths,
 * window geometry, which Preferences page you were last on. They are not
 * settings, and they would drown a --changed report in noise.
 */
const NOISY = /^(lastproj|lastprojuiref|prefspage|recentfx|reccfg|lastcursorpos|lastentered|.*_wnd_?vis|.*wndsize|.*wndpos)/i

function reaperRunning(): boolean {
  try {
    execFileSync('pgrep', ['-x', 'reaper'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}
