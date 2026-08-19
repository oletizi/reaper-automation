# reaper-automation

Making REAPER's keyboard shortcuts conform to Universal Audio's LUNA — which in
turn inherits most of its key layout from Pro Tools.

The visible goal is the key layout. The actual one is making Pro Tools' **2D
edit area** — a time span across a set of tracks, acted on as a unit regardless
of where clips happen to begin and end — behave like a first-class concept in a
DAW that doesn't have one. See [CONSTITUTION.md](CONSTITUTION.md); it governs
every design decision here.

The mapping lives in a plain TOML table. A generator turns it into a
`.ReaperKeyMap` file, validating every command ID against an action list dumped
out of REAPER itself. Edit the table, rebuild, re-import, iterate.

This is a TypeScript/Node CLI (`ra`, run via `pnpm ra`). It replaced an earlier
Python implementation; there is no Python left in this repo.

## Layout

```
mappings/luna.toml                  the mapping table, Mac-native labels -- this is the thing you edit
build/luna-macos.ReaperKeyMap       generated (gitignored); import this into REAPER
build/Scripts/luna/*.lua            generated (gitignored) ReaScripts the keymap references
src/                                the TypeScript implementation (keyspec, translate, mapping, build-keymap, ...)
src/index.ts                        CLI entry point, invoked as `pnpm ra <verb> ...`
tools/dump_actions.lua              ReaScript that dumps REAPER's action list (runs inside REAPER)
data/reaper-actions-7.78.tsv        10,578 actions dumped from REAPER 7.78
data/luna-shortcuts-macos-raw.tsv   LUNA's published macOS defaults
```

A binding in the table is one of three kinds:

| key in TOML | becomes |
| --- | --- |
| `action = 40044` | a plain `KEY` line pointing at a native REAPER action |
| `macro = [40296, 41325]` | an `ACT` custom action running those steps in order |
| `extend = 41042` | a generated ReaScript (`SCR`) — see Extend Selection below |
| `razor = 40548` | an `ACT` that selects the area's items, then acts — whole-clip |
| `razor_slice = 40175` | an `ACT` that **splits at the area edges first**, then acts — area-scoped |

## Setup

```sh
just bootstrap     # or: pnpm install
```

There's a `justfile` wrapping the CLI, so `just` alone lists every verb and
`just refresh` / `just doctor` / `just check` do the obvious things. It's a thin
convenience layer: it installs dependencies if they're missing, fails loud with
install instructions if `pnpm` isn't on `PATH`, and delegates everything else
straight to `ra`. Host detection, section detection and artifact naming live in
the TypeScript, not in the justfile. `just` is optional — every verb below works
as a plain `pnpm ra ...` invocation.

The one runtime dependency is `smol-toml` — Node has no stdlib TOML parser, so
this is no longer "nothing to install." Everything else (`tsx`, `typescript`,
`vitest`) is a dev dependency for running and testing the CLI itself.

## Build

```sh
pnpm ra build          # mapping, output path and --target all default to the host
```

The mapping defaults to `mappings/luna.toml` and the output to
`build/luna-<host>.ReaperKeyMap`, both resolved from the repo root, so the verb
works from any directory. Pass `<mapping>` / `-o` / `--target macos|linux` to
override any of them.

The build fails rather than emitting a dead key if a command ID doesn't exist
or two bindings collide on the same combo — nothing is written on error.

### Coexisting with ReaTooled (`--section`)

By default the keymap is emitted into REAPER's stock Main key section (`0`).
**On a machine running ReaTooled, build with `--section 16`:**

```sh
pnpm ra build --section 16
```

ReaTooled keeps its ~399 Main bindings in section `16`, and section 16 takes
precedence over an imported section-0 keymap — so a stock (section-0) import is
silently inert on every key ReaTooled already binds. Emitting into section 16
makes our bindings replace ReaTooled's in the same section on import. (Verified
on REAPER 7.78 + ReaTooled 2.6.1; REAPER's keymap import preserves the section
field.) On stock REAPER with no ReaTooled, use the default `0`.

### Host vs. target

These are two separate axes and never collapse into one value:

- **host** — the machine the tool runs on, i.e. where REAPER is installed. It
  determines the resource directory `install` writes into (macOS
  `~/Library/Application Support/REAPER`, Linux `~/.config/REAPER`), and is the
  default for `--target` when building.
- **target** — the keyboard semantics baked into the generated bindings
  (Cmd/Opt/Control vs. Ctrl/Alt/Super). This is the `--target macos|linux` flag
  on `build` only — `install` has no `--target`, since it just copies an
  already-built keymap and the semantics were fixed when it was built.

## Install into REAPER

```sh
pnpm ra install
```

With no `--keymap`, `install` stages the artifact built **for this host** —
`build/luna-macos.ReaperKeyMap` on macOS, `build/luna-linux.ReaperKeyMap` on
Linux — the same file `build`, `refresh` and `doctor` name.

**Always build before you install.** `build/` is a generated, gitignored
staging directory — it's not committed, and its contents are machine-specific
(the `--section` is baked for the host's ReaTooled state, the reload button bakes
the host's repo + node paths, and each script carries the build's git stamp). Run
`pnpm ra build` (auto-detects the right section) and then `pnpm ra install`, or
just `pnpm ra refresh` to do both.

That copies the keymap into `~/Library/Application Support/REAPER/KeyMaps/`
(or the Linux equivalent, or `--resource-dir`/`$REAPER_RESOURCE_DIR`) and the
generated ReaScripts into `.../Scripts/luna/`, scripts first, since the keymap
references them by path.

`install` only **stages** files onto disk. It never activates or imports
anything and never touches `reaper-kb.ini`. Activation is a manual REAPER UI
step: Actions → Show action list → **Key map** (bottom right) → Import…, and
pick **LUNA (Pro Tools)**.

Importing only overrides the combos the file names; REAPER's other defaults stay
put. To get back to stock, use Key map → Reset to factory defaults.

## Refresh workflow (iterating on the mapping)

`build` + `install` are the two low-level steps. For day-to-day iteration use the
single verb that chains them and checks its own work:

```sh
pnpm ra refresh
```

`refresh` builds (auto-detecting the ReaTooled section), installs, then
**verifies the installed bytes match the build** — so "it refreshed" is never a
lie. It prints one machine-readable line, `BINDINGS: changed` or
`BINDINGS: unchanged`, that tells you whether a re-import is needed:

- **Script bodies changed only** → `BINDINGS: unchanged`. REAPER re-reads a
  ReaScript from disk on every run, so the change is **already live** — nothing
  else to do.
- **A key binding changed** (new/moved key) → `BINDINGS: changed`. REAPER only
  reads `reaper-kb.ini` at startup, so re-import once: Actions → Show action
  list → Key map → Import → **LUNA (Pro Tools)**.

`refresh` also **prunes** installed scripts the current build no longer emits, so
a removed feature can't leave a stale script firing behind your back.

### The in-REAPER Reload button

There's a generated action, **`Custom: LUNA: Reload`**, that runs `pnpm ra
refresh` from *inside* REAPER — no terminal, no import dance for the common case.
It shells out through a login shell with the node/pnpm bin dir (detected at build
time) baked onto `PATH`, because a macOS GUI app doesn't inherit your interactive
shell's `PATH`. After a refresh it shows a message box telling you whether
scripts are live (bindings unchanged) or a one-time re-import is needed.

One-time setup: after the first import, open Actions → Show action list, find
**LUNA: Reload**, and bind it to a key or drop it on a toolbar. From then on it's
your single reload button.

### `doctor` — is what's running what I built?

```sh
pnpm ra doctor
```

Reports the version chain **source (git) → build → installed → last-fired** (the
last is read from the debug log, below) and exits non-zero on drift — e.g. you
edited a template but never rebuilt, or built but never installed. Every
generated artifact carries a short git-sha stamp so these four can be compared.

### Debug log

Every generated script appends one capped, timestamped line to
`~/Library/Application Support/REAPER/luna-debug.log` (Linux: the resource-dir
equivalent), tagged with the version stamp of the script that fired:

```
2026-08-17T12:41:03  tab_transient_next  sha=101d486  tracks=3 items=12 cur=4.000->4.512 moved=true
```

This is the record for diagnosing "I pressed the key and nothing happened": it
shows which script fired, at which version, what state it saw, and what it did.
The log self-trims to its last ~1MB, and logging is pcall-guarded so it can never
break the action it observes.

### `razor` vs. `razor_slice`

Both wrap an operation that isn't natively razor-aware, and the difference is
what happens when the area covers only *part* of a clip:

- `razor_slice = <id>` → `40061 42957 <id>` — split at the area edges, select
  the pieces that lie inside, then act. The operation is bound by the area, not
  by the clip. This is the default choice; see
  [CONSTITUTION.md](CONSTITUTION.md), Principle 1.
- `razor = <id>` → `42957 <id>` — select the area's items and act on them
  whole. Correct only for operations that are inherently whole-clip, where
  splitting first would be meaningless: Heal Separation, Consolidate, the
  cursor-relative fades and trims.

Delete (`40006`) and Cut (`40699`) need neither wrapper — they act on the razor
area natively, verified on REAPER 7.78.

## Extend Selection

LUNA's "hold Shift while moving the transport" — `Shift+]` moves forward a bar
*and* grows the edit area you crossed, and pressing it again grows the area
further rather than replacing it. Bound here for bar, clip edge, marker,
transient, and session start/end.

This can't be a custom action. REAPER can move the cursor (`41042`) and repaint
the razor edit area's end to the cursor, but a macro chaining them re-anchors on
every press: from bar 2, `Shift+]` twice gives you bar 3–4 instead of bar 2–4.
Getting cumulative extension needs a conditional — grow the correct edge only
when a span already exists, anchor a new one otherwise — so each of these
compiles to a small generated ReaScript instead (`razor_extend` in the mapping
table; see *Edit-selection model* below). No extension required; Lua ships with
REAPER.

Verified end-to-end against REAPER with the keymap loaded: from 4.0s, three
presses give `4.0..6.0` → `4.0..8.0` → `4.0..10.0`, and the reverse key shrinks
back to `4.0..8.0` → `4.0..6.0` with the anchor held.

## Edit-selection model (razor edit)

The edit area **is a native REAPER razor edit** — the same object you'd draw
by dragging a razor rectangle across a track's top edge in the REAPER GUI,
stored per-track in `P_RAZOREDITS`. Unlike a time selection (which REAPER
renders identically across every track, making a "2D area" indistinguishable
from a plain 1D range), a razor edit draws a distinct rectangle only on the
tracks it covers — the same visual LUNA itself uses for its edit-area
highlight. There's no separate "area" object to keep in sync: the razor *is*
the area, and item selection is only ever derived from it transiently, for
the operations that need it.

Two axes, both driven entirely by keyboard:

- **Horizontal (time span)** — `Shift+[` / `Shift+]` / `Shift+L` / `Shift+'`
  and the Shift-variants of the clip-edge/transient/marker/session nav keys
  grow the razor's time span. Each compiles to a `razor_extend` script
  (see *Extend Selection* above): it reads the current span from
  `P_RAZOREDITS`, grows the correct edge (forward move grows the end,
  backward grows the start), repaints the result onto the selected tracks,
  parks the transport at the new span's start, sets loop points from the
  razor (`42474`), and enables repeat.
- **Vertical (tracks)** — `Shift+P` / `Shift+;` (and plain `P` / `;`) extend
  or move the track selection natively (`40287`/`40288`/`40285`/`40286`),
  then repaint the *existing* razor time span onto the new track selection —
  compiled from `razor_track = <track-selection action id>` in the mapping
  table, via the shared `luna_razor_repaint.lua` script. (There's currently
  no keyboard binding for "add this track to the selection without moving
  the focus," the Cmd-click equivalent — see *Known gaps*.)

Operations on the area split into two shapes in `mappings/luna.toml`,
classified on tower per-binding (does the action honor the razor natively?):

- **`action = <id>`** — razor-aware natively: the action already scopes
  itself to the razor edit area (or, for Paste, doesn't care about any
  selection at all), so it runs as a plain native action with no prelude.
  Examples: `Separate Selection` (`40061`), `Delete`/`Clear` (`40006`),
  `Cut` (`40699`).
- **`razor = <id>`** — not razor-aware: compiles to a macro
  `[42957, <id>]` — `42957` ("Razor edit: Select all items within razor
  edit area") materializes the razor's items as an item selection, then
  the given action runs against that selection. Examples: `Copy` (`41383`),
  `Mute Selection` (`40175`), the fade/trim/duplicate family.

A plain cursor move — no Shift — is the way back out: it compiles to
`macro = [<move-action>, 42406]` (move the cursor, then `42406` clears every
razor edit area on every track). That's the area collapsing to nothing at
wherever the cursor lands, matching Pro Tools' behavior of a bare nav key
dropping whatever was selected. Transport/loop always derive from the razor
(`42474` + `GetSetRepeat(1)`), never tracked independently.

All of it — the plain razor-aware actions, the `razor=` macros, the
`razor_extend`/`razor_track` scripts, and the plain-move collapse family —
lands in whichever section the build auto-detects (see *Coexisting with
ReaTooled* above), same as every other binding in the table.

This intentionally diverges from the tool's original Python-era output (and
from an earlier, now-retired `area`-selection substrate that derived the area
from independent track- and time-selection state rather than a razor edit).
`tests/parity.test.ts` no longer compares against a frozen historical
reference for these bindings — the byte-for-byte TS build fixture
(`tests/fixtures/luna-macos.tsbuild.ReaperKeyMap`) is the regression baseline
going forward.

## Linux: freeing the combos GNOME takes first

GNOME grabs some combos before any application sees them — `Alt+Tab` and
`Shift+Alt+Tab` most consequentially, which are LUNA's reverse tab-to-transient
keys. Per [CONSTITUTION.md](CONSTITUTION.md) Principle 5 the combo goes to the
selection vocabulary, so:

```sh
pnpm ra wm                  # report what the desktop is swallowing (dry run)
pnpm ra wm --apply          # free exactly those combos
pnpm ra wm --revert --apply # restore GNOME's defaults
```

It removes **only** the colliding accel and leaves every other shortcut on that
action intact — freeing `Alt+Tab` leaves `Super+Tab` switching applications, so
in practice you lose nothing. It reports any action it would leave with no
shortcut at all rather than silently stranding it. On macOS it is a clean no-op.

## Keybindings reference

[KEYBINDINGS.md](KEYBINDINGS.md) lists every combo this project binds, with both
platform labels and the real action names each one resolves to. It is
**generated** from `mappings/luna.toml`:

```sh
pnpm ra docs            # regenerate
pnpm ra docs --check    # fail if it has drifted (part of `just check`)
```

Don't hand-edit it — a second hand-maintained copy of the mapping table is the
one artifact here that could silently stop describing the keymap.

### REAPER's own defaults

[docs/reaper-default-shortcuts.md](docs/reaper-default-shortcuts.md) is a
reference copy of REAPER's stock bindings with a column marking which ones this
keymap displaces — so a proposed binding can be checked against what it would
override instead of guessed at. It's third-party and partial; the authoritative
check is REAPER's own action list on the machine in question.

## Looking up actions

```sh
pnpm ra find-action zoom horizontal      # AND across terms, case-insensitive
pnpm ra find-action --id 40509
pnpm ra find-action --section midi_editor "note:"
```

## Conflict report (ReaTooled)

```sh
pnpm ra report
```

Cross-references our generated bindings against the live `reaper-kb.ini` and
prints the raw observation: our combos, the sections it parsed out of
`reaper-kb.ini`, and how many land on the same `(section, flags, keycode)`
slot. It deliberately stops there — it does **not** label anything `OVERRIDE`
or `FREE` yet. Those labels require knowing which `reaper-kb.ini` sections
actually share shortcut precedence with an imported Main-section keymap, and
that hasn't been established empirically. See *Open questions* in
`docs/superpowers/specs/2026-08-15-reaper-automation-ts-migration-design.md`
for the section-precedence probe that would unblock it. We never modify
ReaTooled's files at any stage.

## Re-dumping the action list

The dump is version-specific. To regenerate it for another REAPER build, point
REAPER at a throwaway resource directory so your real config is untouched:

```sh
REAPER_DUMP_OUT=/tmp/reaper-actions.tsv \
  reaper -cfgfile /tmp/probe/reaper.ini -nosplash -new -newinst tools/dump_actions.lua
```

The script enumerates every section via `kbd_enumerateActions` and quits REAPER
when it's done. This Lua script runs inside REAPER, so it wasn't ported.

## The keymap file format

Undocumented by Cockos, so it was reverse-engineered from community keymaps that
carry human-readable comments, then confirmed by round-tripping through REAPER.

```
KEY <flags> <keycode> <command> <section>
```

`flags` is a Windows-ACCEL-style bitfield:

| bit | meaning |
| --- | --- |
| 1 | keycode is a virtual key (0 = raw ASCII, 255 = mousewheel/multitouch) |
| +4 | Shift |
| +8 | Ctrl — Command on macOS |
| +16 | Alt — Option on macOS |
| +32 | Super/Win — Control on macOS |

`keycode` is a Windows virtual-key code, except that the extended navigation
block (VK 33–47: PgUp, PgDn, End, Home, arrows, Insert, Delete) is offset by
**+32768** — giving REAPER's 32801–32815 range. So Left (VK 37) is 32805.

`command` is either a numeric action ID or `_<id>` referencing a custom action
defined by an `ACT` line earlier in the same file. `section` is 0 for Main.

Verified by loading a generated map as `reaper-kb.ini`, letting REAPER 7.78 parse
and rewrite it, and diffing: all 91 bindings and both custom actions came back
with identical flags, keycodes, and commands.

## Modifier translation

The bit values above are identical on every OS — REAPER just renders them with
different labels per platform (`+8` is Command on macOS, Ctrl on Linux/Windows;
`+16` is Option vs. Alt). Because LUNA is itself macOS-only, `mappings/luna.toml`
is authored directly in **Mac-native modifier tokens** — `Cmd`, `Opt`,
`Control`, `Shift` — which map 1:1 onto LUNA's own modifier names, no
translation needed. `Ctrl`, `Super`, `Alt`, `Win`, and `Meta` are not valid
input tokens in the mapping table; only the Mac-native names above parse.

`--target macos|linux` on `build` controls only how those same bits are
*rendered back out* for display and warnings, not how the mapping is written.
The one genuinely per-OS binding is LUNA's physical **Control** key (bit `+32`),
which renders as **Super** on a Linux target — exactly the combos GNOME tends
to intercept. If a Super binding turns out to be unusable there, change it in
the TOML and rebuild — that's the one-line-per-binding case the generator
exists for.

## Known gaps

Six LUNA shortcuts are deliberately left unmapped rather than approximated; each
carries a `status = "unmapped"` and a comment explaining why. The substantive
ones:

- **Create Marker.** LUNA puts it on numpad Enter and Return To Zero on Return.
  REAPER on Linux appears to report both as `VK_RETURN`, so binding it would
  steal RTZ. Wants a real keyboard test.
- **The "Shift" edit family** (Shift Cut / Paste / Duplicate / Insert). This is
  ripple editing. REAPER models ripple as a persistent mode rather than as
  per-operation variants, so it needs a design decision, not a binding.
- **Create Bus.** REAPER buses are just folder tracks.

Two bindings are macros rather than native actions — Increase/Decrease All Track
Heights select all tracks first, which is a visible side effect.

Clip-edge navigation deliberately uses the *nearest item edge* actions
(`41167`/`41168`) rather than *edge of item* (`40318`/`40319`). The latter only
walk the edges of **selected** items, so with a clip selected they ping-pong on
that one clip and never cross to the next.

Tab-to-Transient (`40375`/`40376`) depends on REAPER **detecting** transients,
which needs adequate level. Very quiet takes (roughly under −30 dBFS peak)
produce no detectable transients, so Tab only stops at clip edges — this is a
material/level issue, not a binding one. Normalize or raise the clip gain and it
works. The `tools/diag` harness reproduces and confirms this headlessly; the
`luna-debug.log` line for a press shows `landed=item_end`/`item_start` when this
is happening.
