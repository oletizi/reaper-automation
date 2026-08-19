# Razor-Edit Substrate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-base the LUNA edit-selection model on REAPER **razor edits** — the razor IS the area (draws the 2D highlight, operations act on it, transport/loop and transient item selection derive from it) — replacing the `(track selection × time selection) + selectArea` model.

**Architecture:** Keyboard gestures grow a razor edit (horizontal via the razor-extend scripts; vertical by repainting over the selected tracks). Razor-aware operations (Split/Delete/Cut) become plain native actions; non-razor-aware operations (Copy, Mute, fades, …) become `[42957, <action>]` (select the razor's items, then act). Plain moves clear the razor. All Lua is verified headless on REAPER 7.78 via `tower.local` before it touches the mac.

**Tech Stack:** The existing TS generator (Node + tsx + pnpm + vitest, `@/` alias). Generated Lua ReaScripts. SSH batch-ReaScript verification on `tower.local`.

**Spec:** `docs/superpowers/specs/2026-08-16-razor-area-substrate-design.md` — read it alongside this plan.

## Global Constraints

- No `any`, no `as Type`, no `@ts-ignore`; untrusted TOML validated, never cast. `@/` imports. ESM. Files ≤ ~300–500 lines.
- **Native-only:** every referenced action id validates against REAPER's action list; the keymap never references ReaTooled/`_RS…` commands. Razor scripts are pure REAPER API.
- **Tower verification is mandatory** where a task says so: run the generated artifact through a batch harness on `tower.local` (`ssh -o BatchMode=yes tower.local 'timeout 45 reaper -cfgfile /tmp/x.ini -nosplash -new -newinst /tmp/harness.lua …'`), asserting `P_RAZOREDITS`, item boundaries/selection, loop points, and cursor. Do NOT rely on reasoning alone for Lua behavior.
- **Verified primitives** (do not re-litigate): `P_RAZOREDITS` set/read per track (non-contiguous); `40061` split / `40006` remove / `40699` cut act on the razor; `42957` selects the razor's items; `42474` sets loop points from the razor; `42406` clears razor. Copy (`40057`) is **not** razor-aware → materialize via `[42957, 40057]`.
- Every implementer runs `pnpm typecheck` + full `pnpm test` before committing. No Claude/AI attribution in commits.
- Branch: `feat/razor-area-substrate` (already created).

## Razor span encoding

`P_RAZOREDITS` is a space-separated string of `start end "GUID"` triples; for a media-item-lane area the GUID is `""`. A single area on a track = `'S.dddddddddd E.dddddddddd ""'`. To read a track's current area, parse the first two numbers. "Selected tracks" = `CountSelectedTracks`/`GetSelectedTrack`.

---

## File Structure

```
src/razor-extend-template.ts   # renderRazorExtendScript(move) -> horizontal-grow Lua (per move action)
src/razor-repaint-template.ts  # renderRazorRepaintScript() -> repaint current span over selected tracks (shared, once)
src/mapping.ts                 # + razor_extend / razor_track / razor kinds; retire `area`
src/build-keymap.ts            # + the three razor branches; retire the `area` branch
mappings/luna.toml             # rewired to the razor model
tests/*                        # updated + new
```

Deleted: `src/select-area-template.ts` and the `area` kind (superseded).

---

## Task 1: razor-repaint template (the shared paint primitive)

**Files:** Create `src/razor-repaint-template.ts`, `tests/razor-repaint-template.test.ts`

**Interfaces:** `renderRazorRepaintScript(opts: { label: string; spec: string }): string`

The script: read the current razor span (scan ALL tracks; take the first area's start/end); if a span exists, write `P_RAZOREDITS = 'start end ""'` on every **selected** track and clear it (`''`) on unselected tracks; then set transport to the span start, `42474` (loop points from razor), enable repeat. If no span exists anywhere, do nothing. Wrap in an undo block.

- [ ] **Step 1: Write the failing test** — assert the Lua contains the load-bearing calls:

```ts
import { describe, it, expect } from 'vitest'
import { renderRazorRepaintScript } from '@/razor-repaint-template'
describe('renderRazorRepaintScript', () => {
  const lua = renderRazorRepaintScript({ label: 'LUNA: Repaint Area', spec: 'luna.toml' })
  it('reads and writes P_RAZOREDITS and scopes to selected tracks', () => {
    expect(lua).toContain('P_RAZOREDITS')
    expect(lua).toContain('CountSelectedTracks')
    expect(lua).toContain('GetSelectedTrack')
  })
  it('drives transport/loop from the razor', () => {
    expect(lua).toContain('40004') // no — placeholder; replace with the real assertions below
  })
})
```

Replace the second `it` with real assertions: `expect(lua).toContain('42474')` (loop from razor), `expect(lua).toContain('SetEditCurPos')`, `expect(lua).toContain('GetSetRepeat(1)')`, `expect(lua).toContain('Undo_BeginBlock')`.

- [ ] **Step 2: Run to verify failure.** `pnpm test razor-repaint` → FAIL (module missing).

- [ ] **Step 3: Implement** `src/razor-repaint-template.ts`:

```ts
export function renderRazorRepaintScript(opts: { label: string; spec: string }): string {
  const { label, spec } = opts
  return `-- ${label}
-- Generated by reaper-automation from ${spec}. Do not hand-edit.
--
-- Repaint the razor edit (the edit area) over the currently selected tracks,
-- keeping the current time span, then drive transport/loop from it. Used when
-- the vertical (track) dimension of the area changes.

local EPS = 1e-6

local function readSpan()
  for i = 0, reaper.CountTracks(0) - 1 do
    local ok, s = reaper.GetSetMediaTrackInfo_String(reaper.GetTrack(0, i), "P_RAZOREDITS", "", false)
    if ok and s ~= "" then
      local a, b = s:match("([%d%.%-]+)%s+([%d%.%-]+)")
      if a and b then return tonumber(a), tonumber(b) end
    end
  end
  return nil
end

local function repaint()
  local a, b = readSpan()
  if not a or b - a <= EPS then return end
  local sel = {}
  for i = 0, reaper.CountSelectedTracks(0) - 1 do sel[reaper.GetSelectedTrack(0, i)] = true end
  local area = string.format('%.10f %.10f ""', a, b)
  for i = 0, reaper.CountTracks(0) - 1 do
    local tr = reaper.GetTrack(0, i)
    reaper.GetSetMediaTrackInfo_String(tr, "P_RAZOREDITS", sel[tr] and area or "", true)
  end
  reaper.SetEditCurPos(a, false, false)
  reaper.Main_OnCommand(42474, 0)  -- set loop points to razor edit area
  reaper.GetSetRepeat(1)
end

reaper.Undo_BeginBlock()
reaper.PreventUIRefresh(1)
repaint()
reaper.PreventUIRefresh(-1)
reaper.UpdateArrange()
reaper.Undo_EndBlock("${label}", -1)
`
}
```

- [ ] **Step 4: Run to verify pass** + `pnpm typecheck`.

- [ ] **Step 5: Tower-verify the generated Lua.** Extract nothing yet (no build wiring). Instead write the Lua to a temp file via a throwaway `tsx -e` that calls `renderRazorRepaintScript`, `scp` to tower, and run a harness: 3 tracks with items; set a razor `[3,7]` on T1 only; select T1 & T3; `dofile` the script; assert P_RAZOREDITS is `[3,7]` on **T1 & T3**, empty on T2, loop points `[3,7]`, cursor `3`. Paste the tower output into the report.

- [ ] **Step 6: Commit.** `git add src/razor-repaint-template.ts tests/razor-repaint-template.test.ts && git commit -m "Add razor-repaint script template (repaint area over selected tracks)"`

---

## Task 2: razor-extend template (horizontal growth)

**Files:** Create `src/razor-extend-template.ts`, `tests/razor-extend-template.test.ts`

**Interfaces:** `renderRazorExtendScript(opts: { label: string; spec: string; move: number; moveName: string }): string`

Port the anchored-extension logic to the razor: read the current span from the razor (scan tracks); if none, start at the cursor. Probe the move's direction; grow the END on forward, the START on backward (same as the current time-selection extend, verified). Paint the new span over the selected tracks (clear unselected). Transport to the span start, `42474`, repeat on. Undo block.

- [ ] **Step 1: Write the failing test** — assert the Lua contains: `P_RAZOREDITS`, `local MOVE = <move>`, direction probe (`GetCursorPosition`), `42474`, `SetEditCurPos`, `GetSetRepeat(1)`, `CountSelectedTracks`.

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** `src/razor-extend-template.ts` (mirrors the current extend logic but reads/writes the razor span instead of the time selection; reuse the readSpan + paint helpers from Task 1's shape). The forward/backward edge-growth and the transport-at-start + loop + repeat are identical in spirit to `src/extend-template.ts` at HEAD — carry that behavior over, sourcing/sinking the span from `P_RAZOREDITS`.

- [ ] **Step 4: Run to verify pass** + `pnpm typecheck`.

- [ ] **Step 5: Tower-verify** the generated forward (`41042`/next-bar) and backward (`41043`/prev-bar) scripts: empty start, cursor at 4; forward ×3 → razor span `[4,6]→[4,8]→[4,10]` on the selected track(s), cursor held at 4, loop `[4,10]`, repeat ON; backward from 10 grows the start. Paste tower output.

- [ ] **Step 6: Commit.**

---

## Task 3: generator kinds (`razor_extend`, `razor_track`, `razor`); retire `area`

**Files:** Modify `src/mapping.ts`, `src/build-keymap.ts`; update `tests/mapping.test.ts`, `tests/build-keymap.test.ts`; delete `src/select-area-template.ts`.

**Interfaces:**
- `mapping.ts` `BindingKind` gains `{ razorExtend: number } | { razorTrack: number } | { razor: number }`; remove `{ area: number } | { area: true }`. Validate: `razor_extend = <int>`, `razor_track = <int>`, `razor = <int>`; each mutually exclusive with the other kinds.
- `build-keymap.ts`:
  - `razor_extend = <move>` → one SCR per move (razor-extend template, deduped by move) + KEY → `_id`. (Mirror the old `extend` branch, using `renderRazorExtendScript`.)
  - `razor_track = <trackAction>` → ACT `[<trackAction>, _<repaintId>]`, where the razor-repaint SCR is emitted **once** (deduped, like the old shared select-area script) + KEY → the ACT.
  - `razor = <action>` → validate the action id; ACT `[42957, <action>]` + KEY → the ACT.
  - Remove the `area` branch and the `select-area-template` import.

- [ ] **Step 1: Write failing mapping tests** for the three kinds (accept int; reject combined with another kind; `area` no longer accepted).
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement mapping.ts** (add the three kinds; drop `area`).
- [ ] **Step 4: Write failing build-keymap tests:** `razor_extend` emits one SCR per move; `razor_track` emits the shared repaint SCR exactly once + an ACT `[track, _repaint]`; `razor=<n>` emits ACT `[42957, n]`. Use a small inline mapping.
- [ ] **Step 5: Run → FAIL.**
- [ ] **Step 6: Implement the three branches in build-keymap.ts** (reuse the extend-dedup pattern for `razor_extend`, the shared-script-once pattern for the repaint script, and the macro-ACT pattern for `razor`). Delete the `area` branch + `select-area-template` import; `rm src/select-area-template.ts` and its test.
- [ ] **Step 7: Run → PASS** + `pnpm typecheck`.
- [ ] **Step 8: Commit.**

---

## Task 4: Rewire `mappings/luna.toml` to the razor model; tower-verify

**Files:** Modify `mappings/luna.toml`. Tower verification.

- [ ] **Step 1: Classify every item-operating binding on tower.** Build a harness that, for each candidate action currently in `luna.toml` that acts on items/selection (Separate 40061, Delete 40006, Cut 40699, Copy 40057, Mute 40175, Fade-in 40509, Fade-out 40510, Trim-start 41305, Trim-end 41311, Duplicate 41295, Consolidate/Glue, Normalize, etc.), sets a non-contiguous razor `[3,7]` on T1 & T3 with nothing selected, runs the action, and reports whether it affected **only the razor'd region on T1 & T3** (→ razor-aware → plain `action`) or did nothing/affected the wrong scope (→ needs `[42957, action]` → `razor = <id>`). Write the classification table into the task report.

- [ ] **Step 2: Rewire bindings per the classification:**
  - **Razor-aware → plain `action`:** Separate (`B`, `Cmd+E`) → `action = 40061`; Delete → `action = 40006`; Cut (`Cmd+X`, `X`) → `action = 40699`; any others the probe marks razor-aware.
  - **Materialize → `razor = <id>`:** Copy (`Cmd+C`, `C`) → `razor = 40057`; Mute/fades/trim/normalize/etc. per the probe → `razor = <id>`.
  - **Horizontal extend → `razor_extend = <move>`:** the `Shift+[ ] L '`, transient, marker, session-start/end bindings switch from `extend = <move>` to `razor_extend = <move>`.
  - **Vertical → `razor_track = <trackAction>`:** `Shift+P`/`Shift+;` (`40288`/`40287`) and `P`/`;` (`40286`/`40285`) → `razor_track = <that action>`.
  - **Plain-move collapse → clear the razor:** the plain `[ ] L '`, transient, marker, Return moves change from `macro = [<move>, 40635, 40289]` to `macro = [<move>, 42406]` (move, clear all razor areas).
  - Remove every `area = …` binding (superseded).

- [ ] **Step 3: Build (auto-section) and confirm it succeeds** with no validation errors; note the stats.

- [ ] **Step 4: Tower-verify the end-to-end flows** with the generated scripts: (a) `Shift+]` builds the razor, transport at start, loop set; (b) `Shift+P` repaints over an added track (non-contiguous); (c) a plain `]` clears the razor; (d) `B` separates the razor region on selected tracks only; (e) Delete/Cut act on the razor region; (f) `razor=`Mute mutes only the razor region. Paste outputs.

- [ ] **Step 5: Commit.**

---

## Task 5: Golden fixtures, green suite, install, README, manual verification

**Files:** `tests/parity.test.ts` fixture; `README.md`; build artifacts.

- [ ] **Step 1: Regenerate the byte-drift fixture** (`tests/fixtures/luna-macos.tsbuild.ReaperKeyMap`) from the new section-0 build; the razor model intentionally changes many bindings. Keep the non-vacuousness tripwire.
- [ ] **Step 2: Full suite green** — `pnpm typecheck && pnpm test` → 0 failures.
- [ ] **Step 3: Build with auto-section + install** on the mac (`pnpm ra build … -o build/luna.ReaperKeyMap` → `section: 16`; `pnpm ra install …`). Confirm the razor scripts install.
- [ ] **Step 4: README** — document the razor model (razor = the area; horizontal/vertical keyboard growth; razor-aware vs materialized ops; plain-move clears; 2D highlight is the razor rendering). No "production-ready".
- [ ] **Step 5: Operator manual verification (reserved for the controller/user, not the implementer):** re-import `LUNA (Pro Tools)`; confirm the 2D highlight shows on selected tracks, extend/track/collapse work, and Separate/Delete/Cut/Copy/Mute act on the area.
- [ ] **Step 6: Commit.**

---

## Deferred (follow-up, out of this plan's scope)

- **Background cursor-monitor** (the "hooks" idea): a `defer` script that clears the razor whenever the edit cursor moves by any means (mouse, arrows, external), with an ExtState coordination flag so the razor-extend scripts' own cursor moves don't self-trigger. Its own design + build.
- **Keyboard non-contiguous track add** (the Cmd-click equivalent): a "toggle this track into the selection" binding.
- **Razor grouping / envelope options**: pick and document defaults.

---

## Self-Review

**Spec coverage:** razor = area (Tasks 1–4); horizontal extend (Task 2/4); vertical repaint (Task 1/3/4); razor-aware vs materialized ops (Task 4 classification); plain-move clears razor (Task 4); transport/loop from razor (Tasks 1–2); retire area/selectArea (Task 3); fixtures/README/install (Task 5). Cursor-monitor + non-contiguous-keyboard-add explicitly deferred.

**Placeholder scan:** the razor-repaint Lua is given in full; the razor-extend Lua is specified by reference to the verified current extend logic + the razor primitives (the implementer ports it and tower-verifies — the behavior is pinned by the tower assertions in Task 2 Step 5, not left vague). The op classification is resolved on tower in Task 4 Step 1 rather than guessed. Task 1 Step 1 flags the placeholder `it` to replace — fix it when writing.

**Type consistency:** `renderRazorRepaintScript` / `renderRazorExtendScript` (templates) ↔ the `razorExtend`/`razorTrack`/`razor` kinds (mapping ↔ build-keymap) ↔ the `razor_extend`/`razor_track`/`razor` TOML keys.
