import type { KeyCombo } from '@/keys'

export type Target = 'macos' | 'linux'

export function parseTarget(s: string): Target {
  if (s === 'macos' || s === 'linux') return s
  throw new Error(`unsupported --target ${JSON.stringify(s)} (expected "macos" or "linux")`)
}

export function superWarning(combo: KeyCombo, target: Target, label: string): string | null {
  if (target !== 'linux') return null
  if (!combo.control) return null
  return `warning: ${label} uses mac Control -> Linux Super; GNOME may intercept it`
}

/**
 * The build target implied by the machine we're running on. Non-darwin maps to
 * 'linux' rather than throwing: only macos/linux are real targets, and the
 * resource-dir resolver is where an unsupported platform gets rejected.
 */
export function hostTarget(platform: NodeJS.Platform = process.platform): Target {
  return platform === 'darwin' ? 'macos' : 'linux'
}
