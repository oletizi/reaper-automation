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
tools/build_keymap.py               TOML -> .ReaperKeyMap, with validation
tools/find_action.py                search REAPER's action list
tools/keyspec.py                    "Ctrl+Shift+Left" -> (flags, keycode)
tools/dump_actions.lua              ReaScript that dumps REAPER's action list
data/reaper-actions-7.78-linux.tsv  10,578 actions dumped from REAPER 7.78
data/luna-shortcuts-macos-raw.tsv   LUNA's published macOS defaults
```

## Build

```sh
python3 tools/build_keymap.py mappings/luna-linux.toml -o build/luna-linux.ReaperKeyMap
```

Nothing to install — Python 3.11+ stdlib only. The build fails rather than
emitting a dead key if a command ID doesn't exist or two bindings collide on the
same combo.

## Install into REAPER

Actions → Show action list → **Key map** (bottom right) → Import…, and pick
`build/luna-linux.ReaperKeyMap`.

Importing only overrides the combos the file names; REAPER's other defaults stay
put. To get back to stock, use Key map → Reset to factory defaults.

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

Seven LUNA shortcuts are deliberately left unmapped rather than approximated;
each carries a `status = "unmapped"` and a comment explaining why. The
substantive ones:

- **Create Marker.** LUNA puts it on numpad Enter and Return To Zero on Return.
  REAPER on Linux appears to report both as `VK_RETURN`, so binding it would
  steal RTZ. Wants a real keyboard test.
- **The "Shift" edit family** (Shift Cut / Paste / Duplicate / Insert). This is
  ripple editing. REAPER models ripple as a persistent mode rather than as
  per-operation variants, so it needs a design decision, not a binding.
- **Extend Selection to next/previous bar / clip edge / marker.** REAPER has no
  extend-time-selection-to-X family beyond transients (40802). Buildable as
  custom actions from a move + set-end pair.
- **Create Bus.** REAPER buses are just folder tracks.

Two bindings are macros rather than native actions — Increase/Decrease All Track
Heights select all tracks first, which is a visible side effect.
