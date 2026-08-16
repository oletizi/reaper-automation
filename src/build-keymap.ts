import { parse as parseKey, describe as describeKey } from '@/keyspec'
import { superWarning, type Target } from '@/translate'
import { stableId, slugify } from '@/ids'
import type { ActionIndex } from '@/actions'
import type { Mapping } from '@/mapping'
import { renderExtendScript } from '@/extend-template'
import { renderSelectAreaScript } from '@/select-area-template'

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
  const scripts = new Map<string, string>()
  let selectAreaEntry: { fname: string; sid: string } | undefined

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
