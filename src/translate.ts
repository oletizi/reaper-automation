import { FLAG_CONTROL } from '@/keyspec'

export type Target = 'macos' | 'linux'

export function parseTarget(s: string): Target {
  if (s === 'macos' || s === 'linux') return s
  throw new Error(`unsupported --target ${JSON.stringify(s)} (expected "macos" or "linux")`)
}

export function superWarning(flags: number, target: Target, label: string): string | null {
  if (target !== 'linux') return null
  if ((flags & FLAG_CONTROL) === 0) return null
  return `warning: ${label} uses mac Control -> Linux Super; GNOME may intercept it`
}
