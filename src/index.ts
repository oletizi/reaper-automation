import { cmdBuild } from '@/cli/build'
import { cmdInstall } from '@/cli/install'
import { cmdFindAction } from '@/cli/find-action'
import { cmdReport } from '@/cli/report'

export function runCli(argv: string[]): Promise<number> {
  const [verb, ...rest] = argv
  try {
    switch (verb) {
      case 'build': return Promise.resolve(cmdBuild(rest))
      case 'install': return Promise.resolve(cmdInstall(rest))
      case 'find-action': return Promise.resolve(cmdFindAction(rest))
      case 'report': return Promise.resolve(cmdReport(rest))
      default:
        console.error('usage: ra <build|install|find-action|report> ...')
        return Promise.resolve(2)
    }
  } catch (e) {
    console.error((e as Error).message)
    return Promise.resolve(1)
  }
}

// Executed directly (via tsx src/index.ts ...)
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  runCli(process.argv.slice(2)).then((code) => process.exit(code))
}
