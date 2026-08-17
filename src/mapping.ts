import { parse as parseToml } from 'smol-toml'

export type BindingStatus = 'ok' | 'unmapped' | 'disable'
export type BindingKind =
  | { action: number }
  | { macro: number[] }
  | { extend: number }
  | { razorExtend: number; selectItems?: boolean }
  | { razorTrack: number }
  | { razor: number }
  | { separate: true }
  | { tabTransient: 'next' | 'prev' }

export interface Binding {
  luna: string
  key?: string
  label?: string
  status: BindingStatus
  kind?: BindingKind
}
export interface Meta {
  name: string
  target?: string
  reaperVersion?: string
  notes: string[]
}
export interface Mapping {
  meta: Meta
  bindings: Binding[]
}

export class MappingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MappingError'
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function asInt(v: unknown, where: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) throw new MappingError(`${where}: expected integer, got ${JSON.stringify(v)}`)
  return v
}
function asOptionalString(v: unknown, where: string): string | undefined {
  if (v === undefined) return undefined
  if (typeof v !== 'string') throw new MappingError(`${where}: expected string, got ${JSON.stringify(v)}`)
  return v
}
function asStringArray(v: unknown, where: string): string[] {
  if (!Array.isArray(v)) throw new MappingError(`${where}: expected array`)
  return v.map((item, j) => {
    if (typeof item !== 'string') throw new MappingError(`${where}[${j}]: expected string, got ${JSON.stringify(item)}`)
    return item
  })
}

function validateBinding(raw: unknown, i: number): Binding {
  if (!isRecord(raw)) throw new MappingError(`binding[${i}]: not a table`)
  if (typeof raw.luna !== 'string') throw new MappingError(`binding[${i}]: missing or non-string 'luna'`)
  const luna = raw.luna
  const where = `binding[${i}] (${luna})`

  const statusRaw = raw.status
  if (statusRaw !== undefined && statusRaw !== 'ok' && statusRaw !== 'unmapped' && statusRaw !== 'disable') {
    throw new MappingError(`${where}: unknown status ${JSON.stringify(statusRaw)}`)
  }
  const status: BindingStatus = statusRaw ?? 'ok'

  const label = asOptionalString(raw.label, `${where}.label`)
  const key = asOptionalString(raw.key, `${where}.key`)

  if (status === 'unmapped') return { luna, key, label, status }

  if (key === undefined) throw new MappingError(`${where}: missing key`)

  if (status === 'disable') {
    if (
      'action' in raw ||
      'macro' in raw ||
      'extend' in raw ||
      'razor_extend' in raw ||
      'razor_track' in raw ||
      'razor' in raw
    ) {
      throw new MappingError(`${where}: disable must not carry a kind key`)
    }
    return { luna, key, label, status }
  }

  const kinds: BindingKind[] = []
  if ('action' in raw) kinds.push({ action: asInt(raw.action, `${where}.action`) })
  if ('extend' in raw) kinds.push({ extend: asInt(raw.extend, `${where}.extend`) })
  if ('macro' in raw) {
    if (!Array.isArray(raw.macro)) throw new MappingError(`${where}.macro: expected array`)
    kinds.push({ macro: raw.macro.map((s, j) => asInt(s, `${where}.macro[${j}]`)) })
  }
  if ('razor_extend' in raw) {
    const k: { razorExtend: number; selectItems?: boolean } = { razorExtend: asInt(raw.razor_extend, `${where}.razor_extend`) }
    if ('select_items' in raw) {
      if (raw.select_items !== true) throw new MappingError(`${where}.select_items: expected true`)
      k.selectItems = true
    }
    kinds.push(k)
  }
  if ('razor_track' in raw) kinds.push({ razorTrack: asInt(raw.razor_track, `${where}.razor_track`) })
  if ('razor' in raw) kinds.push({ razor: asInt(raw.razor, `${where}.razor`) })
  if ('separate' in raw) {
    if (raw.separate !== true) throw new MappingError(`${where}.separate: expected true`)
    kinds.push({ separate: true })
  }
  if ('tab_transient' in raw) {
    const v = raw.tab_transient
    if (v !== 'next' && v !== 'prev') {
      throw new MappingError(`${where}.tab_transient: expected "next" or "prev", got ${JSON.stringify(v)}`)
    }
    kinds.push({ tabTransient: v })
  }
  if (kinds.length !== 1) {
    throw new MappingError(
      `${where}: expected exactly one of action/macro/extend/razor_extend/razor_track/razor/separate/tab_transient, got ${kinds.length}`,
    )
  }
  return { luna, key, label, status, kind: kinds[0] }
}

export function parseMapping(tomlText: string): Mapping {
  const doc: unknown = parseToml(tomlText)
  if (!isRecord(doc)) throw new MappingError('top-level TOML is not a table')

  const metaRaw = isRecord(doc.meta) ? doc.meta : {}
  if (typeof metaRaw.name !== 'string') throw new MappingError("meta: missing or non-string 'name'")
  const meta: Meta = {
    name: metaRaw.name,
    target: asOptionalString(metaRaw.target, 'meta.target'),
    reaperVersion: asOptionalString(metaRaw.reaper_version, 'meta.reaper_version'),
    notes: metaRaw.notes !== undefined ? asStringArray(metaRaw.notes, 'meta.notes') : [],
  }

  const rawBindings = doc.binding
  if (rawBindings !== undefined && !Array.isArray(rawBindings)) throw new MappingError('[[binding]] is not an array')
  const bindings = (Array.isArray(rawBindings) ? rawBindings : []).map((b, i) => validateBinding(b, i))

  return { meta, bindings }
}
