import { join } from 'node:path'
import { parseBuild } from '@/cli/args'
import { runBuild, repoRoot } from '@/build-run'
import { hostTarget, parseTarget } from '@/translate'

export function cmdBuild(argv: string[]): number {
  const a = parseBuild(argv)
  const root = repoRoot()
  const target = a.target ? parseTarget(a.target) : hostTarget()
  const mapping = a.mapping ?? join(root, 'mappings', 'luna.toml')
  const out = a.out ?? join(root, 'build', `luna-${target}.ReaperKeyMap`)
  const b = runBuild({ mapping, out, target: a.target, section: a.section })
  console.log(`section: ${b.section}${b.detected ? ' (ReaTooled detected)' : ''}`)
  for (const w of b.result.warnings) console.error(w)
  const s = b.result.stats
  console.log(`stamp: ${b.stamp}`)
  console.log(`wrote ${out}  (${s.direct} direct, ${s.macro} macro, ${s.script} script, ${s.disabled} disabled; ${s.unmapped} unmapped)`)
  return 0
}
