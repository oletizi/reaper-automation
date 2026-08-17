import { parseBuild } from '@/cli/args'
import { runBuild } from '@/build-run'

export function cmdBuild(argv: string[]): number {
  const a = parseBuild(argv)
  const b = runBuild({ mapping: a.mapping, out: a.out, target: a.target, section: a.section })
  console.log(`section: ${b.section}${b.detected ? ' (ReaTooled detected)' : ''}`)
  for (const w of b.result.warnings) console.error(w)
  const s = b.result.stats
  console.log(`stamp: ${b.stamp}`)
  console.log(`wrote ${a.out}  (${s.direct} direct, ${s.macro} macro, ${s.script} script, ${s.disabled} disabled; ${s.unmapped} unmapped)`)
  return 0
}
