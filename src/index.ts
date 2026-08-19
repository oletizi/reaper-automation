import { cmdBuild } from '@/cli/build'
import { cmdInstall } from '@/cli/install'
import { cmdFindAction } from '@/cli/find-action'
import { cmdReport } from '@/cli/report'
import { cmdRefresh } from '@/cli/refresh'
import { cmdDoctor } from '@/cli/doctor'
import { cmdDocs } from '@/cli/docs'

export function runCli(argv: string[]): Promise<number> {
  const [verb, ...rest] = argv
  try {
    switch (verb) {
      case 'build': return Promise.resolve(cmdBuild(rest))
      case 'install': return Promise.resolve(cmdInstall(rest))
      case 'refresh': return Promise.resolve(cmdRefresh(rest))
      case 'doctor': return Promise.resolve(cmdDoctor(rest))
      case 'docs': return Promise.resolve(cmdDocs(rest))
      case 'find-action': return Promise.resolve(cmdFindAction(rest))
      case 'report': return Promise.resolve(cmdReport(rest))
      default:
        console.error('usage: ra <build|install|refresh|doctor|docs|find-action|report> ...')
        return Promise.resolve(2)
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return Promise.resolve(1)
  }
}

// Executed directly (via tsx src/index.ts ...)
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  runCli(process.argv.slice(2)).then((code) => process.exit(code))
}
