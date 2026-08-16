# reaper-automation

Making REAPER's keyboard shortcuts conform to Universal Audio's LUNA — which in
turn inherits most of its key layout from Pro Tools.

The mapping lives in a plain TOML table. A generator turns it into a
`.ReaperKeyMap` file, validating every command ID against an action list dumped
out of REAPER itself. Edit the table, rebuild, re-import, iterate.

This is a TypeScript/Node CLI (`ra`, run via `pnpm ra`). It replaced an earlier
Python implementation; there is no Python left in this repo.

## Layout

```
mappings/luna.toml                  the mapping table, Mac-native labels -- this is the thing you edit
build/luna-macos.ReaperKeyMap       generated; import this into REAPER
build/Scripts/luna/*.lua            generated ReaScripts the keymap references
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

## Setup

```sh
pnpm install
```

The one runtime dependency is `smol-toml` — Node has no stdlib TOML parser, so
this is no longer "nothing to install." Everything else (`tsx`, `typescript`,
`vitest`) is a dev dependency for running and testing the CLI itself.

## Build

```sh
pnpm ra build mappings/luna.toml -o build/luna-macos.ReaperKeyMap   # --target defaults to host OS
```

The build fails rather than emitting a dead key if a command ID doesn't exist
or two bindings collide on the same combo — nothing is written on error.

### Coexisting with ReaTooled (`--section`)

By default the keymap is emitted into REAPER's stock Main key section (`0`).
**On a machine running ReaTooled, build with `--section 16`:**

```sh
pnpm ra build mappings/luna.toml -o build/luna.ReaperKeyMap --section 16
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

**Always build before you install** — don't import the checked-in
`build/*.ReaperKeyMap` artifact directly. It's committed as a build output for
reference, but its `--section` was baked for the machine it was last built on
(this maintainer's ReaTooled section 16); importing it as-is on a different
machine can bind into the wrong section and produce dead keys. Run
`pnpm ra build` (auto-detects the right section) and then `pnpm ra install`.

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

## Extend Selection

LUNA's "hold Shift while moving the transport" — `Shift+]` moves forward a bar
*and* selects the bar you crossed, and pressing it again grows the selection
rather than replacing it. Bound here for bar, clip edge, marker, transient, and
session start/end.

This can't be a custom action. REAPER can move the cursor (`41042`) and set the
time selection end to the cursor (`40626`), but a macro chaining them re-anchors
on every press: from bar 2, `Shift+]` twice gives you bar 3–4 instead of bar 2–4.
Getting cumulative extension needs a conditional — anchor only when no selection
exists yet — so each of these compiles to a small generated ReaScript instead.
No extension required; Lua ships with REAPER.

Verified end-to-end against REAPER with the keymap loaded: from 4.0s, three
presses give `4.0..6.0` → `4.0..8.0` → `4.0..10.0`, and the reverse key shrinks
back to `4.0..8.0` → `4.0..6.0` with the anchor held.

## Edit-selection model (`area`)

Pro Tools/LUNA build an "edit area" to operate on from two independent axes,
both driven entirely by keyboard:

- **Tracks** (vertical scope) — `Shift+P` / `Shift+;` extend the track
  selection up/down, non-contiguous tracks allowed. (There's currently no
  keyboard binding for "add this track to the selection without moving the
  focus," the Cmd-click equivalent — see *Known gaps*.)
- **Time range** (horizontal scope) — `Shift+[` / `Shift+]`, and the
  Shift-variants of the clip-edge/transient/marker nav keys, extend the time
  selection. No time selection means zero-width: the area collapses to
  wherever the edit cursor is.

Tracks × time range is never stored as its own object — it's derived on
demand by a shared ReaScript, `luna_select_area.lua` (generated from
`src/select-area-template.ts`). Given the currently selected tracks (or all
tracks, if none are selected) and the current time selection (or the cursor
position, if none), it splits any items crossing those boundaries and, when
there was a real time range, selects exactly the items that fall inside it.

Two binding shapes in `mappings/luna.toml` use it:

- **`area = true`** — run the select-area script and stop there. This is
  `Separate Selection` (`B` / `Cmd+E`): materializing the split+select *is*
  the separate.
- **`area = <action id>`** — run the select-area script, then the given
  native action. `Clear`/`Delete` uses `40006` (Item: Remove items,
  clipboard untouched); `Cut` uses `40699` (Item: Cut items, clipboard set).
  Each compiles to its own generated custom action (`ACT` line), so Delete
  and Cut show up in REAPER's action list as two distinct, correctly-labeled
  commands rather than one action wearing two key bindings.

A plain cursor move — no Shift — is the way back out. `]` / `[`, `L` / `'`,
`Tab`, `Opt+'` / `Opt+L`, and the marker-nav keys all compile to
`macro = [<move-action>, 40635, 40289]`: move the cursor, clear the time
selection (`40635`), clear the item selection (`40289`). That's the area
collapsing to a zero-width point at wherever the cursor lands, matching Pro
Tools' behavior of a bare nav key dropping whatever was selected.

All of it — `B`, `Delete`, `Cut`, and the plain-move family — lands in
whichever section the build auto-detects (see *Coexisting with ReaTooled*
above), same as every other binding in the table.

This intentionally diverges from the tool's original Python-era output: the
migration-era golden fixture froze what the Python generator produced for `B`
and the plain-move keys before this model existed. `tests/parity.test.ts`
no longer compares against that frozen reference for those bindings — the
byte-for-byte TS build fixture (`tests/fixtures/luna-macos.tsbuild.ReaperKeyMap`)
is the regression baseline going forward.

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
