import { parse as parseKey, describe as describeKey } from '@/keyspec'
import { superWarning, type Target } from '@/translate'
import { stableId, slugify } from '@/ids'
import type { ActionIndex } from '@/actions'
import type { Mapping } from '@/mapping'
import { renderExtendScript } from '@/extend-template'
import { renderRazorExtendScript } from '@/razor-extend-template'
import { renderRazorRepaintScript } from '@/razor-repaint-template'
import { renderSeparateScript } from '@/separate-template'

const SELECT_RAZOR_ITEMS_ACTION = 42957

const SCRIPT_DIR = 'luna'

export interface BuildResult {
  keymapText: string
  scripts: Map<string, string>
  warnings: string[]
  stats: { direct: number; macro: number; script: number; disabled: number; unmapped: number }
}

// `section` is the reaper-kb.ini key section the bindings are emitted into.
// 0 is REAPER's stock Main section. On a machine running ReaTooled, ReaTooled's
// Main bindings live in section 16 and take precedence over an imported section-0
// keymap, so overriding them requires emitting into section 16 as well (verified
// empirically — see the design doc's resolved section-precedence question).
export function buildKeymap(mapping: Mapping, actions: ActionIndex, target: Target, section = 0): BuildResult {
  const actLines: string[] = []
  const scrLines: string[] = []
  const keyLines: string[] = []
  const errors: string[] = []
  const warnings: string[] = []
  const stats = { direct: 0, macro: 0, script: 0, disabled: 0, unmapped: 0 }

  const seenKeys = new Map<string, string>()
  const seenMacros = new Map<string, string>()
  const seenScripts = new Map<number, { fname: string; sid: string }>()
  const seenRazorExtendScripts = new Map<number, { fname: string; sid: string }>()
  const scripts = new Map<string, string>()
  let razorRepaintEntry: { fname: string; sid: string } | undefined
  let separateEntry: { fname: string; sid: string } | undefined

  function ensureRazorRepaint(): { fname: string; sid: string } {
    if (!razorRepaintEntry) {
      const label = 'LUNA: Repaint Area'
      const fname = 'luna_razor_repaint.lua'
      const sid = stableId(label)
      scripts.set(fname, renderRazorRepaintScript({ label, spec: mapping.meta.name }))
      scrLines.push(`SCR 4 ${section} "${sid}" "Custom: ${label}" ${SCRIPT_DIR}/${fname}`)
      razorRepaintEntry = { fname, sid }
    }
    return razorRepaintEntry
  }

  function ensureSeparate(): { fname: string; sid: string } {
    if (!separateEntry) {
      const label = 'LUNA: Separate'
      const fname = 'luna_separate.lua'
      const sid = stableId(label)
      scripts.set(fname, renderSeparateScript({ label, spec: mapping.meta.name }))
      scrLines.push(`SCR 4 ${section} "${sid}" "Custom: ${label}" ${SCRIPT_DIR}/${fname}`)
      separateEntry = { fname, sid }
    }
    return separateEntry
  }

  for (const b of mapping.bindings) {
    const luna = b.luna
    if (b.status === 'unmapped') { stats.unmapped++; continue }

    if (b.key === undefined) {
      errors.push(`${luna}: missing key`)
      continue
    }
    let flags: number
    let code: number
    try {
      const p = parseKey(b.key)
      flags = p.flags; code = p.keycode
    } catch (e) {
      errors.push(`${luna}: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }

    const combo = describeKey(flags, code, target)
    const comboKey = `${flags},${code}`
    if (seenKeys.has(comboKey)) {
      errors.push(`${luna}: key ${combo} already bound to ${JSON.stringify(seenKeys.get(comboKey))}`)
      continue
    }
    seenKeys.set(comboKey, luna)

    const w = superWarning(flags, target, luna)
    if (w) warnings.push(w)

    let command: string
    let desc: string

    if (b.kind && 'extend' in b.kind) {
      const move = b.kind.extend
      const moveName = actions.byId(String(move))
      if (moveName === undefined) { errors.push(`${luna}: extend references unknown action ${move}`); continue }
      let entry = seenScripts.get(move)
      if (!entry) {
        const base = b.label ?? luna.split(' (')[0]
        const label = `LUNA: ${base}`
        const fname = `luna_${slugify(base)}.lua`
        const sid = stableId(label)
        scripts.set(fname, renderExtendScript({ label, spec: mapping.meta.name, move, moveName }))
        scrLines.push(`SCR 4 ${section} "${sid}" "Custom: ${label}" ${SCRIPT_DIR}/${fname}`)
        entry = { fname, sid }
        seenScripts.set(move, entry)
      }
      command = '_' + entry.sid
      desc = `script ${entry.fname}  [extend selection via ${moveName}]`
      stats.script++
    } else if (b.kind && 'razorExtend' in b.kind) {
      const move = b.kind.razorExtend
      const moveName = actions.byId(String(move))
      if (moveName === undefined) { errors.push(`${luna}: razor_extend references unknown action ${move}`); continue }
      let entry = seenRazorExtendScripts.get(move)
      if (!entry) {
        // NOTE: `fname` is derived from `base` the same way the `extend` branch above
        // derives its filename, but the two branches dedup through separate maps
        // (seenScripts vs seenRazorExtendScripts) and both write into the shared
        // `scripts` map. A mapping with BOTH an `extend` and a `razor_extend` binding
        // for the same base label would compute the same `fname` in both branches and
        // one script's content would silently clobber the other in `scripts`. Not
        // reachable today (no `extend` bindings remain in luna.toml), but worth
        // knowing before adding one back.
        const base = b.label ?? luna.split(' (')[0]
        const label = `LUNA: ${base}`
        const fname = `luna_${slugify(base)}.lua`
        const sid = stableId(label)
        scripts.set(fname, renderRazorExtendScript({ label, spec: mapping.meta.name, move, moveName }))
        scrLines.push(`SCR 4 ${section} "${sid}" "Custom: ${label}" ${SCRIPT_DIR}/${fname}`)
        entry = { fname, sid }
        seenRazorExtendScripts.set(move, entry)
      }
      command = '_' + entry.sid
      desc = `script ${entry.fname}  [extend razor area via ${moveName}]`
      stats.script++
    } else if (b.kind && 'razorTrack' in b.kind) {
      const trackActionId = String(b.kind.razorTrack)
      const trackActionName = actions.byId(trackActionId)
      if (trackActionName === undefined) { errors.push(`${luna}: razor_track references unknown action ${trackActionId}`); continue }
      const repaint = ensureRazorRepaint()
      const label = b.label ?? `LUNA: ${luna}`
      let mid = seenMacros.get(label)
      if (mid === undefined) {
        mid = stableId(label)
        seenMacros.set(label, mid)
        actLines.push(`ACT 0 ${section} "${mid}" "Custom: ${label}" ${trackActionId} _${repaint.sid}`)
      }
      command = '_' + mid
      desc = `${label}  [${trackActionName} > repaint area]`
      stats.macro++
    } else if (b.kind && 'razor' in b.kind) {
      const opId = String(b.kind.razor)
      const opName = actions.byId(opId)
      if (opName === undefined) { errors.push(`${luna}: razor references unknown action ${opId}`); continue }
      const label = b.label ?? `LUNA: ${luna}`
      let mid = seenMacros.get(label)
      if (mid === undefined) {
        mid = stableId(label)
        seenMacros.set(label, mid)
        actLines.push(`ACT 0 ${section} "${mid}" "Custom: ${label}" ${SELECT_RAZOR_ITEMS_ACTION} ${opId}`)
      }
      command = '_' + mid
      desc = `${label}  [select razor items > ${opName}]`
      stats.macro++
    } else if (b.kind && 'separate' in b.kind) {
      const entry = ensureSeparate()
      command = '_' + entry.sid
      desc = `script ${entry.fname}  [split at razor, else at edit cursor]`
      stats.script++
    } else if (b.kind && 'macro' in b.kind) {
      const steps = b.kind.macro.map(String)
      const missing = steps.filter((s) => !actions.has(s))
      if (missing.length) { errors.push(`${luna}: macro references unknown action(s) ${JSON.stringify(missing)}`); continue }
      const label = b.label ?? `LUNA: ${luna}`
      let mid = seenMacros.get(label)
      if (mid === undefined) {
        mid = stableId(label)
        seenMacros.set(label, mid)
        actLines.push(`ACT 0 ${section} "${mid}" "Custom: ${label}" ${steps.join(' ')}`)
      }
      command = '_' + mid
      desc = `${label}  [${steps.map((s) => actions.byId(s)).join(' > ')}]`
      stats.macro++
    } else if (b.kind && 'action' in b.kind) {
      const cid = String(b.kind.action)
      const name = actions.byId(cid)
      if (name === undefined) { errors.push(`${luna}: unknown command id ${cid}`); continue }
      command = cid
      desc = name
      stats.direct++
    } else if (b.status === 'disable') {
      command = '0'
      desc = 'DISABLE REAPER DEFAULT'
      stats.disabled++
    } else {
      errors.push(`${luna}: needs one of action / macro / status`)
      continue
    }

    keyLines.push(`KEY ${flags} ${code} ${command} ${section}\t# ${combo} : ${luna} -> ${desc}`)
  }

  if (errors.length) {
    throw new Error(`${errors.length} error(s):\n` + errors.map((e) => `  ERROR  ${e}`).join('\n'))
  }

  const m = mapping.meta
  const header = [
    `# ${m.name}`,
    `# generated by reaper-automation from ${m.name} -- do not hand-edit`,
    `# target: ${target}   REAPER: ${m.reaperVersion ?? '?'}`,
    '#',
    '# Import via: Actions > Show action list > Key map > Import...',
    ...m.notes.map((line) => `# ${line}`),
  ]
  const preamble = [...scrLines, ...actLines]
  const body = [...header, '', ...preamble, ...(preamble.length ? [''] : []), ...keyLines]
  const keymapText = body.join('\n') + '\n'

  return { keymapText, scripts, warnings, stats }
}
