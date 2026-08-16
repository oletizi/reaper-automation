# LUNA Edit-Selection Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the keyboard-driven edit-selection model to the LUNA keymap — one 2D area (selected tracks × time range), a shared `selectArea` primitive that materializes it, plain-move collapse, and distinct one-key area operations — via a declarative `area` binding kind in the generator.

**Architecture:** A new `area` mapping kind emits a shared generated ReaScript (`luna_select_area.lua`, the tower-validated `selectArea`) once, plus a custom action `[_selectArea, <action>]` per binding (`area` alone = Separate/B). Plain-move keys become macros `[<move>, clear-time-selection, clear-item-selection]` so a move collapses the area. `install`/`build` auto-detect the reaper-kb.ini section (16 for ReaTooled, else 0). Every piece is verified headless on REAPER 7.78 via `tower.local` before it touches the mac.

**Tech Stack:** The existing TS generator (Node + tsx + pnpm + vitest, `@/` alias). Generated Lua ReaScripts. SSH batch-ReaScript verification on `tower.local`.

**Spec:** `docs/superpowers/specs/2026-08-16-luna-edit-selection-model-design.md` — read it alongside this plan.

## Global Constraints

- No `any`, no `as Type`, no `@ts-ignore`; untrusted TOML validated, never cast. `@/` imports. ESM. Files ≤ ~300–500 lines. (Same as the base project.)
- **Native-only:** every referenced action id must validate against REAPER's action list; the keymap never references ReaTooled/`_RS…` commands. `selectArea` is pure REAPER API.
- **The `selectArea` Lua is fixed and tower-validated** — reproduce it verbatim (Task 2). Do not re-derive its behavior.
- No Claude/AI attribution in commit messages.
- **Every implementer runs `pnpm typecheck` + full `pnpm test`** before committing.
- **Tower verification** (`ssh tower.local`, REAPER 7.78 headless): where a task says "verify on tower," run the generated artifact through the batch harness and assert item boundaries/selection — do not rely on reasoning alone.
- Branch: a NEW branch off the current `feat/typescript-migration` HEAD (do NOT keep piling onto PR #1). Name it `feat/edit-selection`.

---

## File Structure

```
src/select-area-template.ts   # renderSelectAreaScript() -> the validated selectArea Lua
src/mapping.ts                # replace the interim `separate` kind with `area = <int> | true`
src/build-keymap.ts           # replace the `separate` branch with the `area` branch
src/reatooled.ts              # + detectReaTooledSection(kbText): 0 | 16
src/cli/{build,install}.ts    # auto-detect section when --section not given
src/cli/args.ts               # (unchanged unless needed)
mappings/luna.toml            # Separate/Delete-area/Cut-area as `area`; plain-move keys -> collapse macros
tests/*                       # updated + new
```

Deleted: `src/separate-template.ts` and the `separate` kind (interim, wrong-model — superseded by `area`).

---

## Task 1: Branch + retire the interim `separate` kind

**Files:** working tree (uncommitted `separate` experiment), new branch.

- [ ] **Step 1: Create the feature branch from current HEAD**

```bash
git checkout -b feat/edit-selection
```

- [ ] **Step 2: Revert the uncommitted interim `separate`-kind experiment to a clean base**

```bash
git checkout -- src/build-keymap.ts src/mapping.ts mappings/luna.toml
rm -f src/separate-template.ts
```

- [ ] **Step 3: Confirm a clean, green base**

Run: `pnpm typecheck && pnpm test`
Expected: clean; all tests pass (the `separate` kind is gone; the tree matches the last commit).

- [ ] **Step 4: Commit the branch point (no-op tree change; marker commit optional)** — skip if the tree is unchanged from HEAD; otherwise:

```bash
git status  # expect clean
```

---

## Task 2: `select-area-template.ts` — the shared primitive (tower-validated verbatim)

**Files:**
- Create: `src/select-area-template.ts`
- Test: `tests/select-area-template.test.ts`

**Interfaces:**
- Produces: `renderSelectAreaScript(opts: { label: string; spec: string }): string`

- [ ] **Step 1: Write the failing test** — `tests/select-area-template.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { renderSelectAreaScript } from '@/select-area-template'

describe('renderSelectAreaScript', () => {
  const lua = renderSelectAreaScript({ label: 'LUNA: Select Area', spec: 'luna.toml' })
  it('scopes to selected tracks (falls back to all when none) and reads the time range', () => {
    expect(lua).toContain('CountSelectedTracks')
    expect(lua).toContain('GetSelectedTrack')
    expect(lua).toContain('GetSet_LoopTimeRange(false, false')
  })
  it('splits at interior points and selects the enclosed clips', () => {
    expect(lua).toContain('SplitMediaItem')
    expect(lua).toContain('SelectAllMediaItems(0, false)')
    expect(lua).toContain('SetMediaItemSelected')
  })
  it('is wrapped in an undo block and names the label', () => {
    expect(lua).toContain('Undo_BeginBlock')
    expect(lua).toContain('Undo_EndBlock("LUNA: Select Area"')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test select-area-template`
Expected: FAIL (`@/select-area-template` not found).

- [ ] **Step 3: Implement** — `src/select-area-template.ts` (the exact logic validated on tower)

```ts
export function renderSelectAreaScript(opts: { label: string; spec: string }): string {
  const { label, spec } = opts
  return `-- ${label}
-- Generated by reaper-automation from ${spec}. Do not hand-edit.
--
-- Materialize the edit area (selected tracks x time range) as split, selected
-- clips, so any operation that acts on selected items applies to the area.
-- Selected tracks are the vertical scope (non-contiguous allowed); the time
-- range is the horizontal scope (zero-width = the edit cursor). This is
-- Separate (B): after it runs, the selected clips ARE the area.

local EPS = 1e-6

local function selectArea()
  local ts_start, ts_end = reaper.GetSet_LoopTimeRange(false, false, 0, 0, false)
  local cursor = reaper.GetCursorPosition()
  local has_ts = ts_end - ts_start > EPS

  local tracks = {}
  local nt = reaper.CountSelectedTracks(0)
  if nt > 0 then
    for i = 0, nt - 1 do tracks[reaper.GetSelectedTrack(0, i)] = true end
  else
    for i = 0, reaper.CountTracks(0) - 1 do tracks[reaper.GetTrack(0, i)] = true end
  end

  local points = has_ts and { ts_start, ts_end } or { cursor }
  table.sort(points)

  for tr in pairs(tracks) do
    for _, p in ipairs(points) do
      local n = reaper.CountTrackMediaItems(tr)
      for i = 0, n - 1 do
        local it = reaper.GetTrackMediaItem(tr, i)
        local pos = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
        local len = reaper.GetMediaItemInfo_Value(it, "D_LENGTH")
        if p > pos + EPS and p < pos + len - EPS then
          reaper.SplitMediaItem(it, p)
          break
        end
      end
    end
  end

  if has_ts then
    reaper.SelectAllMediaItems(0, false)
    for tr in pairs(tracks) do
      local n = reaper.CountTrackMediaItems(tr)
      for i = 0, n - 1 do
        local it = reaper.GetTrackMediaItem(tr, i)
        local pos = reaper.GetMediaItemInfo_Value(it, "D_POSITION")
        local len = reaper.GetMediaItemInfo_Value(it, "D_LENGTH")
        if pos >= ts_start - EPS and pos + len <= ts_end + EPS then
          reaper.SetMediaItemSelected(it, true)
        end
      end
    end
  end
end

reaper.Undo_BeginBlock()
reaper.PreventUIRefresh(1)
selectArea()
reaper.PreventUIRefresh(-1)
reaper.UpdateArrange()
reaper.Undo_EndBlock("${label}", -1)
`
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm test select-area-template && pnpm typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/select-area-template.ts tests/select-area-template.test.ts
git commit -m "Add select-area script template (the shared edit-area primitive)"
```

---

## Task 3: `area` binding kind in the generator

**Files:**
- Modify: `src/mapping.ts` (add `{ area: number } | { area: true }` to `BindingKind`; validate)
- Modify: `src/build-keymap.ts` (emit the shared script once + a custom action per binding; `area:true` binds directly to the script)
- Test: `tests/mapping.test.ts`, `tests/build-keymap.test.ts`

**Interfaces:**
- Consumes: `renderSelectAreaScript` (`@/select-area-template`), `stableId`/`slugify` (`@/ids`).
- Produces: builds emit `SCR` for `luna/luna_select_area.lua` once; `area = <n>` → `ACT [_selectArea, n]` + KEY → that ACT; `area = true` → KEY → `_selectArea`.

- [ ] **Step 1: Write failing mapping tests** — append to `tests/mapping.test.ts`

```ts
import { parseMapping } from '@/mapping'
describe('area kind', () => {
  it('accepts area = <int> and area = true', () => {
    const m = parseMapping('[meta]\nname="x"\n[[binding]]\nluna="Sep"\nkey="B"\narea=true\n[[binding]]\nluna="Del"\nkey="Delete"\narea=40006\n')
    expect(m.bindings[0].kind).toEqual({ area: true })
    expect(m.bindings[1].kind).toEqual({ area: 40006 })
  })
  it('rejects area with another kind key', () => {
    expect(() => parseMapping('[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="B"\narea=true\naction=1\n')).toThrow()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm test mapping`
Expected: FAIL (area not recognized).

- [ ] **Step 3: Implement in `src/mapping.ts`**

Add to `BindingKind`: `| { area: number } | { area: true }`. In `validateBinding`, before the `kinds.length` check:

```ts
if ('area' in raw) {
  if (raw.area === true) kinds.push({ area: true })
  else kinds.push({ area: asInt(raw.area, `${where}.area`) })
}
```

Update the "exactly one of" error message to include `area`.

- [ ] **Step 4: Write failing build-keymap tests** — append to `tests/build-keymap.test.ts`

```ts
describe('area kind emission', () => {
  const m = parseMapping('[meta]\nname="x"\n[[binding]]\nluna="Sep"\nkey="B"\narea=true\n[[binding]]\nluna="Del"\nkey="Delete"\narea=40006\n')
  const r = buildKeymap(m, idx, 'macos')
  it('emits the shared select-area SCR exactly once', () => {
    const scr = r.keymapText.split('\n').filter((l) => l.startsWith('SCR ') && l.includes('luna_select_area.lua'))
    expect(scr).toHaveLength(1)
    expect(r.scripts.has('luna_select_area.lua')).toBe(true)
  })
  it('area=true binds the key directly to the script', () => {
    // B (keycode 66) -> _<selectArea id>
    expect(r.keymapText).toMatch(/^KEY 1 66 _[0-9a-f]{32} 0/m)
  })
  it('area=<n> emits an ACT [_selectArea, n] and binds the key to it', () => {
    expect(r.keymapText).toMatch(/^ACT 0 0 "[0-9a-f]{32}" "Custom: LUNA: Del" _[0-9a-f]{32} 40006$/m)
  })
})
```

- [ ] **Step 5: Run — expect FAIL**

Run: `pnpm test build-keymap`
Expected: FAIL.

- [ ] **Step 6: Implement the `area` branch in `src/build-keymap.ts`** (mirrors the extend/separate pattern; one shared script, deduped)

Add near the other `seen*` state: `let selectAreaEntry: { fname: string; sid: string } | undefined`. Add a helper that lazily emits the shared script and returns its `_id`:

```ts
function ensureSelectArea(): string {
  if (!selectAreaEntry) {
    const label = 'LUNA: Select Area'
    const fname = 'luna_select_area.lua'
    const sid = stableId(label)
    scripts.set(fname, renderSelectAreaScript({ label, spec: mapping.meta.name }))
    scrLines.push(`SCR 4 ${section} "${sid}" "Custom: ${label}" ${SCRIPT_DIR}/${fname}`)
    selectAreaEntry = { fname, sid }
  }
  return selectAreaEntry.sid
}
```

Add the dispatch branch (before `macro`):

```ts
} else if (b.kind && 'area' in b.kind) {
  const areaSid = ensureSelectArea()
  if (b.kind.area === true) {
    command = '_' + areaSid
    desc = `script luna_select_area.lua  [materialize edit area]`
  } else {
    const opId = String(b.kind.area)
    const opName = actions.byId(opId)
    if (opName === undefined) { errors.push(`${luna}: area references unknown action ${opId}`); continue }
    const label = b.label ?? `LUNA: ${luna}`
    let mid = seenMacros.get(label)
    if (mid === undefined) {
      mid = stableId(label)
      seenMacros.set(label, mid)
      actLines.push(`ACT 0 ${section} "${mid}" "Custom: ${label}" _${areaSid} ${opId}`)
    }
    command = '_' + mid
    desc = `${label}  [select area > ${opName}]`
  }
  stats.script++
```

(Import `renderSelectAreaScript` from `@/select-area-template`.)

- [ ] **Step 7: Run — expect PASS**

Run: `pnpm test build-keymap mapping && pnpm typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add src/mapping.ts src/build-keymap.ts tests/mapping.test.ts tests/build-keymap.test.ts
git commit -m "Add the area binding kind (shared select-area script + per-op custom action)"
```

---

## Task 4: Wire `area` bindings + plain-move collapse in `luna.toml`; verify on tower

**Files:**
- Modify: `mappings/luna.toml`
- Test: manual build + tower verification

- [ ] **Step 1: Point B (Separate) at the area primitive**

Replace the current `B` binding with:

```toml
[[binding]]
luna = "Separate"
key = "B"
area = true
```

- [ ] **Step 2: Add one-key Delete-area and Cut-area** (distinct actions)

Find the current Delete and Cut bindings (or add them). Set:

```toml
# Delete the area (clipboard untouched)
area = 40006
# Cut the area (clipboard replaced)
area = 40059
```

on the appropriate keys, keeping their existing `luna`/`key` fields.

- [ ] **Step 3: Convert plain cursor-move keys to collapse macros**

For each plain-move binding (`L`/`'` clip-edge, `[`/`]` bar, transient/marker nav — the `action = <move>` "Move Selection to X" family, NOT the `Shift+` extend variants), change `action = <move>` to:

```toml
macro = [<move>, 40635, 40289]   # move, clear time selection, clear item selection
```

Do **not** touch the `Shift+` extend bindings.

- [ ] **Step 4: Build (auto-section comes in Task 5; use --section 16 here) and verify the generated select-area script on tower**

```bash
pnpm ra build mappings/luna.toml -o /tmp/luna.ReaperKeyMap --section 16
scp -q /tmp/Scripts/luna/luna_select_area.lua tower.local:/tmp/ra_select_area.lua
```

Then run the committed tower harness (`scratchpad/area_abstraction.lua` pattern, pointing `dofile` at `/tmp/ra_select_area.lua`) and assert, for tracks T1 & T3 selected + time `[3,7]`:
`T1: [0-3] [3-7]* [7-10] | T2: [0-10] | T3: [0-3] [3-7]* [7-10]`, and that a following plain `Toggle Mute` mutes only the `[3-7]` pieces on T1 & T3.

Expected: matches. If not, the generated script diverged from the template — fix `select-area-template.ts`.

- [ ] **Step 5: Commit**

```bash
git add mappings/luna.toml
git commit -m "Wire area bindings (Separate/Delete/Cut) and plain-move collapse in luna.toml"
```

---

## Task 5: Auto-detect the reaper-kb.ini section

**Files:**
- Modify: `src/reatooled.ts` (add `detectReaTooledSection`)
- Modify: `src/cli/build.ts`, `src/cli/install.ts` (use it when `--section` not given)
- Test: `tests/reatooled.test.ts`

**Interfaces:**
- Produces: `detectReaTooledSection(kbText: string): 0 | 16` — returns `16` if the kb has Main bindings in section 16 (ReaTooled), else `0`.

- [ ] **Step 1: Write failing test** — append to `tests/reatooled.test.ts`

```ts
import { detectReaTooledSection } from '@/reatooled'
describe('detectReaTooledSection', () => {
  it('returns 16 when section-16 Main bindings are present', () => {
    expect(detectReaTooledSection('KEY 1 76 41167 16\nKEY 1 65 40044 0\n')).toBe(16)
  })
  it('returns 0 for a stock kb (only section 0)', () => {
    expect(detectReaTooledSection('KEY 1 65 40044 0\nKEY 1 66 40045 0\n')).toBe(0)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm test reatooled`
Expected: FAIL.

- [ ] **Step 3: Implement `detectReaTooledSection` in `src/reatooled.ts`**

```ts
export function detectReaTooledSection(kbText: string): 0 | 16 {
  for (const r of parseKb(kbText)) {
    if (r.section === 16) return 16
  }
  return 0
}
```

- [ ] **Step 4: Use it in the CLI when `--section` is absent**

In `src/cli/build.ts` and `src/cli/install.ts`, when the user did NOT pass `--section`, resolve it: read the live `reaper-kb.ini` (from the resolved resource dir; `resolveResourceDir` + `join(dir, 'reaper-kb.ini')`), and if it exists, `section = detectReaTooledSection(readFileSync(kb, 'utf8'))`; else default `0`. An explicit `--section` still wins. Print the chosen section (e.g. `section: 16 (ReaTooled detected)`).

- [ ] **Step 5: Run — expect PASS**

Run: `pnpm test reatooled && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/reatooled.ts src/cli/build.ts src/cli/install.ts tests/reatooled.test.ts
git commit -m "Auto-detect reaper-kb.ini section (16 for ReaTooled, else 0)"
```

---

## Task 6: Update golden fixtures, full green, install + user verification

**Files:**
- Modify: `tests/parity.test.ts` fixtures (B and the plain-move family intentionally changed)
- Modify: `README.md` (document the edit-selection model + `area` kind)

- [ ] **Step 1: Regenerate the intended-output baseline**

The migration-era parity test compared against the frozen Python reference; B and the plain moves now intentionally diverge. Convert the byte-drift guard's fixture to the current intended output and scope the Python-reference comparison to the unchanged bindings (or replace it with a self-consistent intended-output baseline). Rebuild and refresh `tests/fixtures/luna-macos.tsbuild.ReaperKeyMap`. Add a comment noting B/moves are intended divergences from the original Python output.

- [ ] **Step 2: Full suite green**

Run: `pnpm typecheck && pnpm test`
Expected: all green.

- [ ] **Step 3: Build with auto-section and install on the mac**

```bash
pnpm ra build mappings/luna.toml -o build/luna.ReaperKeyMap   # auto-detects section 16 (ReaTooled)
pnpm ra install --keymap build/luna.ReaperKeyMap
```

Confirm the install reports `section: 16 (ReaTooled detected)` and stages `luna_select_area.lua`.

- [ ] **Step 4: README**

Document the edit-selection model (area = selected tracks × time range; build by keyboard; `B`/`selectArea`; plain-move collapse; `area = <action>` for one-key ops; auto-section). Do not call anything "production-ready."

- [ ] **Step 5: User verification (manual, on the mac)**

Re-import `LUNA (Pro Tools)` in REAPER. Verify: select non-contiguous tracks (`Shift+P`/`;`) + a time range (`Shift+[`/`]`) → `B` separates exactly that area; `Delete` removes it (clipboard intact); `Cut` removes it (clipboard set); a plain move (`L`/`'`, arrows) collapses the selection. Report any mismatch for tower-based diagnosis.

- [ ] **Step 6: Commit**

```bash
git add tests/ README.md build/
git commit -m "Update golden fixtures and README for the edit-selection model"
```

---

## Deferred (follow-up, out of this plan's scope)

- **Non-contiguous track selection by keyboard.** `Shift+P`/`;` extend contiguously; a keyboard "add current track to the selection without moving" (the Cmd-click equivalent) needs its own binding/script. Design + build separately.
- **Undo-grouping polish** for the collapse macros if REAPER records multiple steps.
- **Ripple/focus nuances** of the chosen Delete/Cut actions under more complex projects.

---

## Self-Review

**Spec coverage:** model → Task 2 (`selectArea`); `area` kind → Task 3; one-key delete/cut (distinct) → Task 4; plain-move collapse → Task 4; native-only (enforced by existing validation) → inherited; section auto-detect → Task 5; portability → Tasks 3+5; tower verification → Tasks 2/4. Non-contiguous-keyboard + undo polish explicitly deferred.

**Placeholder scan:** the `selectArea` Lua and generator branch are given verbatim; tests are concrete. The one intentionally open input is *which exact keys* are in the plain-move family (Task 4 Step 3) and *which keys* hold Delete/Cut (Task 4 Step 2) — resolved by reading `luna.toml`, not guessed here.

**Type consistency:** `renderSelectAreaScript` (template), `{area}` kind (mapping ↔ build-keymap), `detectReaTooledSection` (reatooled ↔ cli) match across tasks.
