# LUNA keyboard edit-selection model for REAPER

Date: 2026-08-16
Status: design (validated headless against REAPER 7.78); implementation plan to
follow

## Goal

Give the LUNA/Pro Tools keymap a **keyboard-driven edit-selection model** on top
of REAPER, so the user can select a 2D area entirely by keyboard and then run any
clip operation on that area with a keystroke — the way Pro Tools works, and
without reaching for the mouse.

The existing tooling (the TypeScript keymap generator + `mappings/luna.toml`)
already produces the LUNA keymap. This design adds the *edit-selection behavior*
that the individual bindings operate within.

## The model (the one abstraction)

**The edit selection is a single 2D area = (selected tracks) × (time range),
where the time range may be zero-width.** A zero-width range at the edit cursor
*is* "the playhead." There is no separate notion of "selected clip" — item
selection is a *reflection* of the area, materialized only when an operation
runs.

- **Vertical dimension — selected tracks.** A *set* (non-contiguous allowed), i.e.
  REAPER's native track selection.
- **Horizontal dimension — time range.** REAPER's time selection; zero-width =
  the edit cursor.
- **Operations act on the area.** Every clip operation applies to the clips inside
  (selected tracks × time range).
- **A plain cursor move is itself a (degenerate) selection** — the selected track
  set × a zero-width time range at the new cursor — so moving the cursor collapses
  any prior area.

This resolves the three-way tension (selected clip vs. time selection vs. track
selection) that an item-centric approach creates: there is one selection, and it
is the area.

## Why not razor edits, and why not per-operation scripts

Two dead ends were explored and rejected, each for a concrete, tested reason:

- **Razor edits** are REAPER's native 2D primitive and *are* what ReaTooled's
  (mouse-based) Selector Tool builds. But razor-awareness is **not universal**:
  verified on tower that `Toggle Mute` (40175) ignores a razor area entirely
  (item unchanged), because it only acts on *selected items*. Razor also has
  thin keyboard support (`42412` "create area from cursor to mouse" needs the
  mouse), which conflicts with the keyboard-first goal.
- **Per-operation scripts** (e.g. a bespoke `separate.lua`) don't generalize and
  reintroduce special-casing.

The generalization that *does* work across every operation is a single shared
primitive, `selectArea` (below): split at the area boundaries on the selected
tracks and select the enclosed clips. After it runs, the selected clips **are**
the area, so any operation that acts on selected items applies to the area — no
enumeration, no razor dependency. Verified on tower: after `selectArea`, plain
`Toggle Mute` muted exactly the `[3-7]` region on non-contiguous tracks T1 & T3,
leaving T2 untouched.

## Components

### 1. Build the area (keyboard) — already bound

| Gesture | Keys | Action | Status |
|---|---|---|---|
| Extend track selection up/down | `Shift+P` / `Shift+;` | `40288` / `40287` (go to prev/next track, leaving others selected) | already in `luna.toml` |
| Extend time selection by bar | `Shift+[` / `Shift+]` | generated extend scripts | already built |
| Extend time selection by clip edge | `Shift+L` / `Shift+'` | generated extend scripts | already built |

The user's existing muscle memory already builds (selected tracks × time range).

### 2. Collapse on plain move

A plain cursor-move key must collapse the area to the zero-width point at the new
cursor: **move the cursor, clear the time selection, clear the item selection.**

- Clear time selection: `40635` ("Time selection: Remove (unselect) time
  selection").
- Clear item selection: `40289` ("Item: Unselect all items").
- Track selection is **left intact** (the vertical dimension persists).

Every plain move key (`L`/`'`, `[`/`]`, arrows, transient/marker nav — the whole
"Move Selection to X" family) becomes `[<move>, 40635, 40289]`. The `Shift+`
variants keep extending the time selection (the existing extend scripts) and are
unchanged. No native REAPER option auto-clears on move, so wrapping the move keys
is the mechanism.

### 3. `selectArea` — the shared primitive (= Separate / B)

A generated ReaScript that materializes the area as split, selected clips
(REAPER-API level; no reliance on partial razor-awareness):

```
target tracks := selected tracks; if none selected, all tracks
points := (time range > 0) ? {start, end} : {cursor}
for each target track: split its items at each interior point
if time range > 0: select the clips fully within [start, end] on target tracks
```

Validated on tower across the user's scenarios (nothing selected → all tracks;
tracks selected → those tracks only, non-contiguous; cursor inside/outside a
clip; with/without a time range). `B` (Separate) is exactly this primitive.

### 4. Operations — two tiers

- **Universal (no enumeration):** press `B` (`selectArea`), then *any* operation
  key acts on the resulting selection. Covers every clip operation, including
  ReaTooled's own and ones not worth listing.
- **One-keystroke convenience (per common op):** bind a frequent operation
  directly to `[selectArea, <its action>]`, so it runs in a single press
  (Pro-Tools-style). These are distinct bindings with distinct actions:

  | Key | = | Clipboard |
  |---|---|---|
  | Separate | `selectArea` | — |
  | Delete-area | `selectArea` + Remove (`40006`/`40697`) | untouched |
  | Cut-area | `selectArea` + Cut (`40059`/`40699`) | replaced |

  Delete and Cut are **not** merged; they differ exactly in the second action.

## Generator support: the `area` binding kind

Add an `area` kind to the mapping DSL, so the keymap stays declarative:

- `area = <action_id>` → emit the shared `luna_select_area.lua` **once** (deduped,
  stable md5 id), plus a custom action `ACT [_selectArea, <action_id>]`; the key
  binds to that custom action.
- `area` with no action (or `area = true`) → the key binds directly to
  `_selectArea` (this is `Separate`/`B`).

Examples in `luna.toml`:

```toml
[[binding]]
luna = "Separate"
key = "B"
area = true

[[binding]]
luna = "Delete area"
key = "Delete"
area = 40006      # Remove — clipboard untouched

[[binding]]
luna = "Cut area"
key = "Cmd+X"
area = 40059      # Cut — clipboard replaced
```

This replaces the interim `separate` kind / `separate.lua` (the item-scoped
stopgap), which was built on the wrong model.

## Portability: native-only, section auto-detected

- **Native-only, enforced.** Every referenced action id is validated against
  REAPER's own action list, so the keymap cannot reference ReaTooled commands.
  `selectArea` is pure REAPER API. The behavior is therefore ReaTooled-independent
  by construction.
- **Section.** ReaTooled's Main bindings live in `reaper-kb.ini` section `16` and
  take precedence over an imported section-`0` keymap, so overriding them requires
  emitting section `16` (already supported via `--section`). Stock REAPER binds in
  section `0`. **Decision: auto-detect** — `install`/`build` reads the live
  `reaper-kb.ini` (reusing `reatooled.ts`) and picks `16` if ReaTooled-style
  section-16 Main bindings are present, else `0`. Always-`16` is rejected: verified
  that stock REAPER *accepts and preserves* a section-16 binding, but not (without
  a virtual-display keypress test) that a lone section-16 binding *fires* on stock
  — so always-`16` risks dead keys for a no-ReaTooled user.

## Verification approach

REAPER 7.78 on `tower.local` (Linux, stock, no ReaTooled — same version and
identical clip/action semantics as the user's mac) runs batch ReaScripts headless
over SSH. Each piece of this design is validated there before it touches the mac:
build the scenario programmatically (tracks, items, selection, time range, cursor)
→ run the candidate logic → assert the resulting item boundaries and selection.
Local headless REAPER on macOS is not viable (it ignores command-line scripts,
`-cfgfile` doesn't relocate the Scripts dir, and diagnosis needs Screen Recording
permission).

## Open items (resolve during planning/implementation)

- **Non-contiguous track selection by keyboard.** `Shift+P`/`;` extend
  *contiguously*. The user adds a non-contiguous track by Cmd-click (mouse); there
  is no native "toggle *this* track into the selection without moving" that pairs
  with the keyboard flow. Needs a small binding/script (a keyboard "add current
  track to selection" toggle).
- **Exact plain-move family.** Enumerate precisely which keys count as "plain
  moves" that get the collapse wrapper (arrows, `L`/`'`, `[`/`]`, transient/marker
  nav) vs. which don't.
- **Undo grouping** for the wrapped move/area macros (single undo step per press).
- **Delete vs. Cut action choice** (`40006` vs `40697`; `40059` vs `40699`) —
  confirm ripple/focus behavior on tower before committing.
