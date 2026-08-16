# reaper-automation

Making REAPER's keyboard shortcuts conform to Universal Audio's LUNA — which in
turn inherits most of its key layout from Pro Tools.

The mapping lives in a plain TOML table. A generator turns it into a
`.ReaperKeyMap` file, validating every command ID against an action list dumped
out of REAPER itself. Edit the table, rebuild, re-import, iterate.

## Layout

```
mappings/luna-linux.toml            the mapping table — this is the thing you edit
build/luna-linux.ReaperKeyMap       generated; import this into REAPER
build/Scripts/luna/*.lua            generated ReaScripts the keymap references
tools/build_keymap.py               TOML -> .ReaperKeyMap + ReaScripts, validated
tools/install.py                    copy keymap + scripts into REAPER's config
tools/find_action.py                search REAPER's action list
tools/keyspec.py                    "Ctrl+Shift+Left" -> (flags, keycode)
tools/dump_actions.lua              ReaScript that dumps REAPER's action list
data/reaper-actions-7.78.tsv        10,578 actions dumped from REAPER 7.78
data/luna-shortcuts-macos-raw.tsv   LUNA's published macOS defaults
```

A binding in the table is one of three kinds:

| key in TOML | becomes |
| --- | --- |
| `action = 40044` | a plain `KEY` line pointing at a native REAPER action |
| `macro = [40296, 41325]` | an `ACT` custom action running those steps in order |
| `extend = 41042` | a generated ReaScript (`SCR`) — see Extend Selection below |

## Build

```sh
python3 tools/build_keymap.py mappings/luna-linux.toml -o build/luna-linux.ReaperKeyMap
```

Nothing to install — Python 3.11+ stdlib only. The build fails rather than
emitting a dead key if a command ID doesn't exist or two bindings collide on the
same combo.

## Install into REAPER

```sh
python3 tools/install.py
```

That copies the keymap into `~/.config/REAPER/KeyMaps/` and the generated
ReaScripts into `~/.config/REAPER/Scripts/luna/`. Then, in REAPER: Actions →
Show action list → **Key map** (bottom right) → Import…, and pick
**LUNA (Pro Tools)**.

Order matters — the scripts have to be on disk *before* the import, or the `SCR`
entries resolve to nothing and those keys land on dead actions.

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

## Looking up actions

```sh
python3 tools/find_action.py zoom horizontal      # AND across terms, case-insensitive
python3 tools/find_action.py --id 40509
python3 tools/find_action.py --section midi_editor "note:"
```

## Re-dumping the action list

The dump is version-specific. To regenerate it for another REAPER build, point
REAPER at a throwaway resource directory so your real config is untouched:

```sh
REAPER_DUMP_OUT=/tmp/reaper-actions.tsv \
  reaper -cfgfile /tmp/probe/reaper.ini -nosplash -new -newinst tools/dump_actions.lua
```

The script enumerates every section via `kbd_enumerateActions` and quits REAPER
when it's done.

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

LUNA is macOS-only, so its published defaults are Mac-flavoured. For a Linux
target:

| LUNA (macOS) | here |
| --- | --- |
| Cmd | Ctrl |
| Opt | Alt |
| Control | Super |

Mapping Mac Control onto Super follows Pro Tools' own Windows convention. Watch
out: GNOME grabs a lot of Super combos before REAPER ever sees them. If the
Super bindings turn out to be unusable, change them in the TOML and rebuild —
that's the one-line-per-binding case the generator exists for.

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
