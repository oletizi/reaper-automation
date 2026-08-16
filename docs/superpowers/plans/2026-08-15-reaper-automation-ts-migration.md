# reaper-automation TypeScript Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the reaper-automation keymap generator from Python to TypeScript, make it work on Linux and macOS, and add a ReaTooled-aware conflict report — without changing the keymap bits REAPER sees.

**Architecture:** A canonical TOML mapping (authored in LUNA-native macOS modifier labels) is validated at a typed boundary, then compiled to a `.ReaperKeyMap` file plus generated Lua ReaScripts. `keyspec` parses human key specs into physical REAPER flag *bits*; everything downstream reasons about bits; `translate` is presentation/policy per `--target`. The port is proven behavior-preserving by a semantic-record parity test against the committed Python output and a dedicated custom-action/script id-stability test.

**Tech Stack:** Node 22 (ESM), TypeScript (strict), tsx (runner), pnpm, vitest, `smol-toml` (the one runtime dependency), stdlib `node:util` `parseArgs` (CLI) and `node:crypto` (md5). Lua ReaScripts are generated text, unchanged in behavior.

**Spec:** `docs/superpowers/specs/2026-08-15-reaper-automation-ts-migration-design.md` — read it alongside this plan; the plan argues from it.

## Global Constraints

Copied verbatim from the spec / project rules. Every task implicitly includes these.

- **No `any`, no `as Type`, no `@ts-ignore`.** Untrusted TOML becomes typed only through a runtime validator that throws, never through a cast.
- **No fallbacks or mock data outside tests.** Missing action id, unknown key, unsupported OS → **throw** with a description.
- **`@/` import pattern** for all internal TypeScript imports (`@/keyspec`, not `../keyspec`).
- **Files 300–500 lines max**; prefer smaller, one-responsibility modules.
- **ESM** (`"type": "module"`). Run everything through **tsx** (never ts-node).
- **Windows is out of scope** — resolve it with an explicit thrown error, not a fallback.
- **Modifier vocabulary is Mac-native and unambiguous:** input tokens `Cmd`/`Command` → bit 8, `Opt`/`Option` → bit 16, `Control` → bit 32, `Shift` → bit 4. `Ctrl`, `Super`, `Win`, `Meta`, `Alt` are **not** accepted input tokens.
- **Stable id algorithm is a migration contract:** `md5("reaper-automation/" + label)`, UTF-8 bytes, lowercase hex. Reproduce exactly.
- **REAPER/version target:** REAPER 7.78; section Main = `0` on emitted lines.
- **No AI attribution** in commit messages (no `Co-Authored-By`, no session trailer).
- **Commit after every task; branch is `feat/typescript-migration`.** Python stays runnable until the final task, so `main`/branch builds a correct keymap at every step.

---

## File Structure

Created by this plan:

```
package.json                 # ESM; deps: smol-toml; devDeps: typescript, tsx, vitest, @types/node
tsconfig.json                # strict; baseUrl .; paths @/* -> src/*; moduleResolution Bundler
vitest.config.ts             # resolve.alias @ -> ./src
src/
  keyspec.ts                 # parse()/describe(); Mac-native vocab; flag-bit constants
  translate.ts               # Target type; describeForTarget(); superWarnings()
  actions.ts                 # loadActions(); ActionIndex.find()/byId()
  mapping.ts                 # parseMapping(): TOML bytes -> validated Mapping | throw MappingError
  ids.ts                     # stableId(), slugify() — the id contract, isolated + unit-tested
  extend-template.ts         # renderExtendScript() -> Lua source string
  build-keymap.ts            # buildKeymap(): Mapping + ActionIndex -> {keymapText, scripts, stats}
  reaper-paths.ts            # resolveResourceDir() per host OS; throws on Windows/unknown
  install.ts                 # installArtifacts(): stage keymap + scripts; never activates
  reatooled.ts               # parseKb(); observeAgainstReatooled() (raw observation)
  cli/
    args.ts                  # thin parseArgs wrappers per verb
    build.ts install.ts find-action.ts report.ts
  index.ts                   # verb router (bin entry via tsx)
tests/
  fixtures/                  # golden reference keymap + a small synthetic mapping
  *.test.ts
mappings/luna.toml           # (Task 8) renamed + relabeled from luna-linux.toml
data/reaper-actions-7.78.tsv # (Task 10) renamed from ...-linux.tsv
```

Deleted in the final task: `tools/*.py` (`build_keymap.py`, `install.py`, `find_action.py`, `keyspec.py`). `tools/dump_actions.lua` is kept (runs inside REAPER).

---

## Task 1: Toolchain scaffold + golden fixtures

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` (modify)
- Create: `tests/fixtures/luna-linux.reference.ReaperKeyMap` (copy of the committed Python output)
- Create: `tests/smoke.test.ts`

**Interfaces:**
- Produces: a working `pnpm test` (vitest) with `@/` alias resolution; a committed byte-exact copy of the current Python build output for later parity tests.

- [ ] **Step 1: Copy the current Python build output as the golden reference (before any TS exists)**

```bash
mkdir -p tests/fixtures
cp build/luna-linux.ReaperKeyMap tests/fixtures/luna-linux.reference.ReaperKeyMap
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "reaper-automation",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "ra": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "smol-toml": "^1.3.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Write `vitest.config.ts`** (vitest needs the alias independently of tsconfig)

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: { include: ['tests/**/*.test.ts'] },
})
```

- [ ] **Step 5: Append build artifacts and node_modules to `.gitignore`**

Ensure `.gitignore` contains (add any missing lines):

```
node_modules/
*.tsbuildinfo
```

- [ ] **Step 6: Write the smoke test** — `tests/smoke.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

describe('scaffold', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2)
  })
  it('golden reference fixture is present and non-empty', () => {
    const p = fileURLToPath(new URL('./fixtures/luna-linux.reference.ReaperKeyMap', import.meta.url))
    expect(readFileSync(p, 'utf8').length).toBeGreaterThan(1000)
  })
})
```

- [ ] **Step 7: Install and run**

Run: `pnpm install && pnpm test`
Expected: install succeeds; both smoke tests PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore tests/ pnpm-lock.yaml
git commit -m "Scaffold TypeScript toolchain and capture golden reference keymap"
```

---

## Task 2: keyspec.ts — human key spec ↔ REAPER bits

**Files:**
- Create: `src/keyspec.ts`
- Test: `tests/keyspec.test.ts`

**Interfaces:**
- Produces:
  - `FLAG_VIRTKEY=1, FLAG_SHIFT=4, FLAG_CMD=8, FLAG_OPT=16, FLAG_CONTROL=32` (exported consts)
  - `class KeySpecError extends Error`
  - `parse(spec: string): { flags: number; keycode: number }` — throws `KeySpecError`
  - `describe(flags: number, keycode: number, target: 'macos' | 'linux'): string`

- [ ] **Step 1: Write failing tests** — `tests/keyspec.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { parse, describe as describeKey, KeySpecError } from '@/keyspec'

describe('parse', () => {
  it('plain letter -> virtkey + ASCII code', () => {
    expect(parse('A')).toEqual({ flags: 1, keycode: 65 })
  })
  it('Cmd -> bit 8, Opt -> bit 16, Control -> bit 32, Shift -> bit 4', () => {
    expect(parse('Cmd+A')).toEqual({ flags: 1 | 8, keycode: 65 })
    expect(parse('Opt+A')).toEqual({ flags: 1 | 16, keycode: 65 })
    expect(parse('Control+A')).toEqual({ flags: 1 | 32, keycode: 65 })
    expect(parse('Shift+A')).toEqual({ flags: 1 | 4, keycode: 65 })
  })
  it('extended nav keys carry the +32768 offset (Left = 32805)', () => {
    expect(parse('Left').keycode).toBe(37 + 32768)
    expect(parse('Cmd+Shift+Left')).toEqual({ flags: 1 | 8 | 4, keycode: 32805 })
  })
  it('keeps a literal + intact', () => {
    expect(parse('Cmd++').keycode).toBe(187) // "=" / "+" OEM key
  })
  it('rejects Linux-flavoured tokens Ctrl / Super / Alt', () => {
    for (const s of ['Ctrl+A', 'Super+A', 'Alt+A']) {
      expect(() => parse(s)).toThrow(KeySpecError)
    }
  })
  it('rejects duplicate modifier and unknown key', () => {
    expect(() => parse('Cmd+Cmd+A')).toThrow(KeySpecError)
    expect(() => parse('Cmd+Nope')).toThrow(KeySpecError)
  })
})

describe('describe', () => {
  it('renders Mac labels on macos and Linux labels on linux', () => {
    const p = parse('Cmd+Shift+Left')
    expect(describeKey(p.flags, p.keycode, 'macos')).toBe('Cmd+Shift+Left')
    expect(describeKey(p.flags, p.keycode, 'linux')).toBe('Ctrl+Shift+Left')
  })
  it('round-trips within a target', () => {
    for (const s of ['Space', 'Cmd+Space', 'Control+L', 'Opt+Home', 'Shift+]']) {
      const p = parse(s)
      const back = describeKey(p.flags, p.keycode, 'macos')
      expect(parse(back)).toEqual(p)
    }
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test keyspec`
Expected: FAIL (`@/keyspec` not found).

- [ ] **Step 3: Implement** — `src/keyspec.ts` (faithful port of `tools/keyspec.py`, Mac-native vocab)

```ts
export const FLAG_VIRTKEY = 1
export const FLAG_SHIFT = 4
export const FLAG_CMD = 8
export const FLAG_OPT = 16
export const FLAG_CONTROL = 32

export class KeySpecError extends Error {}

// Input token -> bit. Mac-native only; Ctrl/Super/Win/Meta/Alt are rejected.
const MODIFIERS: Record<string, number> = {
  shift: FLAG_SHIFT,
  cmd: FLAG_CMD,
  command: FLAG_CMD,
  opt: FLAG_OPT,
  option: FLAG_OPT,
  control: FLAG_CONTROL,
}

const EXTENDED_OFFSET = 32768
const EXTENDED: Record<string, number> = {
  pgup: 33, pgdn: 34, end: 35, home: 36, left: 37, up: 38,
  right: 39, down: 40, insert: 45, delete: 46, del: 46,
}

const NAMED: Record<string, number> = {
  backspace: 8, tab: 9, return: 13, enter: 13, esc: 27, escape: 27, space: 32,
  ';': 186, '=': 187, ',': 188, '-': 189, '.': 190, '/': 191,
  '`': 192, '[': 219, '\\': 220, ']': 221, "'": 222,
  nummultiply: 106, numplus: 107, numminus: 109, numdecimal: 110, numdivide: 111,
}
for (let i = 0; i < 10; i++) NAMED[`num${i}`] = 96 + i
for (let i = 1; i <= 24; i++) NAMED[`f${i}`] = 111 + i

function splitSpec(spec: string): string[] {
  // Split on '+' but keep a literal '+' key intact (e.g. "Cmd++").
  const parts: string[] = []
  let buf = ''
  for (let i = 0; i < spec.length; i++) {
    const ch = spec[i]
    if (ch === '+' && buf && i !== spec.length - 1) {
      parts.push(buf)
      buf = ''
    } else {
      buf += ch
    }
  }
  parts.push(buf)
  const filtered = parts.filter((p) => p !== '')
  return filtered.length ? filtered : [spec]
}

function keycodeOf(key: string, spec: string): number {
  const low = key.toLowerCase()
  if (low in EXTENDED) return EXTENDED[low] + EXTENDED_OFFSET
  if (low in NAMED) return NAMED[low]
  if (key.length === 1) {
    const ch = key.toUpperCase()
    if ((ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9')) return ch.charCodeAt(0)
  }
  throw new KeySpecError(`unknown key ${JSON.stringify(key)} in ${JSON.stringify(spec)}`)
}

export function parse(spec: string): { flags: number; keycode: number } {
  if (!spec || !spec.trim()) throw new KeySpecError('empty key spec')
  const parts = splitSpec(spec.trim())
  const key = parts[parts.length - 1]
  const mods = parts.slice(0, -1)

  let flags = FLAG_VIRTKEY
  for (const m of mods) {
    const low = m.toLowerCase()
    const bit = MODIFIERS[low]
    if (bit === undefined) throw new KeySpecError(`unknown modifier ${JSON.stringify(m)} in ${JSON.stringify(spec)}`)
    if (flags & bit) throw new KeySpecError(`duplicate modifier ${JSON.stringify(m)} in ${JSON.stringify(spec)}`)
    flags |= bit
  }
  return { flags, keycode: keycodeOf(key, spec) }
}

export function describe(flags: number, keycode: number, target: 'macos' | 'linux'): string {
  const labels =
    target === 'macos'
      ? { cmd: 'Cmd', opt: 'Opt', control: 'Control' }
      : { cmd: 'Ctrl', opt: 'Alt', control: 'Super' }

  const names: string[] = []
  if (flags & FLAG_CMD) names.push(labels.cmd)
  if (flags & FLAG_OPT) names.push(labels.opt)
  if (flags & FLAG_CONTROL) names.push(labels.control)
  if (flags & FLAG_SHIFT) names.push('Shift')

  let label: string | null = null
  if (keycode > EXTENDED_OFFSET) {
    const raw = keycode - EXTENDED_OFFSET
    for (const [k, v] of Object.entries(EXTENDED)) {
      if (v === raw) { label = k.charAt(0).toUpperCase() + k.slice(1); break }
    }
  }
  if (label === null) {
    for (const [k, v] of Object.entries(NAMED)) {
      if (v === keycode) { label = /^[a-z0-9]+$/i.test(k) ? k.charAt(0).toUpperCase() + k.slice(1) : k; break }
    }
  }
  if (label === null && keycode > 32 && keycode < 127) label = String.fromCharCode(keycode)
  if (label === null) label = `VK${keycode}`

  return [...names, label].join('+')
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test keyspec`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/keyspec.ts tests/keyspec.test.ts
git commit -m "Port keyspec to TypeScript with Mac-native modifier vocabulary"
```

---

## Task 3: translate.ts — target policy + Super-conflict warnings

**Files:**
- Create: `src/translate.ts`
- Test: `tests/translate.test.ts`

**Interfaces:**
- Consumes: `FLAG_CONTROL`, `describe` from `@/keyspec`.
- Produces:
  - `type Target = 'macos' | 'linux'`
  - `parseTarget(s: string): Target` — throws on anything else
  - `superWarning(flags: number, target: Target, label: string): string | null` — returns a warning string when a `linux` binding uses bit 32 (mac Control → Linux Super), else null

- [ ] **Step 1: Write failing tests** — `tests/translate.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { parseTarget, superWarning } from '@/translate'
import { FLAG_VIRTKEY, FLAG_CONTROL, FLAG_CMD } from '@/keyspec'

describe('parseTarget', () => {
  it('accepts macos and linux', () => {
    expect(parseTarget('macos')).toBe('macos')
    expect(parseTarget('linux')).toBe('linux')
  })
  it('throws on anything else (including windows)', () => {
    expect(() => parseTarget('windows')).toThrow()
    expect(() => parseTarget('')).toThrow()
  })
})

describe('superWarning', () => {
  it('warns for a bit-32 binding on linux', () => {
    const w = superWarning(FLAG_VIRTKEY | FLAG_CONTROL, 'linux', 'Loop Playback')
    expect(w).toContain('Super')
    expect(w).toContain('Loop Playback')
  })
  it('is silent for bit-32 on macos and for non-bit-32 on linux', () => {
    expect(superWarning(FLAG_VIRTKEY | FLAG_CONTROL, 'macos', 'x')).toBeNull()
    expect(superWarning(FLAG_VIRTKEY | FLAG_CMD, 'linux', 'x')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test translate`
Expected: FAIL (`@/translate` not found).

- [ ] **Step 3: Implement** — `src/translate.ts`

```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test translate`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/translate.ts tests/translate.test.ts
git commit -m "Add translate module: target parsing and Super-conflict warnings"
```

---

## Task 4: ids.ts — the stable-id contract (isolated + pinned)

**Files:**
- Create: `src/ids.ts`
- Test: `tests/ids.test.ts`

**Interfaces:**
- Produces:
  - `stableId(label: string): string` — `md5("reaper-automation/" + label)`, lowercase hex
  - `slugify(text: string): string`

- [ ] **Step 1: Write failing tests** with the verified anchor values — `tests/ids.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { stableId, slugify } from '@/ids'

describe('stableId (migration contract — must match Python exactly)', () => {
  it('matches the committed custom-action id', () => {
    expect(stableId('Increase all track heights')).toBe('9457b692efcdc0fa6d1a838e640ccc96')
  })
  it('matches the committed script id', () => {
    expect(stableId('LUNA: Extend Selection To Next Bar')).toBe('76372f6ae70342495f98647bb34897d0')
  })
})

describe('slugify', () => {
  it('lowercases, collapses non-alnum to single underscore, trims', () => {
    expect(slugify('Extend Selection To Next Bar')).toBe('extend_selection_to_next_bar')
    expect(slugify('Foo (bar)')).toBe('foo_bar')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test ids`
Expected: FAIL (`@/ids` not found).

- [ ] **Step 3: Implement** — `src/ids.ts`

```ts
import { createHash } from 'node:crypto'

export function stableId(label: string): string {
  return createHash('md5').update('reaper-automation/' + label, 'utf8').digest('hex')
}

export function slugify(text: string): string {
  let out = ''
  for (const c of text) out += /[a-z0-9]/i.test(c) ? c.toLowerCase() : '_'
  while (out.includes('__')) out = out.replaceAll('__', '_')
  return out.replace(/^_+|_+$/g, '')
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test ids`
Expected: PASS (both hashes match the committed keymap).

- [ ] **Step 5: Commit**

```bash
git add src/ids.ts tests/ids.test.ts
git commit -m "Add stable-id contract module pinned to the committed keymap ids"
```

---

## Task 5: actions.ts — load and index the REAPER action list

**Files:**
- Create: `src/actions.ts`
- Test: `tests/actions.test.ts`

**Interfaces:**
- Produces:
  - `interface ActionRow { section: string; sectionId: string; commandId: string; namedId: string; actionName: string }`
  - `loadActions(tsvPath?: string): ActionRow[]` — defaults to `data/reaper-actions-7.78-linux.tsv` (renamed in Task 10; keep a single `DEFAULT_ACTIONS_TSV` constant)
  - `class ActionIndex { constructor(rows: ActionRow[]); byId(id: string): string | undefined; has(id: string): boolean; find(terms: string[], section?: string): ActionRow[] }` — `byId`/`has` scoped to `section === 'main'`

- [ ] **Step 1: Write failing tests** — `tests/actions.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { loadActions, ActionIndex } from '@/actions'

const rows = loadActions()
const idx = new ActionIndex(rows)

describe('actions', () => {
  it('loads thousands of rows with a header skipped', () => {
    expect(rows.length).toBeGreaterThan(5000)
    expect(rows[0].section).not.toBe('section') // header not included
  })
  it('resolves known main-section ids used by the mapping', () => {
    expect(idx.byId('40044')).toContain('Play') // Transport: Play/stop
    expect(idx.has('40044')).toBe(true)
    expect(idx.has('99999999')).toBe(false)
  })
  it('find() is AND across terms, case-insensitive', () => {
    const hits = idx.find(['zoom', 'horizontal'])
    expect(hits.length).toBeGreaterThan(0)
    for (const h of hits) {
      const n = h.actionName.toLowerCase()
      expect(n.includes('zoom') && n.includes('horizontal')).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test actions`
Expected: FAIL (`@/actions` not found).

- [ ] **Step 3: Implement** — `src/actions.ts` (port of `tools/find_action.py` loader; TSV columns: `section, section_id, command_id, named_id, action_name`)

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export interface ActionRow {
  section: string
  sectionId: string
  commandId: string
  namedId: string
  actionName: string
}

export const DEFAULT_ACTIONS_TSV = fileURLToPath(
  new URL('../data/reaper-actions-7.78-linux.tsv', import.meta.url),
)

export function loadActions(tsvPath: string = DEFAULT_ACTIONS_TSV): ActionRow[] {
  const text = readFileSync(tsvPath, 'utf8')
  const out: ActionRow[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const f = line.split('\t')
    if (f.length < 5) continue
    if (i === 0 && f[0] === 'section') continue // header
    out.push({ section: f[0], sectionId: f[1], commandId: f[2], namedId: f[3], actionName: f[4] })
  }
  return out
}

export class ActionIndex {
  private mainById = new Map<string, string>()
  constructor(private rows: ActionRow[]) {
    for (const r of rows) if (r.section === 'main') this.mainById.set(r.commandId, r.actionName)
  }
  byId(id: string): string | undefined {
    return this.mainById.get(id)
  }
  has(id: string): boolean {
    return this.mainById.has(id)
  }
  find(terms: string[], section?: string): ActionRow[] {
    const needles = terms.map((t) => t.toLowerCase())
    return this.rows.filter((r) => {
      if (section && r.section !== section) return false
      const hay = r.actionName.toLowerCase()
      return needles.every((n) => hay.includes(n))
    })
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test actions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/actions.ts tests/actions.test.ts
git commit -m "Port action-list loader and index to TypeScript"
```

---

## Task 6: mapping.ts — the typed TOML boundary

**Files:**
- Create: `src/mapping.ts`
- Test: `tests/mapping.test.ts`
- Test fixture: `tests/fixtures/mini.toml`

**Interfaces:**
- Consumes: `smol-toml` `parse`.
- Produces:
  - `type BindingStatus = 'ok' | 'unmapped' | 'disable'`
  - `interface Binding { luna: string; key?: string; label?: string; status: BindingStatus; kind?: { action: number } | { macro: number[] } | { extend: number } }`
  - `interface Meta { name: string; target?: string; reaperVersion?: string; notes: string[] }`
  - `interface Mapping { meta: Meta; bindings: Binding[] }`
  - `class MappingError extends Error`
  - `parseMapping(tomlText: string): Mapping` — validates; throws `MappingError` naming the offending binding. Rules: `unmapped` needs no key/kind; `disable` needs a key, no kind; otherwise exactly one of `action`/`macro`/`extend` and a `key`.

- [ ] **Step 1: Write the mini fixture** — `tests/fixtures/mini.toml`

```toml
[meta]
name = "mini"
target = "macos"

[[binding]]
luna = "Play"
key = "Space"
action = 40044

[[binding]]
luna = "Track heights"
key = "Cmd+="
label = "Increase all track heights"
macro = [40296, 41325]

[[binding]]
luna = "Extend To Next Bar"
key = "Shift+]"
extend = 41042

[[binding]]
luna = "Parked"
status = "unmapped"
```

- [ ] **Step 2: Write failing tests** — `tests/mapping.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseMapping, MappingError } from '@/mapping'

const mini = readFileSync(fileURLToPath(new URL('./fixtures/mini.toml', import.meta.url)), 'utf8')

describe('parseMapping', () => {
  it('parses the four binding shapes and defaults status to ok', () => {
    const m = parseMapping(mini)
    expect(m.meta.name).toBe('mini')
    expect(m.bindings).toHaveLength(4)
    expect(m.bindings[0]).toMatchObject({ luna: 'Play', key: 'Space', status: 'ok', kind: { action: 40044 } })
    expect(m.bindings[1].kind).toEqual({ macro: [40296, 41325] })
    expect(m.bindings[1].label).toBe('Increase all track heights')
    expect(m.bindings[2].kind).toEqual({ extend: 41042 })
    expect(m.bindings[3].status).toBe('unmapped')
  })
  it('throws MappingError when a normal binding has two kind keys', () => {
    const bad = '[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\naction=1\nmacro=[2]\n'
    expect(() => parseMapping(bad)).toThrow(MappingError)
  })
  it('throws MappingError when a normal binding has no kind key and no disable/unmapped status', () => {
    const bad = '[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\n'
    expect(() => parseMapping(bad)).toThrow(MappingError)
  })
  it('throws MappingError when a non-unmapped binding has no key', () => {
    const bad = '[meta]\nname="x"\n[[binding]]\nluna="B"\naction=1\n'
    expect(() => parseMapping(bad)).toThrow(MappingError)
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm test mapping`
Expected: FAIL (`@/mapping` not found).

- [ ] **Step 4: Implement** — `src/mapping.ts` (`parse` returns `unknown`; validate, never cast)

```ts
import { parse as parseToml } from 'smol-toml'

export type BindingStatus = 'ok' | 'unmapped' | 'disable'
export type BindingKind = { action: number } | { macro: number[] } | { extend: number }

export interface Binding {
  luna: string
  key?: string
  label?: string
  status: BindingStatus
  kind?: BindingKind
}
export interface Meta {
  name: string
  target?: string
  reaperVersion?: string
  notes: string[]
}
export interface Mapping {
  meta: Meta
  bindings: Binding[]
}

export class MappingError extends Error {}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function asInt(v: unknown, where: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) throw new MappingError(`${where}: expected integer, got ${JSON.stringify(v)}`)
  return v
}

function validateBinding(raw: unknown, i: number): Binding {
  if (!isRecord(raw)) throw new MappingError(`binding[${i}]: not a table`)
  const luna = typeof raw.luna === 'string' ? raw.luna : `<binding ${i}>`
  const where = `binding[${i}] (${luna})`

  const statusRaw = raw.status
  if (statusRaw !== undefined && statusRaw !== 'ok' && statusRaw !== 'unmapped' && statusRaw !== 'disable') {
    throw new MappingError(`${where}: unknown status ${JSON.stringify(statusRaw)}`)
  }
  const status: BindingStatus = (statusRaw as BindingStatus) ?? 'ok'

  const label = typeof raw.label === 'string' ? raw.label : undefined
  const key = typeof raw.key === 'string' ? raw.key : undefined

  if (status === 'unmapped') return { luna, key, label, status }

  if (key === undefined) throw new MappingError(`${where}: missing key`)

  if (status === 'disable') {
    if ('action' in raw || 'macro' in raw || 'extend' in raw) {
      throw new MappingError(`${where}: disable must not carry a kind key`)
    }
    return { luna, key, label, status }
  }

  const kinds: BindingKind[] = []
  if ('action' in raw) kinds.push({ action: asInt(raw.action, `${where}.action`) })
  if ('extend' in raw) kinds.push({ extend: asInt(raw.extend, `${where}.extend`) })
  if ('macro' in raw) {
    if (!Array.isArray(raw.macro)) throw new MappingError(`${where}.macro: expected array`)
    kinds.push({ macro: raw.macro.map((s, j) => asInt(s, `${where}.macro[${j}]`)) })
  }
  if (kinds.length !== 1) {
    throw new MappingError(`${where}: expected exactly one of action/macro/extend, got ${kinds.length}`)
  }
  return { luna, key, label, status, kind: kinds[0] }
}

export function parseMapping(tomlText: string): Mapping {
  const doc: unknown = parseToml(tomlText)
  if (!isRecord(doc)) throw new MappingError('top-level TOML is not a table')

  const metaRaw = isRecord(doc.meta) ? doc.meta : {}
  const meta: Meta = {
    name: typeof metaRaw.name === 'string' ? metaRaw.name : 'REAPER keymap',
    target: typeof metaRaw.target === 'string' ? metaRaw.target : undefined,
    reaperVersion: typeof metaRaw.reaper_version === 'string' ? metaRaw.reaper_version : undefined,
    notes: Array.isArray(metaRaw.notes) ? metaRaw.notes.filter((n): n is string => typeof n === 'string') : [],
  }

  const rawBindings = doc.binding
  if (rawBindings !== undefined && !Array.isArray(rawBindings)) throw new MappingError('[[binding]] is not an array')
  const bindings = (Array.isArray(rawBindings) ? rawBindings : []).map((b, i) => validateBinding(b, i))

  return { meta, bindings }
}
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm test mapping`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/mapping.ts tests/mapping.test.ts tests/fixtures/mini.toml
git commit -m "Add typed TOML mapping boundary with runtime validation"
```

---

## Task 7: extend-template.ts + build-keymap.ts — the core compiler

**Files:**
- Create: `src/extend-template.ts`, `src/build-keymap.ts`
- Test: `tests/build-keymap.test.ts`

**Interfaces:**
- Consumes: `parse`, `describe` (`@/keyspec`); `Target`, `superWarning` (`@/translate`); `stableId`, `slugify` (`@/ids`); `ActionIndex` (`@/actions`); `Mapping` (`@/mapping`).
- Produces:
  - `renderExtendScript(opts: { label: string; spec: string; move: number; moveName: string }): string` (`@/extend-template`)
  - `interface BuildResult { keymapText: string; scripts: Map<string, string>; warnings: string[]; stats: { direct: number; macro: number; script: number; disabled: number; unmapped: number } }`
  - `buildKeymap(mapping: Mapping, actions: ActionIndex, target: Target): BuildResult` — throws `Error` listing all validation errors (strict) if any binding references an unknown id or two bindings collide on the same combo. `SECTION_MAIN = 0`, `SCRIPT_DIR = 'luna'`.

- [ ] **Step 1: Implement the Lua template first** — `src/extend-template.ts` (verbatim behavior of `EXTEND_TEMPLATE` in `tools/build_keymap.py`)

```ts
export function renderExtendScript(opts: { label: string; spec: string; move: number; moveName: string }): string {
  const { label, spec, move, moveName } = opts
  return `-- ${label}
-- Generated by reaper-automation from ${spec}. Do not hand-edit.
--
-- Extends the time selection to wherever action ${move} (${moveName})
-- lands the edit cursor, keeping the far edge anchored so repeated presses keep
-- extending. This is LUNA / Pro Tools "hold Shift while moving the transport".
--
-- A plain custom action cannot do this: it would re-anchor on every press, so
-- the second press would replace the selection instead of growing it.

local MOVE = ${move}

local function extend()
  local sel_start, sel_end = reaper.GetSet_LoopTimeRange(false, false, 0, 0, false)
  local cursor = reaper.GetCursorPosition()

  -- Anchor the edge we are moving away from. With no selection yet, anchor here.
  local anchor
  if sel_start == sel_end then
    anchor = cursor
  elseif math.abs(cursor - sel_end) < math.abs(cursor - sel_start) then
    anchor = sel_start
  else
    anchor = sel_end
  end

  reaper.Main_OnCommand(MOVE, 0)
  local dest = reaper.GetCursorPosition()

  if dest == anchor then
    reaper.GetSet_LoopTimeRange(true, false, 0, 0, false)
  else
    reaper.GetSet_LoopTimeRange(true, false, math.min(anchor, dest), math.max(anchor, dest), false)
  end
end

reaper.PreventUIRefresh(1)
extend()
reaper.PreventUIRefresh(-1)
reaper.UpdateArrange()
`
}
```

- [ ] **Step 2: Write failing tests against the `mini.toml` fixture** — `tests/build-keymap.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseMapping } from '@/mapping'
import { loadActions, ActionIndex } from '@/actions'
import { buildKeymap } from '@/build-keymap'

const idx = new ActionIndex(loadActions())
const mini = parseMapping(readFileSync(fileURLToPath(new URL('./fixtures/mini.toml', import.meta.url)), 'utf8'))

describe('buildKeymap (mini fixture, target macos)', () => {
  const r = buildKeymap(mini, idx, 'macos')

  it('emits a direct KEY line for Play', () => {
    expect(r.keymapText).toMatch(/^KEY 1 32 40044 0/m)
  })
  it('emits an ACT with the contract id and a KEY referencing it', () => {
    expect(r.keymapText).toMatch(/^ACT 0 0 "9457b692efcdc0fa6d1a838e640ccc96" "Custom: Increase all track heights" 40296 41325$/m)
    expect(r.keymapText).toMatch(/_9457b692efcdc0fa6d1a838e640ccc96 0/)
  })
  it('emits an SCR with the contract id and writes the Lua file', () => {
    expect(r.keymapText).toMatch(/^SCR 4 0 "76372f6ae70342495f98647bb34897d0" "Custom: LUNA: Extend Selection To Next Bar" luna\/luna_extend_selection_to_next_bar\.lua$/m)
    expect(r.scripts.has('luna_extend_selection_to_next_bar.lua')).toBe(true)
  })
  it('counts unmapped separately and omits it from output', () => {
    expect(r.stats.unmapped).toBe(1)
  })
})

describe('buildKeymap strict validation', () => {
  it('throws when an action id does not exist', () => {
    const m = parseMapping('[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\naction=99999999\n')
    expect(() => buildKeymap(m, idx, 'macos')).toThrow(/unknown/)
  })
  it('throws when two bindings collide on the same combo', () => {
    const m = parseMapping('[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\naction=40044\n[[binding]]\nluna="C"\nkey="A"\naction=1013\n')
    expect(() => buildKeymap(m, idx, 'macos')).toThrow(/already bound/)
  })
})
```

Note: the `extend` in `mini.toml` uses move action `41042`; the generated **label** is `LUNA: Extend Selection To Next Bar`, so its script filename and id come from that label. The mini fixture's `luna` is `Extend To Next Bar` but no `label` override, so `base = luna.split(' (')[0]`; to make the id match the anchor value, set the fixture binding's `label = "Extend Selection To Next Bar"`. **Add that label to `tests/fixtures/mini.toml` binding 3 now** so the SCR id equals `76372f6a…`.

- [ ] **Step 3: Update `tests/fixtures/mini.toml`** — give the extend binding the matching label

```toml
[[binding]]
luna = "Extend To Next Bar"
key = "Shift+]"
label = "Extend Selection To Next Bar"
extend = 41042
```

- [ ] **Step 4: Run to verify failure**

Run: `pnpm test build-keymap`
Expected: FAIL (`@/build-keymap` not found).

- [ ] **Step 5: Implement** — `src/build-keymap.ts` (faithful port of `tools/build_keymap.py`'s `build()`; comment label comes from `describe(..., target)`)

```ts
import { parse as parseKey, describe as describeKey } from '@/keyspec'
import { superWarning, type Target } from '@/translate'
import { stableId, slugify } from '@/ids'
import type { ActionIndex } from '@/actions'
import type { Binding, Mapping } from '@/mapping'
import { renderExtendScript } from '@/extend-template'

const SECTION_MAIN = 0
const SCRIPT_DIR = 'luna'

export interface BuildResult {
  keymapText: string
  scripts: Map<string, string>
  warnings: string[]
  stats: { direct: number; macro: number; script: number; disabled: number; unmapped: number }
}

export function buildKeymap(mapping: Mapping, actions: ActionIndex, target: Target): BuildResult {
  const actLines: string[] = []
  const scrLines: string[] = []
  const keyLines: string[] = []
  const errors: string[] = []
  const warnings: string[] = []
  const stats = { direct: 0, macro: 0, script: 0, disabled: 0, unmapped: 0 }

  const seenKeys = new Map<string, string>()
  const seenMacros = new Map<string, string>()
  const seenScripts = new Map<number, { fname: string; sid: string }>()
  const scripts = new Map<string, string>()

  for (const b of mapping.bindings) {
    const luna = b.luna
    if (b.status === 'unmapped') { stats.unmapped++; continue }

    let flags: number
    let code: number
    try {
      const p = parseKey(b.key as string)
      flags = p.flags; code = p.keycode
    } catch (e) {
      errors.push(`${luna}: ${(e as Error).message}`)
      continue
    }

    const combo = describeKey(flags, code, target)
    const comboKey = `${flags},${code}`
    if (seenKeys.has(comboKey)) {
      errors.push(`${luna}: key ${combo} already bound to ${JSON.stringify(seenKeys.get(comboKey))}`)
      continue
    }
    seenKeys.set(comboKey, luna)

    const w = superWarning(flags, target, luna)
    if (w) warnings.push(w)

    let command: string
    let desc: string

    if (b.kind && 'extend' in b.kind) {
      const move = b.kind.extend
      const moveName = actions.byId(String(move))
      if (moveName === undefined) { errors.push(`${luna}: extend references unknown action ${move}`); continue }
      let entry = seenScripts.get(move)
      if (!entry) {
        const base = b.label ?? luna.split(' (')[0]
        const label = `LUNA: ${base}`
        const fname = `luna_${slugify(base)}.lua`
        const sid = stableId(label)
        scripts.set(fname, renderExtendScript({ label, spec: mapping.meta.name, move, moveName }))
        scrLines.push(`SCR 4 ${SECTION_MAIN} "${sid}" "Custom: ${label}" ${SCRIPT_DIR}/${fname}`)
        entry = { fname, sid }
        seenScripts.set(move, entry)
      }
      command = '_' + entry.sid
      desc = `script ${entry.fname}  [extend selection via ${moveName}]`
      stats.script++
    } else if (b.kind && 'macro' in b.kind) {
      const steps = b.kind.macro.map(String)
      const missing = steps.filter((s) => !actions.has(s))
      if (missing.length) { errors.push(`${luna}: macro references unknown action(s) ${JSON.stringify(missing)}`); continue }
      const label = b.label ?? `LUNA: ${luna}`
      let mid = seenMacros.get(label)
      if (mid === undefined) {
        mid = stableId(label)
        seenMacros.set(label, mid)
        actLines.push(`ACT 0 ${SECTION_MAIN} "${mid}" "Custom: ${label}" ${steps.join(' ')}`)
      }
      command = '_' + mid
      desc = `${label}  [${steps.map((s) => actions.byId(s)).join(' > ')}]`
      stats.macro++
    } else if (b.kind && 'action' in b.kind) {
      const cid = String(b.kind.action)
      const name = actions.byId(cid)
      if (name === undefined) { errors.push(`${luna}: unknown command id ${cid}`); continue }
      command = cid
      desc = name
      stats.direct++
    } else if (b.status === 'disable') {
      command = '0'
      desc = 'DISABLE REAPER DEFAULT'
      stats.disabled++
    } else {
      errors.push(`${luna}: needs one of action / macro / status`)
      continue
    }

    keyLines.push(`KEY ${flags} ${code} ${command} ${SECTION_MAIN}\t# ${combo} : ${luna} -> ${desc}`)
  }

  if (errors.length) {
    throw new Error(`${errors.length} error(s):\n` + errors.map((e) => `  ERROR  ${e}`).join('\n'))
  }

  const m = mapping.meta
  const header = [
    `# ${m.name}`,
    `# generated by reaper-automation from ${m.name} -- do not hand-edit`,
    `# target: ${target}   REAPER: ${m.reaperVersion ?? '?'}`,
    '#',
    '# Import via: Actions > Show action list > Key map > Import...',
    ...m.notes.map((line) => `# ${line}`),
  ]
  const preamble = [...scrLines, ...actLines]
  const body = [...header, '', ...preamble, ...(preamble.length ? [''] : []), ...keyLines]
  const keymapText = body.join('\n') + '\n'

  return { keymapText, scripts, warnings, stats }
}
```

Note the one intentional header difference from Python: the Python header printed the *spec filename* (`luna-linux.toml`); here it prints `meta.name`. The parity test compares **semantic records only**, so headers/comments are excluded — this does not affect parity. The byte-for-byte guard (Task 8) captures the TS output itself, so it is self-consistent.

- [ ] **Step 6: Run to verify pass**

Run: `pnpm test build-keymap`
Expected: PASS (all cases, including the two contract ids).

- [ ] **Step 7: Commit**

```bash
git add src/extend-template.ts src/build-keymap.ts tests/build-keymap.test.ts tests/fixtures/mini.toml
git commit -m "Port the keymap compiler and extend-script template to TypeScript"
```

---

## Task 8: Re-author luna.toml + full golden parity (bit + id + drift)

**Files:**
- Create: `mappings/luna.toml` (relabeled from `mappings/luna-linux.toml`)
- Create: `tests/parity.test.ts`
- Create: `tests/fixtures/luna-macos.tsbuild.ReaperKeyMap` (captured from the TS build, drift guard)

**Interfaces:**
- Consumes: `parseMapping`, `loadActions`/`ActionIndex`, `buildKeymap`; the reference fixture from Task 1.
- Produces: the canonical mapping and a passing three-part golden test. Defines the parse helper `toRecords(text)` used by the parity test.

- [ ] **Step 1: Create `mappings/luna.toml` from `luna-linux.toml`, relabeling modifiers**

Copy `mappings/luna-linux.toml` to `mappings/luna.toml`, then rewrite the `key = "..."` values from Linux-flavoured to Mac-native tokens **without changing which physical bits they represent**:

- `Ctrl+X`  → `Cmd+X`     (bit 8)
- `Alt+X`   → `Opt+X`     (bit 16)
- `Super+X` → `Control+X` (bit 32)
- `Shift` unchanged.

Update `[meta]`: `target` is now irrelevant (drop it or leave as documentation), and update the header comment block to describe Mac-native authoring. Keep every `action` / `macro` / `extend` / `status` / `label` value exactly as-is. Keep all six `status = "unmapped"` bindings.

Verification that the relabel preserved bits is the parity test below — do not hand-check bit math.

- [ ] **Step 2: Write the three-part golden test** — `tests/parity.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseMapping } from '@/mapping'
import { loadActions, ActionIndex } from '@/actions'
import { buildKeymap } from '@/build-keymap'

const ref = readFileSync(fileURLToPath(new URL('./fixtures/luna-linux.reference.ReaperKeyMap', import.meta.url)), 'utf8')
const luna = parseMapping(readFileSync(fileURLToPath(new URL('../mappings/luna.toml', import.meta.url)), 'utf8'))
const built = buildKeymap(luna, new ActionIndex(loadActions()), 'macos')

interface Rec { key: string[]; act: string[]; scr: string[] }
function toRecords(text: string): Rec {
  const key: string[] = [], act: string[] = [], scr: string[] = []
  for (const raw of text.split('\n')) {
    const line = raw.split('\t')[0].trimEnd() // drop inline comments
    if (line.startsWith('KEY ')) {
      const [, flags, code, cmd, sec] = line.split(/\s+/)
      key.push([flags, code, cmd, sec].join(' '))
    } else if (line.startsWith('ACT ')) {
      const m = line.match(/^ACT \d+ \d+ "([^"]+)"(?: "[^"]*")? (.*)$/)
      if (m) act.push(`${m[1]} ${m[2]}`)
    } else if (line.startsWith('SCR ')) {
      const m = line.match(/^SCR \d+ \d+ "([^"]+)"(?: "[^"]*")? (\S+)$/)
      if (m) scr.push(`${m[1]} ${m[2]}`)
    }
  }
  return { key: key.sort(), act: act.sort(), scr: scr.sort() }
}

describe('golden parity', () => {
  const a = toRecords(ref)
  const b = toRecords(built.keymapText)

  it('KEY semantic records match the Python reference (bit parity across relabel)', () => {
    expect(b.key).toEqual(a.key)
  })
  it('ACT ids + steps match the Python reference', () => {
    expect(b.act).toEqual(a.act)
  })
  it('SCR ids + paths match the Python reference (id-stability)', () => {
    expect(b.scr).toEqual(a.scr)
  })
})

describe('byte-for-byte drift guard (TS vs TS)', () => {
  const fx = fileURLToPath(new URL('./fixtures/luna-macos.tsbuild.ReaperKeyMap', import.meta.url))
  it('reproduces the captured TS macos build exactly', () => {
    if (!existsSync(fx)) {
      writeFileSync(fx, built.keymapText) // first run captures; commit it, then this asserts
    }
    expect(built.keymapText).toBe(readFileSync(fx, 'utf8'))
  })
})
```

- [ ] **Step 3: Run — first pass captures the drift fixture, parity must already hold**

Run: `pnpm test parity`
Expected: the three `golden parity` tests PASS immediately (bit + id parity). The drift-guard test captures the fixture on first run and PASSES. If any `golden parity` test FAILS, the relabel in Step 1 changed a bit — fix the offending `key` in `mappings/luna.toml` (the failure diff names the record).

- [ ] **Step 4: Re-run to confirm the drift guard now asserts against the committed fixture**

Run: `pnpm test parity`
Expected: all four PASS.

- [ ] **Step 5: Commit**

```bash
git add mappings/luna.toml tests/parity.test.ts tests/fixtures/luna-macos.tsbuild.ReaperKeyMap
git commit -m "Add canonical luna.toml and golden parity (bit, id, byte-drift) tests"
```

---

## Task 9: reaper-paths.ts + install.ts — cross-platform staging

**Files:**
- Create: `src/reaper-paths.ts`, `src/install.ts`
- Test: `tests/reaper-paths.test.ts`, `tests/install.test.ts`

**Interfaces:**
- Produces:
  - `resolveResourceDir(opts?: { platform?: NodeJS.Platform; home?: string; override?: string; env?: NodeJS.ProcessEnv }): string` — macOS `~/Library/Application Support/REAPER`, Linux `~/.config/REAPER`; `override` or `$REAPER_RESOURCE_DIR` win; throws on `win32`/unknown.
  - `installArtifacts(opts: { keymapPath: string; scriptsDir?: string; resourceDir: string; keymapName?: string; scriptSubdir?: string }): { keymap: string; scripts: string[] }` — copies scripts first, then the keymap; **never** writes `reaper-kb.ini`; returns destinations.

- [ ] **Step 1: Write failing tests** — `tests/reaper-paths.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { resolveResourceDir } from '@/reaper-paths'

describe('resolveResourceDir', () => {
  it('macOS path', () => {
    expect(resolveResourceDir({ platform: 'darwin', home: '/Users/x' }))
      .toBe('/Users/x/Library/Application Support/REAPER')
  })
  it('Linux path', () => {
    expect(resolveResourceDir({ platform: 'linux', home: '/home/x' })).toBe('/home/x/.config/REAPER')
  })
  it('override and env win over the default', () => {
    expect(resolveResourceDir({ platform: 'linux', home: '/home/x', override: '/tmp/r' })).toBe('/tmp/r')
    expect(resolveResourceDir({ platform: 'linux', home: '/home/x', env: { REAPER_RESOURCE_DIR: '/tmp/e' } })).toBe('/tmp/e')
  })
  it('throws on Windows and unknown platforms', () => {
    expect(() => resolveResourceDir({ platform: 'win32', home: 'C:\\' })).toThrow(/unsupported platform/)
  })
})
```

- [ ] **Step 2: Write failing install test** — `tests/install.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { installArtifacts } from '@/install'

let work: string
beforeEach(() => { work = mkdtempSync(join(tmpdir(), 'ra-install-')) })

describe('installArtifacts', () => {
  it('stages the keymap and scripts and never writes reaper-kb.ini', () => {
    const src = join(work, 'build')
    mkdirSync(join(src, 'Scripts', 'luna'), { recursive: true })
    writeFileSync(join(src, 'luna.ReaperKeyMap'), 'KEY 1 32 40044 0\n')
    writeFileSync(join(src, 'Scripts', 'luna', 'a.lua'), '-- a')
    const res = join(work, 'REAPER')
    mkdirSync(res)

    const out = installArtifacts({
      keymapPath: join(src, 'luna.ReaperKeyMap'),
      scriptsDir: join(src, 'Scripts', 'luna'),
      resourceDir: res,
      keymapName: 'LUNA (Pro Tools).ReaperKeyMap',
    })

    expect(existsSync(join(res, 'KeyMaps', 'LUNA (Pro Tools).ReaperKeyMap'))).toBe(true)
    expect(existsSync(join(res, 'Scripts', 'luna', 'a.lua'))).toBe(true)
    expect(existsSync(join(res, 'reaper-kb.ini'))).toBe(false)
    expect(out.scripts).toHaveLength(1)
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm test reaper-paths install`
Expected: FAIL (modules not found).

- [ ] **Step 4: Implement** — `src/reaper-paths.ts`

```ts
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
```

- [ ] **Step 5: Implement** — `src/install.ts` (port of `tools/install.py`; scripts first, then keymap; never touches `reaper-kb.ini`)

```ts
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'

export function installArtifacts(opts: {
  keymapPath: string
  scriptsDir?: string
  resourceDir: string
  keymapName?: string
  scriptSubdir?: string
}): { keymap: string; scripts: string[] } {
  const keymapName = opts.keymapName ?? 'LUNA (Pro Tools).ReaperKeyMap'
  const scriptSubdir = opts.scriptSubdir ?? 'luna'

  if (!statSync(opts.resourceDir).isDirectory()) {
    throw new Error(`${opts.resourceDir} is not a REAPER resource directory`)
  }

  const copiedScripts: string[] = []
  if (opts.scriptsDir) {
    const dst = join(opts.resourceDir, 'Scripts', scriptSubdir)
    mkdirSync(dst, { recursive: true })
    for (const name of readdirSync(opts.scriptsDir).sort()) {
      if (!name.endsWith('.lua')) continue
      const to = join(dst, name)
      copyFileSync(join(opts.scriptsDir, name), to)
      copiedScripts.push(to)
    }
  }

  const keymaps = join(opts.resourceDir, 'KeyMaps')
  mkdirSync(keymaps, { recursive: true })
  const keymapDst = join(keymaps, keymapName)
  copyFileSync(opts.keymapPath, keymapDst)

  return { keymap: keymapDst, scripts: copiedScripts }
}
```

- [ ] **Step 6: Run to verify pass**

Run: `pnpm test reaper-paths install`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/reaper-paths.ts src/install.ts tests/reaper-paths.test.ts tests/install.test.ts
git commit -m "Add cross-platform resource-dir resolution and artifact staging"
```

---

## Task 10: reatooled.ts + report (raw observation) + action re-dump/rename

**Files:**
- Create: `src/reatooled.ts`
- Test: `tests/reatooled.test.ts`, `tests/fixtures/reatooled-slice.ini`
- Rename: `data/reaper-actions-7.78-linux.tsv` → `data/reaper-actions-7.78.tsv`; update `DEFAULT_ACTIONS_TSV` in `src/actions.ts`

**Interfaces:**
- Produces:
  - `interface KbBinding { flags: number; keycode: number; command: string; section: number }`
  - `parseKb(text: string): KbBinding[]`
  - `observeAgainstReatooled(ours: { flags: number; keycode: number }[], kb: KbBinding[]): { ourCount: number; sectionsSeen: number[]; sameSlotSameSection: number }` — **raw observation only**; it does NOT emit OVERRIDE/FREE labels (blocked on the section-precedence probe, per the spec's Open Questions).

- [ ] **Step 1: Create the fixture slice** — `tests/fixtures/reatooled-slice.ini`

```
KEY 1 85 40033 0		 # Main : U : OVERRIDE DEFAULT
KEY 1 54 0 16		 # Main (ReaTooled) : 6 : DISABLED DEFAULT
KEY 9 89 _FXcc87eaad4330 0		 # Main : Cmd+Y :
SCR 4 0 "abc" "Custom: x" luna/x.lua
```

- [ ] **Step 2: Write failing tests** — `tests/reatooled.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseKb, observeAgainstReatooled } from '@/reatooled'

const slice = readFileSync(fileURLToPath(new URL('./fixtures/reatooled-slice.ini', import.meta.url)), 'utf8')

describe('parseKb', () => {
  it('parses only KEY lines into flags/keycode/command/section', () => {
    const rows = parseKb(slice)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual({ flags: 1, keycode: 85, command: '40033', section: 0 })
    expect(rows[1].section).toBe(16)
  })
})

describe('observeAgainstReatooled (raw, no OVERRIDE/FREE)', () => {
  it('reports counts and the sections it saw without asserting coexistence', () => {
    const rows = parseKb(slice)
    const o = observeAgainstReatooled([{ flags: 1, keycode: 85 }], rows)
    expect(o.ourCount).toBe(1)
    expect(o.sectionsSeen.sort()).toEqual([0, 16])
    expect(o.sameSlotSameSection).toBe(1) // 1/85 matches the section-0 row; observation only
    // deliberately: no `override`/`free` field exists on the result yet
    expect((o as Record<string, unknown>).override).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm test reatooled`
Expected: FAIL (`@/reatooled` not found).

- [ ] **Step 4: Implement** — `src/reatooled.ts`

```ts
export interface KbBinding {
  flags: number
  keycode: number
  command: string
  section: number
}

export function parseKb(text: string): KbBinding[] {
  const out: KbBinding[] = []
  for (const raw of text.split('\n')) {
    const line = raw.split('\t')[0].trim()
    if (!line.startsWith('KEY ')) continue
    const f = line.split(/\s+/)
    if (f.length < 5) continue
    out.push({ flags: Number(f[1]), keycode: Number(f[2]), command: f[3], section: Number(f[4]) })
  }
  return out
}

// Raw observation ONLY. OVERRIDE/FREE semantics are blocked on the section-
// precedence probe (see spec Open Questions); this must not assert coexistence.
export function observeAgainstReatooled(
  ours: { flags: number; keycode: number }[],
  kb: KbBinding[],
): { ourCount: number; sectionsSeen: number[]; sameSlotSameSection: number } {
  const sectionsSeen = [...new Set(kb.map((r) => r.section))].sort((a, b) => a - b)
  const slots = new Set(kb.map((r) => `${r.section},${r.flags},${r.keycode}`))
  let sameSlotSameSection = 0
  for (const o of ours) {
    for (const s of sectionsSeen) {
      if (slots.has(`${s},${o.flags},${o.keycode}`)) { sameSlotSameSection++; break }
    }
  }
  return { ourCount: ours.length, sectionsSeen, sameSlotSameSection }
}
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm test reatooled`
Expected: PASS.

- [ ] **Step 6: Re-dump the action list on this mac, confirm referenced ids resolve, rename**

The dump needs REAPER (documented in README). Run it against a throwaway resource dir so the live config is untouched:

```bash
REAPER_DUMP_OUT=/tmp/reaper-actions-macos.tsv \
  /Applications/REAPER.app/Contents/MacOS/REAPER \
  -cfgfile /tmp/ra-probe/reaper.ini -nosplash -new -newinst tools/dump_actions.lua
```

Then verify **the invariant that matters** — every action id referenced by `luna.toml` resolves in the fresh mac dump — with a throwaway script:

```bash
pnpm exec tsx -e "
import { parseMapping } from './src/mapping.ts'
import { ActionIndex, loadActions } from './src/actions.ts'
import { readFileSync } from 'node:fs'
const m = parseMapping(readFileSync('mappings/luna.toml','utf8'))
const idx = new ActionIndex(loadActions('/tmp/reaper-actions-macos.tsv'))
const ids = new Set<string>()
for (const b of m.bindings) {
  if (!b.kind) continue
  if ('action' in b.kind) ids.add(String(b.kind.action))
  if ('extend' in b.kind) ids.add(String(b.kind.extend))
  if ('macro' in b.kind) for (const s of b.kind.macro) ids.add(String(s))
}
const missing = [...ids].filter(id => !idx.has(id))
if (missing.length) { console.error('MISSING on macOS:', missing); process.exit(1) }
console.log('all', ids.size, 'referenced ids resolve on macOS')
"
```

Expected: `all N referenced ids resolve on macOS`. If any are missing, STOP and report — that is a real cross-platform finding, not a rename detail.

Then adopt the mac dump as the canonical (version-scoped) file:

```bash
git mv data/reaper-actions-7.78-linux.tsv data/reaper-actions-7.78.tsv
cp /tmp/reaper-actions-macos.tsv data/reaper-actions-7.78.tsv   # only if the referenced-id check passed
```

Update `DEFAULT_ACTIONS_TSV` in `src/actions.ts` to `../data/reaper-actions-7.78.tsv` and re-run the whole suite (parity must still pass — action *names* may differ in unreferenced rows, but every referenced id/name pair used by the mapping must be unchanged; if a referenced name changed, the parity `desc` differs only in comments, which parity ignores).

Run: `pnpm test`
Expected: full suite PASS.

- [ ] **Step 7: Commit**

```bash
git add src/reatooled.ts src/actions.ts tests/reatooled.test.ts tests/fixtures/reatooled-slice.ini data/
git commit -m "Add ReaTooled kb parser with raw observation; adopt macOS action dump"
```

---

## Task 11: CLI verbs + router

**Files:**
- Create: `src/cli/args.ts`, `src/cli/build.ts`, `src/cli/install.ts`, `src/cli/find-action.ts`, `src/cli/report.ts`, `src/index.ts`
- Test: `tests/cli.test.ts`

**Interfaces:**
- Consumes: every module above.
- Produces: `runCli(argv: string[]): Promise<number>` in `src/index.ts` (exit code). Verbs: `build [mapping] -o <out> [--target macos|linux] [--no-strict]`, `install [--keymap <p>] [--resource-dir <d>]`, `find-action <terms…> | --id <n> | --section <name>`, `report [--kb <p>]`. `build` writes the keymap and its scripts to disk (scripts under `<outdir>/Scripts/luna/`).

- [ ] **Step 1: Write failing tests** (drive `runCli` end to end in a temp dir) — `tests/cli.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCli } from '@/index'

const luna = fileURLToPath(new URL('../mappings/luna.toml', import.meta.url))
let work: string
beforeEach(() => { work = mkdtempSync(join(tmpdir(), 'ra-cli-')) })

describe('runCli build', () => {
  it('writes a keymap and its scripts, target macos', async () => {
    const out = join(work, 'luna.ReaperKeyMap')
    const code = await runCli(['build', luna, '-o', out, '--target', 'macos'])
    expect(code).toBe(0)
    expect(existsSync(out)).toBe(true)
    expect(readFileSync(out, 'utf8')).toMatch(/^KEY /m)
    expect(existsSync(join(work, 'Scripts', 'luna'))).toBe(true)
  })
  it('exits non-zero and writes nothing on a validation error', async () => {
    const bad = join(work, 'bad.toml')
    const { writeFileSync } = await import('node:fs')
    writeFileSync(bad, '[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\naction=99999999\n')
    const out = join(work, 'bad.ReaperKeyMap')
    const code = await runCli(['build', bad, '-o', out])
    expect(code).not.toBe(0)
    expect(existsSync(out)).toBe(false)
  })
})

describe('runCli find-action', () => {
  it('returns 0 and prints matches (smoke)', async () => {
    expect(await runCli(['find-action', 'zoom', 'horizontal'])).toBe(0)
    expect(await runCli(['find-action', '--id', '40044'])).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test cli`
Expected: FAIL (`@/index` not found).

- [ ] **Step 3: Implement `src/cli/args.ts`** (thin wrappers over `node:util` `parseArgs`)

```ts
import { parseArgs } from 'node:util'

export function parseBuild(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      target: { type: 'string' },
      'no-strict': { type: 'boolean', default: false },
    },
  })
  const mapping = positionals[0]
  if (!mapping) throw new Error('build: missing <mapping> positional')
  if (!values.out) throw new Error('build: -o/--out is required')
  return { mapping, out: values.out, target: values.target, strict: !values['no-strict'] }
}

export function parseInstall(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: { keymap: { type: 'string' }, 'resource-dir': { type: 'string' } },
  })
  return { keymap: values.keymap, resourceDir: values['resource-dir'] }
}

export function parseFindAction(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { id: { type: 'string' }, section: { type: 'string' } },
  })
  return { terms: positionals, id: values.id, section: values.section }
}

export function parseReport(argv: string[]) {
  const { values } = parseArgs({ args: argv, options: { kb: { type: 'string' } } })
  return { kb: values.kb }
}
```

- [ ] **Step 4: Implement the four verb handlers + `src/index.ts` router**

`src/cli/build.ts`:

```ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'
import { parseMapping } from '@/mapping'
import { loadActions, ActionIndex } from '@/actions'
import { buildKeymap } from '@/build-keymap'
import { parseTarget, type Target } from '@/translate'
import { parseBuild } from '@/cli/args'

export function cmdBuild(argv: string[]): number {
  const a = parseBuild(argv)
  const target: Target = a.target ? parseTarget(a.target) : (process.platform === 'darwin' ? 'macos' : 'linux')
  const mapping = parseMapping(readFileSync(a.mapping, 'utf8'))
  const idx = new ActionIndex(loadActions())
  const result = buildKeymap(mapping, idx, target) // throws on validation error -> nothing written
  mkdirSync(dirname(a.out), { recursive: true })
  writeFileSync(a.out, result.keymapText)
  if (result.scripts.size) {
    const dir = join(dirname(a.out), 'Scripts', 'luna')
    mkdirSync(dir, { recursive: true })
    for (const [name, src] of result.scripts) writeFileSync(join(dir, name), src)
  }
  for (const w of result.warnings) console.error(w)
  const s = result.stats
  console.log(`wrote ${a.out}  (${s.direct} direct, ${s.macro} macro, ${s.script} script, ${s.disabled} disabled; ${s.unmapped} unmapped)`)
  return 0
}
```

`src/cli/install.ts`:

```ts
import { join, dirname } from 'node:path'
import { installArtifacts } from '@/install'
import { resolveResourceDir } from '@/reaper-paths'
import { parseInstall } from '@/cli/args'
import { fileURLToPath } from 'node:url'

export function cmdInstall(argv: string[]): number {
  const a = parseInstall(argv)
  const keymap = a.keymap ?? fileURLToPath(new URL('../../build/luna-macos.ReaperKeyMap', import.meta.url))
  const resourceDir = resolveResourceDir({ override: a.resourceDir })
  const out = installArtifacts({
    keymapPath: keymap,
    scriptsDir: join(dirname(keymap), 'Scripts', 'luna'),
    resourceDir,
  })
  console.log(`keymap  -> ${out.keymap}`)
  console.log(`scripts -> ${out.scripts.length} file(s)`)
  console.log('Now in REAPER: Actions > Show action list > Key map > Import...')
  return 0
}
```

`src/cli/find-action.ts`:

```ts
import { loadActions, ActionIndex } from '@/actions'
import { parseFindAction } from '@/cli/args'

export function cmdFindAction(argv: string[]): number {
  const a = parseFindAction(argv)
  const rows = loadActions()
  const idx = new ActionIndex(rows)
  if (a.id) {
    const hit = rows.find((r) => r.commandId === a.id && r.section === (a.section ?? 'main'))
    if (!hit) { console.error(`no action ${a.id}`); return 1 }
    console.log(`${hit.commandId}\t${hit.actionName}`)
    return 0
  }
  for (const r of idx.find(a.terms, a.section)) console.log(`${r.section}\t${r.commandId}\t${r.actionName}`)
  return 0
}
```

`src/cli/report.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseMapping } from '@/mapping'
import { loadActions, ActionIndex } from '@/actions'
import { buildKeymap } from '@/build-keymap'
import { parseKb, observeAgainstReatooled } from '@/reatooled'
import { resolveResourceDir } from '@/reaper-paths'
import { parseReport } from '@/cli/args'
import { parseKey } from '@/keyspec' // NOTE: import as { parse as parseKey }
import { fileURLToPath } from 'node:url'

export function cmdReport(argv: string[]): number {
  const a = parseReport(argv)
  const kbPath = a.kb ?? join(resolveResourceDir(), 'reaper-kb.ini')
  const lunaPath = fileURLToPath(new URL('../../mappings/luna.toml', import.meta.url))
  const mapping = parseMapping(readFileSync(lunaPath, 'utf8'))
  const built = buildKeymap(mapping, new ActionIndex(loadActions()), 'macos')
  const ours: { flags: number; keycode: number }[] = []
  for (const line of built.keymapText.split('\n')) {
    if (!line.startsWith('KEY ')) continue
    const f = line.split(/\s+/)
    ours.push({ flags: Number(f[1]), keycode: Number(f[2]) })
  }
  const kb = parseKb(readFileSync(kbPath, 'utf8'))
  const o = observeAgainstReatooled(ours, kb)
  console.log(`ours: ${o.ourCount} bindings`)
  console.log(`reaper-kb.ini sections seen: ${o.sectionsSeen.join(', ')}`)
  console.log(`same (section,flags,keycode) slot present: ${o.sameSlotSameSection}`)
  console.log('NOTE: raw observation only — OVERRIDE/FREE semantics await the section-precedence probe (see spec).')
  return 0
}
```

Fix the bad import line in `report.ts` (it must be `import { parse as parseKey } from '@/keyspec'`) — but `parseKey` is unused there, so simply delete that import line.

`src/index.ts`:

```ts
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
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm test cli`
Expected: PASS.

- [ ] **Step 6: Manual smoke — build the real keymap through the CLI**

Run: `pnpm ra build mappings/luna.toml -o build/luna-macos.ReaperKeyMap --target macos`
Expected: `wrote build/luna-macos.ReaperKeyMap (...)`, and `build/Scripts/luna/*.lua` present.

- [ ] **Step 7: Commit**

```bash
git add src/cli src/index.ts tests/cli.test.ts build/luna-macos.ReaperKeyMap build/Scripts
git commit -m "Add CLI verbs (build/install/find-action/report) and router"
```

---

## Task 12: README rewrite + typecheck gate + delete Python

**Files:**
- Modify: `README.md`
- Delete: `tools/build_keymap.py`, `tools/install.py`, `tools/find_action.py`, `tools/keyspec.py`
- Keep: `tools/dump_actions.lua`, `mappings/luna-linux.toml` (kept as the historical Linux reference the golden fixture came from) — OR delete it; decide in Step 3.

**Interfaces:**
- Produces: a green `pnpm typecheck` + `pnpm test`, TS-only workflow docs, and no Python left in the tree.

- [ ] **Step 1: Run the typecheck gate and the full suite**

Run: `pnpm typecheck && pnpm test`
Expected: no type errors; all tests PASS. Fix any `any`/cast the typecheck surfaces before proceeding.

- [ ] **Step 2: Rewrite `README.md`** for the TS workflow

Replace the Python invocations with:

```sh
pnpm install
pnpm ra build mappings/luna.toml -o build/luna-macos.ReaperKeyMap   # --target defaults to host OS
pnpm ra install                                                     # stages into REAPER's resource dir
pnpm ra find-action zoom horizontal
pnpm ra report                                                      # ReaTooled raw observation
```

Document, each in a sentence or two: the **host vs. target** distinction; the **one runtime dependency** (`smol-toml`) and why (Node has no stdlib TOML); that **install stages files and never activates/imports or touches `reaper-kb.ini`** — activation stays a REAPER UI step; the Mac-native modifier vocabulary; and that `report` is raw-observation until the section-precedence probe (link the spec's Open Questions). Keep the existing "keymap file format", "Extend Selection", and "Known gaps" sections (still accurate).

- [ ] **Step 3: Decide the fate of `mappings/luna-linux.toml`**

`mappings/luna.toml` is now canonical. Keep `luna-linux.toml` only if you want the Linux-labeled source preserved for provenance; otherwise `git rm` it. The golden **fixture** (`tests/fixtures/luna-linux.reference.ReaperKeyMap`) is independent and stays regardless. Recommended: `git rm mappings/luna-linux.toml` (its content is fully captured by `luna.toml` + the fixture).

- [ ] **Step 4: Delete the Python tools**

```bash
git rm tools/build_keymap.py tools/install.py tools/find_action.py tools/keyspec.py
```

- [ ] **Step 5: Final full run**

Run: `pnpm typecheck && pnpm test`
Expected: green — the TS implementation stands alone.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "Switch README to the TypeScript workflow and remove the Python tools"
```

---

## Self-Review (completed while writing)

**Spec coverage** — each spec section maps to a task:

- Modifier insight / bit-oriented keyspec → Tasks 2, 3.
- TOML boundary + `MappingError`, no casts → Task 6.
- Stable ACT/SCR id contract + dedicated test → Task 4 (pinned) + Task 8 (full set).
- Golden test: semantic-record parity (primary) + byte-for-byte TS drift guard → Task 8.
- Cross-platform resource dir, Windows throws → Task 9.
- Install contract (stages only, never `reaper-kb.ini`) → Task 9.
- Mapping DSL preserved exactly (status vs kind; `disable` unused-but-kept) → Task 6 + Task 8 Step 1.
- Action-list portability = per-referenced-id resolution (not byte identity) → Task 10 Step 6.
- Host vs. target; `--target` only on `build` → Tasks 9, 11.
- ReaTooled coexistence + `report` in raw-observation mode (OVERRIDE/FREE blocked on the probe) → Task 10, Task 11.
- Section-semantics remains an open question, not a port blocker → not implemented as a gate; `report` stays raw (documented in Task 10/11 and README).
- Migration order, Python kept until parity → task sequence; deletion only in Task 12.

**Placeholder scan** — every code/test step contains real, runnable content; the two verified id anchors (`9457b692…`, `76372f6a…`) appear as literal expectations; no "TBD"/"add error handling"/"similar to Task N".

**Type consistency** — names checked across tasks: `parse`/`describe` (keyspec), `Target`/`parseTarget`/`superWarning` (translate), `stableId`/`slugify` (ids), `ActionIndex`/`loadActions`/`DEFAULT_ACTIONS_TSV` (actions), `parseMapping`/`Mapping`/`Binding`/`MappingError` (mapping), `buildKeymap`/`BuildResult`/`renderExtendScript` (build), `resolveResourceDir`/`installArtifacts` (paths/install), `parseKb`/`observeAgainstReatooled` (reatooled), `runCli` (index). One deliberate note left inline in Task 11 `report.ts` to delete an unused import.

**Known deferrals (by design, per spec):** `report` does not emit OVERRIDE/FREE; the section-precedence probe is tracked as the spec's sole open question and is not a prerequisite for this plan's completion.
