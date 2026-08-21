import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'
import { repoRoot } from '@/core/repo'

// Principle 7 is enforced here rather than in review. The rule: dependencies run
// from an adapter inward to the core, never outward and never sideways between
// adapters. A violation fails the build.
//
// This test is the mechanism the Constitution refers to; if it is deleted or
// weakened, the layer boundary stops existing, because nothing else checks it.

const SRC = join(repoRoot(), 'src')

type Layer =
  | { kind: 'core' }
  | { kind: 'adapter'; name: string }
  | { kind: 'cli' }
  | { kind: 'entry' }

function layerOf(rel: string): Layer {
  if (rel.startsWith('core/')) return { kind: 'core' }
  if (rel.startsWith('cli/')) return { kind: 'cli' }
  const m = /^adapters\/([^/]+)\//.exec(rel)
  if (m) return { kind: 'adapter', name: m[1] }
  return { kind: 'entry' }
}

function sourceFiles(dir = SRC): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p))
    else if (name.endsWith('.ts')) out.push(p)
  }
  return out.sort()
}

/** Import specifiers, resolved to a src-relative module path (or null if external). */
function importsOf(file: string, text: string): string[] {
  const specs: string[] = []
  for (const re of [/\bfrom\s+'([^']+)'/g, /\bimport\s*\(\s*'([^']+)'\s*\)/g, /\bimport\s+'([^']+)'/g]) {
    for (const m of text.matchAll(re)) specs.push(m[1])
  }
  const resolved: string[] = []
  for (const s of specs) {
    if (s.startsWith('@/')) resolved.push(s.slice(2))
    else if (s.startsWith('.')) resolved.push(relative(SRC, resolve(dirname(file), s)))
  }
  return resolved
}

function describeLayer(l: Layer): string {
  return l.kind === 'adapter' ? `adapters/${l.name}` : l.kind
}

describe('layer boundaries (CONSTITUTION.md, Principle 7)', () => {
  const files = sourceFiles()

  it('finds a source tree to check', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('core imports nothing outside core', () => {
    const violations: string[] = []
    for (const f of files) {
      const rel = relative(SRC, f)
      if (layerOf(rel).kind !== 'core') continue
      for (const dep of importsOf(f, readFileSync(f, 'utf8'))) {
        if (layerOf(dep).kind !== 'core') violations.push(`${rel} -> ${dep}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('an adapter imports only core and its own adapter -- never a sibling adapter, never the cli', () => {
    const violations: string[] = []
    for (const f of files) {
      const rel = relative(SRC, f)
      const from = layerOf(rel)
      if (from.kind !== 'adapter') continue
      for (const dep of importsOf(f, readFileSync(f, 'utf8'))) {
        const to = layerOf(dep)
        const ok = to.kind === 'core' || (to.kind === 'adapter' && to.name === from.name)
        if (!ok) violations.push(`adapters/${from.name}: ${rel} -> ${dep} (${describeLayer(to)})`)
      }
    }
    expect(violations).toEqual([])
  })

  it('core names no host vocabulary', () => {
    // Belt and braces alongside the import rule: a host's identifiers must not
    // appear in core even where no import carries them. Comments are stripped
    // first, since core is allowed to *explain* where host code lives.
    const FORBIDDEN = [
      /\breaper\./i, /Main_OnCommand/, /ReaperKeyMap/, /reaper-kb/i, /reaper\.ini/i,
      /RTrackTemplate/i, /TrackFX_/, /P_RAZOREDITS/, /\.lua\b/, /\bardour\b/i,
    ]
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    const violations: string[] = []
    for (const f of files) {
      const rel = relative(SRC, f)
      if (layerOf(rel).kind !== 'core') continue
      const code = strip(readFileSync(f, 'utf8'))
      for (const re of FORBIDDEN) {
        if (re.test(code)) violations.push(`${rel} matches ${re}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('the rule has teeth: a synthetic sideways import would be caught', () => {
    // Guards against the checks above silently passing because the resolver
    // stopped recognising import syntax.
    const fake = join(SRC, 'adapters/reaper/fake.ts')
    const deps = importsOf(fake, "import { x } from '@/adapters/desktop/gnome'\n")
    expect(deps).toEqual(['adapters/desktop/gnome'])
    expect(layerOf(deps[0])).toEqual({ kind: 'adapter', name: 'desktop' })
  })
})
