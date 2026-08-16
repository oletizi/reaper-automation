# LUNA edit-selection on a razor-edit substrate

Date: 2026-08-16
Status: design for review (supersedes the substrate of the
2026-08-16-luna-edit-selection-model design); implementation plan to follow

## Why revisit the substrate

The edit-selection model shipped with the area defined as **(track selection ×
time selection)**, materialized on demand by a `selectArea` script. Two things
have since shown that model is the wrong substrate:

1. **Visual.** REAPER draws the time selection identically on every track, so the
   2D area is indistinguishable from a plain 1D time selection. The only native
   per-track 2D highlight is a **razor edit**, which renders as a distinct
   rectangle on exactly the tracks it covers — verified rendering correctly
   through the (heavily custom) White Tie Imperial theme, where theme-colour
   tinting (`selcol_tr1_bg`) is ignored entirely.
2. **Bookkeeping.** With track- and time-selection as two independent inputs plus
   an independent item selection, item selection goes stale (a clicked clip
   survived an area change and operations hit it — a real regression, since
   patched). Keeping a decorative razor *in addition* to that model would add a
   third thing to sync and would draw both the razor rectangle and the all-tracks
   time-selection bar — more clutter, not less.

Both point the same way: the razor edit should **be** the area — one object that
draws the 2D highlight, that operations act on, and from which transport/loop and
(when needed) item selection are derived. This also matches LUNA's own visual
(the green area in the reference is a razor-style 2D region, not a time
selection).

## The model

**The edit area IS a razor edit** — a set of per-track time spans
(`P_RAZOREDITS`), non-contiguous across tracks by nature. There is no independent
"the area" state and no persistent item selection; item selection is only ever
materialized transiently from the razor for the operations that need it.

- **Vertical dimension** — the tracks the razor covers = the currently selected
  tracks. A script paints the razor's current time span across them.
- **Horizontal dimension** — the razor's time span, grown by the keyboard extend
  gestures (the anchored-extension logic ports over from the current extend
  scripts, reading/writing the span from the razor instead of the time
  selection).
- **Transport/loop** — after any area change, set the loop points from the razor
  (`42474`), park the transport at the razor's earliest edge, and enable repeat —
  the LUNA behaviour we already tuned, now sourced from the razor.
- **Collapse** — a plain cursor move clears the razor (`42406`) and moves the
  cursor; with no razor there is no area (operations fall back to the cursor).

## Verified primitives (tower, REAPER 7.78)

| Primitive | Action / API | Verified result |
|---|---|---|
| Paint a per-track, non-contiguous razor | `GetSetMediaTrackInfo_String(tr,"P_RAZOREDITS",'s e ""',true)` | sets/reads back; renders distinctly (incl. Imperial) |
| Split at the razor | `40061` | splits only razor'd tracks at both edges |
| Delete / Cut the razor area | `40006` / `40699` / `40059` / `40697` | act on the razor area, non-razor'd tracks untouched |
| Materialize items from the razor | `42957` (select media items within razor) | selects exactly the enclosed items (non-contiguous) |
| Non-razor-aware op on the area | `42957` then e.g. `40175` (mute) | muted exactly the razor'd items |
| Loop/transport from the razor | `42474` (set loop points to razor area) | loop points = razor bounds |
| Clear the area | `42406` (clear all razor areas) | clears |

## Components

### 1. The shared paint primitive

A generated script `luna_paint_area(start, end)` writes `P_RAZOREDITS = 's e ""'`
on every selected track and clears it on unselected tracks. All gestures below
call it. (No persistent side-state; the razor itself is the state.)

### 2. Horizontal extend (Shift+[ / ] / L / ')

Port the current anchored-extension logic to the razor: read the current span
from the razor (or start one at the cursor), move the cursor with the bound
move-action, grow the correct edge (forward → end, backward → start), repaint the
razor over the selected tracks, park the transport at the span start, set loop
from the razor, enable repeat. This subsumes today's extend scripts (including the
transport/loop behaviour just added).

### 3. Vertical extend (Shift+P / ; and P / ;)

Change the track selection (native `40287`/`40288`/`40285`/`40286`), then repaint
the razor with the current span over the new selected-track set. So growing the
track selection grows the razor vertically; non-contiguous is native.

### 4. Operations

- **Razor-aware natively** — Cut, Copy(?), Delete, Split/Separate, Glue, and
  peers act on the razor directly when one exists, so these become **plain
  `action` bindings again** (no custom script, no `selectArea`). B/Separate = the
  plain split action.
- **Not razor-aware** (mute, fades, gain, trim, normalize, take ops…) — bind as
  `[42957, <action>]`: select the razor's items, then run the op. One generic
  two-step macro per such binding; no per-op script.

This **removes `selectArea` and the `area = true`/`area = <n>` script machinery**
entirely, replacing them with plain actions + a `42957` prelude where needed.

### 5. Collapse

Plain cursor moves become `[<move>, 42406]` (move, clear razor). No item-selection
clearing is needed any more — there is no persistent item selection to go stale.
This is what makes the just-patched regression *structurally* impossible rather
than defended against.

## Generator changes

- **Retire** the `area` kind + `luna_select_area.lua` (superseded).
- Razor-aware ops → plain `action`.
- Add a small kind for the materialize-then-op case, e.g. `razor = <action_id>`
  → emits the macro `[42957, <action_id>]` (a custom action; no script).
- The extend template is rewritten to drive the razor (paint primitive + anchored
  span logic + transport/loop), and a new small template/kind drives the vertical
  repaint on the track-selection keys.
- Native-only and section auto-detect are unchanged; every referenced action id
  still validates against REAPER's action list.

## Migration from the current model

- `B`/`Cmd+E` (Separate) → plain `action = 40061` (razor-aware).
- Delete → plain `action = 40006`; Cut → plain `action = 40699` (both razor-aware;
  the earlier `area = …` wrappers drop away).
- The extend scripts are replaced by the razor-driving versions.
- `P`/`;`/`Shift+P`/`Shift+;` gain the vertical-repaint step (currently they carry
  `40289`; that becomes the repaint).
- Plain moves: `[move, 40635, 40289]` → `[move, 42406]` (clear the razor instead of
  clearing time+item selection).
- The golden drift fixture is regenerated for the new output.

## Open questions (resolve during planning/implementation, tower-verified)

- **Copy respects the razor?** Cut/Delete/Split are verified; confirm Copy
  (`40057`/`41383`) copies the razor area (and that Paste lands sensibly). If Copy
  is *not* razor-aware, it joins the `razor = <action>` (materialize-first) set.
- **Time selection coexistence.** Decide whether to keep *any* time selection.
  Proposal: don't — drive loop/transport from the razor (`42474`) so the
  all-tracks time-selection bar never draws, keeping the view clean. Verify
  playback/looping feels right with only a razor + loop points.
- **Vertical repaint ergonomics.** Confirm repainting the razor over the selected
  tracks on every `P`/`;` press feels right (and that a track with no razor time
  span yet behaves sensibly).
- **Keyboard non-contiguous track add.** Still needs a "toggle this track into the
  selection without moving" binding (the Cmd-click equivalent) to build a
  non-contiguous razor purely by keyboard — carried over as its own small item.
- **Razor grouping / envelopes.** REAPER has options for whether razor edits cover
  envelopes and grouped tracks; pick sane defaults and document them.
- **Undo grouping** for the paint/transport/loop steps (one undo per press).

## Verification approach

Same as before: each piece is validated headless on REAPER 7.78 via `tower.local`
(paint the razor, assert `P_RAZOREDITS` and resulting item boundaries/selection,
loop points, transport position) before it touches the mac; the 2D *rendering*
itself is confirmed visually by the operator on the Imperial theme (already done
for the probe).
