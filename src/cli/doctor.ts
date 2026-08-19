import { join, dirname } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { parseDoctor } from '@/cli/args'
import { repoRoot, readInstalledStamp } from '@/build-run'
import { readGitStamp, formatStamp } from '@/stamp'
import { resolveResourceDir } from '@/reaper-paths'
import { hostTarget } from '@/translate'

// Report the source -> build -> installed -> last-fired version chain so any
// drift (edited-but-not-rebuilt, built-but-not-installed, or a stale version
// still firing in REAPER) is one command away from visible. Exits non-zero when
// the installed tree is missing or out of step with the source.
export function cmdDoctor(argv: string[]): number {
  const a = parseDoctor(argv)
  const root = repoRoot()
  const target = hostTarget()
  const out = a.out ?? join(root, 'build', `luna-${target}.ReaperKeyMap`)
  const resourceDir = resolveResourceDir({ override: a.resourceDir })

  const source = formatStamp(readGitStamp(root))
  const buildScriptsDir = join(dirname(out), 'Scripts', 'luna')
  const build = existsSync(buildScriptsDir) ? readInstalledStamp(buildScriptsDir) || '(none)' : '(not built)'
  const installedScriptsDir = join(resourceDir, 'Scripts', 'luna')
  const installed = existsSync(installedScriptsDir) ? readInstalledStamp(installedScriptsDir) || '(none)' : '(not installed)'

  const logPath = join(resourceDir, 'luna-debug.log')
  let lastFired = '(no log)'
  if (existsSync(logPath)) {
    const lines = readFileSync(logPath, 'utf8').trimEnd().split('\n')
    const m = lines.length ? lines[lines.length - 1].match(/sha=(\S+)/) : null
    if (m) lastFired = m[1]
  }

  console.log('LUNA doctor')
  console.log(`  source (git):  ${source}`)
  console.log(`  build:         ${build}   (${buildScriptsDir})`)
  console.log(`  installed:     ${installed}   (${installedScriptsDir})`)
  console.log(`  last fired:    ${lastFired}   (${logPath})`)

  const problems: string[] = []
  if (installed === '(not installed)' || installed === '(none)') problems.push('LUNA is not installed in this resource dir')
  else if (installed !== source) problems.push(`installed stamp ${installed} drifted from source ${source} -- run: pnpm ra refresh`)
  if (build !== '(not built)' && build !== '(none)' && build !== source) {
    problems.push(`build stamp ${build} drifted from source ${source} -- run: pnpm ra refresh`)
  }

  if (problems.length) {
    console.log('')
    for (const p of problems) console.log(`  DRIFT: ${p}`)
    return 1
  }
  console.log('  ok: source, build, and installed are all in step.')
  return 0
}
