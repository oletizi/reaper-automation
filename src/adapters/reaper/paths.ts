import { homedir } from 'node:os'
import { join } from 'node:path'

export function resolveResourceDir(opts: {
  platform?: NodeJS.Platform
  home?: string
  override?: string
  env?: NodeJS.ProcessEnv
} = {}): string {
  const platform = opts.platform ?? process.platform
  const home = opts.home ?? homedir()
  const env = opts.env ?? process.env
  const override = opts.override ?? env.REAPER_RESOURCE_DIR
  if (override) return override
  if (platform === 'darwin') return join(home, 'Library', 'Application Support', 'REAPER')
  if (platform === 'linux') return join(home, '.config', 'REAPER')
  throw new Error(`unsupported platform ${platform}: no known REAPER resource dir (pass --resource-dir)`)
}
