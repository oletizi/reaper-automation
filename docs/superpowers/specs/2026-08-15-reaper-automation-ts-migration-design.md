# reaper-automation: TypeScript migration, cross-platform, ReaTooled-aware

Date: 2026-08-15
Status: approved design; implementation plan to follow

## Goals

1. **ReaTooled integration** — build on the ReaTooled install (Pro Tools-style
   REAPER config) already present on this machine, *coexisting* with it rather
   than rewriting its files.
2. **Build on what ReaTooled establishes** — make our overrides visible and
   deliberate against ReaTooled's existing bindings.
3. **Cross-platform** — one codebase that works on Linux and macOS. Windows is
   explicitly out of scope (not tested, not supported).
4. **TypeScript, not Python** — port the tool to TypeScript.

## Non-goals

- Reconciling or rewriting ReaTooled's config files. We layer on top; REAPER's
  keymap import merges our overrides and leaves everything else in place.
- Windows support. `reaper-paths` throws an explicit "unsupported platform"
  error there — no silent fallback.
- Redesigning the mapping DSL. The TOML mapping table and its three binding
  kinds (`action` / `macro` / `extend`, plus `status`) are preserved.

## Context: what exists today

A small, self-contained repo:

- `tools/*.py` — five Python tools (stdlib only: `tomllib`, `hashlib`,
  `argparse`): `build_keymap.py` (the core: TOML -> `.ReaperKeyMap` + Lua
  scripts, validated against the action list), `install.py`, `find_action.py`,
  `keyspec.py`, plus `dump_actions.lua` (a ReaScript, runs *inside* REAPER).
- `mappings/luna-linux.toml` — the declarative mapping table (~102 bindings).
- `build/luna-linux.ReaperKeyMap` + `build/Scripts/luna/*.lua` — generated.
- `data/reaper-actions-7.78-linux.tsv` — the REAPER 7.78 action list.
- `data/luna-shortcuts-macos-raw.tsv` — LUNA's published macOS defaults.

### ReaTooled, as installed

`ReaTooled v2.6.1` is installed under
`~/Library/Application Support/REAPER`. Its shipped `reaper-kb.ini` is
byte-identical to the live one (sha `e758757…`), so ReaTooled currently *owns*
the keyboard config: **462 KEY bindings, 53 custom actions (ACT), 1073
ReaScripts (SCR)**.

Our tool does **not** write `reaper-kb.ini`. It emits a separate
`.ReaperKeyMap` that the user imports through REAPER's UI; REAPER overrides only
the combos the file names and keeps every other default. So "integrate with
ReaTooled" is a workflow/visibility question, not a file-collision problem.

### Verified facts (not assumptions)

- **REAPER 7.78 is installed on this mac** (`reaper-install-rev.txt`), the exact
  version the action dump was made from. REAPER native action IDs are
  platform-shared, so the existing action TSV is reusable on macOS. We will
  re-dump on the mac to confirm byte-identical and drop the `-linux` suffix.
- Our current build produces **102 main-section bindings**. They collide with
  **zero** section-0 entries in the live `reaper-kb.ini` (which carries only 3
  section-0 KEY lines); ReaTooled's Main bindings sit under section `16` — see
  the open question below.

## The modifier insight (drives the mapping design)

REAPER keymap flag bits are the **same bits on every OS**; REAPER renders them
per-platform:

| bit | macOS   | Linux/Windows |
| --- | ------- | ------------- |
| +4  | Shift   | Shift         |
| +8  | Command | Ctrl          |
| +16 | Option  | Alt           |
| +32 | Control | Super/Win     |

So the historical "Cmd -> Ctrl" and "Opt -> Alt" translations happen *for free*
— they are the same bit. The only genuinely per-OS binding is LUNA's physical
**Control** key (bit 32), which renders as **Super** on Linux — exactly the
combos GNOME tends to intercept.

**Decision:** author one canonical mapping in **LUNA-native macOS labels**
(`Cmd`, `Opt`, `Control`) with an unambiguous bit assignment:

- `Cmd` / `Command` -> bit 8
- `Opt` / `Option` -> bit 16
- `Control` -> bit 32

To avoid the ambiguity that sank the old vocabulary (where `Ctrl`, `Cmd`, and
`Control` all fought over bit 8), the canonical source uses these three names
only; `Ctrl` is **not** an accepted modifier token in `mappings/luna.toml`.

Because the bits are unchanged, re-authoring the current `luna-linux.toml` into
Mac-native labels emits **byte-identical KEY bit-lines** (modulo comments). That
is the migration's **golden-file regression anchor**: the TS build on
`--target macos` must reproduce the current keymap's `KEY`/`ACT`/`SCR` bit-lines
exactly.

`translate.ts` is therefore near-identity:

- `--target macos` — identity; describe modifiers as Cmd/Opt/Control.
- `--target linux` — identity bits; describe as Ctrl/Alt/Super. Emit a **warning**
  for any binding that uses bit 32 (mac Control -> Linux Super) since GNOME may
  intercept it. (A future opt-in remap can live here; not built now.)

Default `--target` is the current OS.

## Architecture

Node + tsx + pnpm, ESM, `@/*` path alias (-> `src/*`), vitest. No `any`, no
`as Type`, no `@ts-ignore`. No fallbacks or mock data outside tests — missing
action, unknown key, unsupported OS all **throw** with a description.

```
package.json            # type: module; bin verbs; scripts run via tsx
tsconfig.json           # @/* -> src/*; strict
src/
  keyspec.ts            # "Cmd+Shift+Left" -> {flags,keycode}; describe() inverse
  translate.ts          # per-target bit rendering + Super-conflict warning
  actions.ts            # load + index the action TSV; find/lookup
  mapping.ts            # TOML mapping types; Binding discriminated union
  extend-template.ts    # the Lua EXTEND_TEMPLATE string
  build-keymap.ts       # mapping -> .ReaperKeyMap + Lua scripts (validated)
  reaper-paths.ts       # resource dir per-OS; Windows throws
  install.ts            # copy keymap + scripts into resource dir
  reatooled.ts          # parse live reaper-kb.ini; conflict report
  cli/
    build.ts
    install.ts
    find-action.ts
    report.ts           # ReaTooled conflict report
  index.ts              # verb router / bin entry
tools/
  dump_actions.lua      # unchanged — runs inside REAPER
mappings/
  luna.toml             # renamed; canonical Mac-native modifiers
data/
  reaper-actions-7.78.tsv       # renamed; platform-neutral
  luna-shortcuts-macos-raw.tsv  # unchanged
build/                  # generated output (as today)
tests/                  # vitest
```

Each module has one clear job and stays within 300 lines. `build-keymap.ts` is
the largest; if it approaches the limit, the Lua-script emission splits into its
own module.

### Module responsibilities

- **keyspec.ts** — pure. Parse a human key spec to `{flags, keycode}` and the
  inverse `describe()`. Mac-native modifier vocabulary. Throws `KeySpecError`
  on unknown modifier/key. Keeps the extended-nav `+32768` offset behavior.
- **translate.ts** — pure. Given `{flags}` and a target, returns the emitted
  flags (identity today) and a per-target human description; surfaces the bit-32
  Super-conflict warning for Linux.
- **actions.ts** — load the action TSV into an index keyed by command id
  (section = main). `find()` (AND across terms, case-insensitive), `byId()`,
  section filter — feature parity with `find_action.py`.
- **mapping.ts** — types for the parsed TOML: `Meta` and a `Binding`
  discriminated union over `action | macro | extend | disable | unmapped`.
- **build-keymap.ts** — the core. Validates every command id against
  `actions.ts`; emits `KEY` lines, `ACT` custom actions (stable md5 ids), `SCR`
  script lines, and the generated `extend` Lua files. Strict by default: on any
  validation error or duplicate-combo collision, write nothing and exit non-zero
  (parity with the Python build).
- **reaper-paths.ts** — resolve the REAPER resource dir: macOS
  `~/Library/Application Support/REAPER`, Linux `~/.config/REAPER`; honor
  `--resource-dir` / `$REAPER_RESOURCE_DIR`; throw on Windows/unknown.
- **install.ts** — copy Lua scripts first, then the keymap (order matters, as
  today), into the resolved resource dir.
- **reatooled.ts** — parse the live `reaper-kb.ini` KEY lines into a
  `(flags, keycode, section) -> command` map; provide the conflict report used
  by `cli/report.ts`.

### CLI

A single `reaper-automation` bin routes verbs, argument parsing via the stdlib
`node:util` `parseArgs` (zero dependency):

- `build [mapping] -o <out> [--target macos|linux] [--no-strict]`
- `install [--keymap <path>] [--resource-dir <dir>] [--target …]`
- `find-action <terms…> | --id <n> | --section <name>`
- `report [--kb <reaper-kb.ini>]` — ReaTooled conflict report

## ReaTooled coexistence + conflict report

`report` cross-references our generated bindings against the live
`reaper-kb.ini` and prints, per binding: **OVERRIDE** (we replace a slot
ReaTooled binds) or **FREE** (unused slot). This makes "building on ReaTooled"
visible and deliberate. We never modify ReaTooled's files.

## Testing (vitest)

- **keyspec round-trip** — `describe(parse(x))` stability across the modifier
  and key vocabulary, including extended-nav offset and literal `+`.
- **golden keymap** — build the canonical `luna.toml` on `--target macos` and
  assert the emitted `KEY`/`ACT`/`SCR` bit-lines match a committed reference
  captured from the current Python output. Proves the port is behavior-
  preserving.
- **actions** — loading + `find`/`byId` behavior.
- **reatooled parse** — section/flag/keycode extraction from a fixture slice of
  the live `reaper-kb.ini`.
- **reaper-paths** — per-OS resolution and the Windows throw.
- **build validation** — unknown command id and duplicate-combo both fail the
  build and write nothing.

## Migration strategy

TDD, module by module, Python kept alongside until parity:

1. Scaffold toolchain (package.json, tsconfig with `@/*`, vitest, tsx).
2. Capture a golden reference from the current Python build output.
3. Port pure leaves first (keyspec, translate, actions), each test-first.
4. Port build-keymap; make the golden test pass on `--target macos`.
5. Port reaper-paths + install (cross-platform); port find-action.
6. Add reatooled.ts + report.
7. Re-author `luna-linux.toml` -> `luna.toml` (Mac-native labels); confirm the
   golden test still holds.
8. Re-dump the action list on this mac; confirm byte-identical; rename to
   `reaper-actions-7.78.tsv`; update references.
9. Update README for the TS workflow and cross-platform usage.
10. Delete the Python tools in one commit once TS is at parity. `main` builds a
    correct keymap at every step.

## Open questions (resolve during implementation)

- **Section-16 semantics.** ReaTooled's Main bindings appear under section `16`
  in the live `reaper-kb.ini`, while an imported Main keymap uses section `0`.
  Before the `report` verb can compare the right slots, confirm how REAPER
  namespaces an imported Main keymap against ReaTooled's section-16 entries
  (short investigation: inspect the format, and/or import a probe keymap into a
  throwaway resource dir and observe the merged file). The core port does not
  depend on this; only the report's accuracy does. Until resolved, `report`
  documents which section(s) it compares.
