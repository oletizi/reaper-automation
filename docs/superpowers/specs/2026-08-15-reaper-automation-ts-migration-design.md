# reaper-automation: TypeScript migration, cross-platform, ReaTooled-aware

Date: 2026-08-15
Status: approved design (revised after third-party review); implementation plan
to follow

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
- Redesigning the mapping DSL. It is preserved exactly; see **Mapping DSL
  (preserved exactly)** below for the precise schema.

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

### Mapping DSL (preserved exactly)

The current Python builder defines the schema; the TS port reproduces it
verbatim. Each `[[binding]]` table:

- `luna` — the LUNA action name (label). Present on every binding.
- `key` — the human key spec (e.g. `Cmd+Shift+Left`). Required unless the
  binding is `status = "unmapped"`.
- `status` — optional, one of:
  - *(absent / `"ok"`)* — a normal binding; requires exactly one kind key below.
  - `"unmapped"` — skipped entirely, emits nothing (used to park a LUNA
    shortcut with a comment explaining why). 6 in the current data.
  - `"disable"` — emits `KEY … 0 …`, shadowing REAPER's default for that combo.
    Supported by the builder but **currently unused** in the data. Preserved for
    parity; not removed.
- Exactly one **kind key** (when not `unmapped`/`disable`):
  - `action = <int>` — a native REAPER action id -> a plain `KEY` line.
  - `macro = [<int>, …]` — an ordered step list -> an `ACT` custom action.
  - `extend = <int>` — a cursor-move action id -> a generated `SCR` ReaScript
    (the cumulative "hold Shift while moving the transport" behavior).
- `label` — optional; overrides the generated custom-action / script name.

This schema is described here **once**; other sections refer back to it rather
than restating it.

### Verified facts (not assumptions)

- **REAPER 7.78 is installed on this mac** (`reaper-install-rev.txt`), the exact
  version the action dump was made from. The action ids referenced by the
  mapping are the invariant we actually depend on — see **Action-list
  portability** below — not whole-file byte identity of the dump. We will
  re-dump on the mac and rename the file to drop the `-linux` suffix.
- Our current build produces **102 main-section bindings**. Observation only:
  the live `reaper-kb.ini` carries 3 section-`0` KEY lines while ReaTooled's
  Main bindings sit under section `16`, so a naive section-0 comparison shows
  zero overlap. **This number is not evidence of coexistence** — whether
  sections `0` and `16` share shortcut precedence is unresolved (see
  *Section semantics*, a prerequisite for the `report` verb).

### Action-list portability

The guarantee the build needs is narrow: *for every action id referenced by
`luna.toml`, the supported REAPER version's action corpus contains the expected
action on both supported platforms.* The build already enforces this — it
validates every referenced id against the loaded corpus and fails otherwise. We
re-dump on macOS to confirm the referenced ids resolve; whole-file byte
identity of the two dumps is a nice-to-have, **not** a prerequisite for
platform neutrality.

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
Mac-native labels emits **identical `KEY`/`ACT`/`SCR` semantic records** —
identical flags, keycodes, commands, custom-action ids, and script ids. This is
the migration's **golden-file regression anchor** (see *Testing* for the exact
equivalence definition, which is a semantic-record comparison, **not** a naive
byte diff — the emitted comments differ because `describe()` renders Mac vs
Linux modifier labels).

`keyspec.ts` parses human vocabulary into physical REAPER **bits**; everything
downstream reasons about those bits. `translate.ts` is therefore
presentation/policy, not translation — the unusual `Control -> bit 32 -> Linux
Super` behavior is visible there rather than smuggled into the parser:

- `macos` target — identity bits; describe modifiers as Cmd/Opt/Control.
- `linux` target — identity bits; describe as Ctrl/Alt/Super. Emit a **warning**
  for any binding using bit 32 (mac Control -> Linux Super) since GNOME may
  intercept it. (A future opt-in remap can live here; not built now.)

`--target` selects keyboard semantics for the **generated** bindings and
defaults to the host OS. It is distinct from *host* (where the tool runs / where
REAPER is installed) — see *Host vs. target* under the CLI.

## Architecture

Node + tsx + pnpm, ESM, `@/*` path alias (-> `src/*`), vitest. No `any`, no
`as Type`, no `@ts-ignore`. No fallbacks or mock data outside tests — missing
action, unknown key, unsupported OS all **throw** with a description.

**Runtime dependencies.** Python was stdlib-only ("Nothing to install"). Node
has no stdlib TOML parser, so the port takes on **one** runtime dependency: a
TOML parser (`smol-toml` — TOML 1.0, TS-native, zero transitive deps). This is a
deliberate, named tradeoff; a hand-rolled TOML subset parser would be exactly
the bug-factory our rules forbid. CLI argument parsing stays dependency-free via
the stdlib `node:util` `parseArgs`; md5 ids use stdlib `node:crypto`.

**The TOML boundary (typing has teeth here).** `parseToml()` returns
**`unknown`** — untrusted, unshaped data. `mapping.ts` performs runtime
structural validation against the *Mapping DSL (preserved exactly)* schema and
returns a typed `Mapping`; anything malformed, or a binding that violates the
"exactly one kind key" rule, throws `MappingError` naming the offending binding.
`const m = parseToml(...) as Mapping` is explicitly forbidden — the validator,
not a cast, is how untrusted TOML becomes typed.

```
package.json            # type: module; bin verbs; scripts run via tsx
tsconfig.json           # @/* -> src/*; strict
src/
  keyspec.ts            # "Cmd+Shift+Left" -> {flags,keycode}; describe() inverse
  translate.ts          # per-target bit rendering + Super-conflict warning
  actions.ts            # load + index the action TSV; find/lookup
  mapping.ts            # parseToml -> unknown -> validate -> Mapping | throw MappingError
  extend-template.ts    # the Lua EXTEND_TEMPLATE string
  build-keymap.ts       # mapping -> .ReaperKeyMap + Lua scripts (validated)
  reaper-paths.ts       # resource dir per-OS; Windows throws
  install.ts            # copy built artifacts into resource dir (never activates)
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
- **mapping.ts** — the TOML boundary. `parseToml() -> unknown`, then runtime
  structural validation to a typed `Mapping` per the *Mapping DSL* schema
  (`Meta` + a `Binding` whose kind is one of `action | macro | extend`, with
  `status ∈ {ok, unmapped, disable}` orthogonal). Malformed input throws
  `MappingError`. No casts.
- **build-keymap.ts** — the core. Validates every command id against
  `actions.ts`; emits `KEY` lines, `ACT` custom actions and `SCR` scripts (see
  *Stable ACT/SCR identity* — the md5 id algorithm is a migration contract), and
  the generated `extend` Lua files. Strict by default: on any validation error
  or duplicate-combo collision, write nothing and exit non-zero (parity with the
  Python build).
- **reaper-paths.ts** — resolve the REAPER resource dir *from the host OS*:
  macOS `~/Library/Application Support/REAPER`, Linux `~/.config/REAPER`; honor
  `--resource-dir` / `$REAPER_RESOURCE_DIR`; throw on Windows/unknown.
- **install.ts** — copy Lua scripts first, then the keymap (order matters, as
  today), into the resolved resource dir. See the **install contract** under the
  CLI: it stages files only, and never activates or imports anything.
- **reatooled.ts** — parse the live `reaper-kb.ini` KEY lines into a
  `(flags, keycode, section) -> command` map; provide the conflict report used
  by `cli/report.ts`.

### CLI

A single `reaper-automation` bin routes verbs, argument parsing via the stdlib
`node:util` `parseArgs` (zero dependency):

- `build [mapping] -o <out> [--target macos|linux] [--no-strict]`
- `install [--keymap <path>] [--resource-dir <dir>]`
- `find-action <terms…> | --id <n> | --section <name>`
- `report [--kb <reaper-kb.ini>]` — ReaTooled conflict report

**Host vs. target.** These are separate axes and never collapse into one value:

- *host* — the machine the tool runs on / where REAPER is installed. Determines
  the resource dir (`reaper-paths`, override via `--resource-dir`).
- *target* — the keyboard semantics baked into generated bindings (`--target` on
  `build`, default = host OS).

`--target` therefore lives on `build` only. `install` has **no** `--target`: it
copies an already-built keymap to a resource dir, so a target is meaningless
there (the semantics were fixed at build time). Cross-host installs remain
possible via `--resource-dir` alone.

**Install contract.** `install` stages generated artifacts into their expected
filesystem locations — the built `.ReaperKeyMap` into `KeyMaps/` and the `extend`
scripts into `Scripts/luna/`, scripts first (the keymap references them by
path). It **does not** activate, import, or otherwise change REAPER's active
keyboard configuration, and it **never touches `reaper-kb.ini`**. Binding
activation is an explicit REAPER UI step (Actions -> Show action list -> Key map
-> Import…). This is the exact behavior of the current `install.py`, kept as the
parity contract — and it is what keeps the ReaTooled-coexistence safety story
true.

## ReaTooled coexistence + conflict report

`report` cross-references our generated bindings against the live
`reaper-kb.ini`. **Prerequisite (blocking for `report` only):** the labels
`OVERRIDE` / `FREE` have no defined meaning until an empirical probe establishes
which `reaper-kb.ini` sections share shortcut precedence with an imported
Main-section keymap (see *Section semantics*). The TypeScript migration may
proceed before that is resolved, but until it is, the tool **must not** label a
binding `OVERRIDE` or `FREE`; `report` instead prints the raw observation (our
combos vs. the sections it parsed) and names the sections it compared. Once the
precedence model is verified, `report` promotes to the OVERRIDE/FREE semantics.
We never modify ReaTooled's files at any stage.

## Testing (vitest)

- **keyspec round-trip** — `describe(parse(x))` stability across the modifier
  and key vocabulary, including extended-nav offset and literal `+`.
- **golden keymap — semantic-record parity (primary).** Parse both the committed
  Python-generated `.ReaperKeyMap` and the TS `--target macos` build into
  *ordered semantic records* and assert equality:
  - `KEY` -> `{flags, keycode, command, section}`
  - `ACT` -> `{id, steps[]}`
  - `SCR` -> `{id, path}`

  Comments are **not** compared — they legitimately differ, because the Python
  reference was built from Linux-labeled source and `describe()` renders Mac
  labels on the macos build. This proves the relabeling + the port preserve
  every binding, custom action, and script.
- **golden keymap — byte-for-byte (drift guard).** A committed fixture captured
  from the **TS** macos build; assert future TS builds reproduce it byte-for-byte
  (same target, same source — identity is genuinely expected here). Guards the
  emitter against accidental formatting/ordering/newline drift. Our generator
  emits only relative script paths, so no absolute-path noise arises.
- **stable ACT/SCR identity (migration contract).** Assert every generated
  custom-action and script `command` id equals the Python implementation's for
  the same canonical mapping. The id algorithm must be reproduced exactly:
  `md5("reaper-automation/" + label)` over UTF-8 bytes, lowercase hex, where
  `label` is derived identically (macro: `LUNA: <luna>` or the `label` override;
  extend: `LUNA: <base>`), and macro step ordering is preserved. A divergent
  hash makes REAPER see *newly invented* actions even when the KEY bits match —
  so this gets its own test, separate from bit parity.
- **actions** — loading + `find`/`byId` behavior.
- **reatooled parse** — section/flag/keycode extraction from a fixture slice of
  the live `reaper-kb.ini`.
- **reaper-paths** — per-OS resolution and the Windows throw.
- **build validation** — unknown command id and duplicate-combo both fail the
  build and write nothing.

## Migration strategy

TDD, module by module, Python kept alongside until parity:

1. Scaffold toolchain (package.json with the `smol-toml` dep, tsconfig with
   `@/*`, vitest, tsx).
2. Capture golden references from the current Python build output: the parsed
   semantic records, and the ACT/SCR id set.
3. Port pure leaves first (keyspec, translate, actions), each test-first.
4. Port mapping.ts (TOML boundary + `MappingError`), then build-keymap; make the
   semantic-record parity and id-stability tests pass on `--target macos`.
5. Port reaper-paths + install (cross-platform, no `--target` on install); port
   find-action.
6. Add reatooled.ts + `report` in raw-observation mode (no OVERRIDE/FREE labels).
7. Re-author `luna-linux.toml` -> `luna.toml` (Mac-native labels; `disable`
   status preserved though unused); confirm parity + id-stability still hold.
8. Re-dump the action list on this mac; confirm every id referenced by
   `luna.toml` resolves (the real invariant — not whole-file byte identity);
   rename to `reaper-actions-7.78.tsv`; update references.
9. Update README for the TS workflow, the host/target distinction, the one new
   runtime dependency, and cross-platform usage.
10. Delete the Python tools in one commit once TS is at parity. `main` builds a
    correct keymap at every step.
11. *(Separately, unblocks the `report` upgrade — not a port prerequisite)*
    Resolve *Section semantics* (below), then promote `report` to OVERRIDE/FREE.

## Open questions

- **Section semantics — RESOLVED (2026-08-15) by empirical test.** ReaTooled's
  Main bindings live under section `16` in the live `reaper-kb.ini`, while a
  keymap imported through REAPER's UI lands in section `0`. The precedence
  question is now answered: **section 16 wins over section 0.** A section-0
  import is therefore *inert* on any key ReaTooled already binds in section 16
  (~399 of its Main keys) — the "layer LUNA on top via import" model silently
  fails for every conflicting key. Verified end-to-end on REAPER 7.78 + ReaTooled
  2.6.1: `[`/`]` bound in our section-0 import did nothing (ReaTooled's section-16
  "set time-selection point" fired instead); rebuilding the same bindings into
  section 16 and re-importing made them take effect. REAPER's importer preserves
  the section field (it only normalizes keycodes, e.g. VK 221 → raw ASCII 93).

  **Consequence for the tool:** `buildKeymap` takes a `section` argument (CLI
  `--section`, default `0`). Stock REAPER uses `0`; **ReaTooled coexistence
  requires `--section 16`** so our bindings replace ReaTooled's in the same
  section. This is the mechanism `report` needs, too: OVERRIDE/FREE labels can
  now be defined against same-section precedence (section 16 for a ReaTooled
  host). Promoting `report` from raw-observation to OVERRIDE/FREE is the
  remaining follow-up.
