import { parse as parseToml } from 'smol-toml'

export type BindingStatus = 'ok' | 'unmapped' | 'disable'
export type BindingKind = { action: number } | { macro: number[] } | { extend: number }

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

export class MappingError extends Error {}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function asInt(v: unknown, where: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) throw new MappingError(`${where}: expected integer, got ${JSON.stringify(v)}`)
  return v
}

function validateBinding(raw: unknown, i: number): Binding {
  if (!isRecord(raw)) throw new MappingError(`binding[${i}]: not a table`)
  const luna = typeof raw.luna === 'string' ? raw.luna : `<binding ${i}>`
  const where = `binding[${i}] (${luna})`

  const statusRaw = raw.status
  if (statusRaw !== undefined && statusRaw !== 'ok' && statusRaw !== 'unmapped' && statusRaw !== 'disable') {
    throw new MappingError(`${where}: unknown status ${JSON.stringify(statusRaw)}`)
  }
  const status: BindingStatus = statusRaw ?? 'ok'

  const label = typeof raw.label === 'string' ? raw.label : undefined
  const key = typeof raw.key === 'string' ? raw.key : undefined

  if (status === 'unmapped') return { luna, key, label, status }

  if (key === undefined) throw new MappingError(`${where}: missing key`)

  if (status === 'disable') {
    if ('action' in raw || 'macro' in raw || 'extend' in raw) {
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
  if (kinds.length !== 1) {
    throw new MappingError(`${where}: expected exactly one of action/macro/extend, got ${kinds.length}`)
  }
  return { luna, key, label, status, kind: kinds[0] }
}

export function parseMapping(tomlText: string): Mapping {
  const doc: unknown = parseToml(tomlText)
  if (!isRecord(doc)) throw new MappingError('top-level TOML is not a table')

  const metaRaw = isRecord(doc.meta) ? doc.meta : {}
  const meta: Meta = {
    name: typeof metaRaw.name === 'string' ? metaRaw.name : 'REAPER keymap',
    target: typeof metaRaw.target === 'string' ? metaRaw.target : undefined,
    reaperVersion: typeof metaRaw.reaper_version === 'string' ? metaRaw.reaper_version : undefined,
    notes: Array.isArray(metaRaw.notes) ? metaRaw.notes.filter((n): n is string => typeof n === 'string') : [],
  }

  const rawBindings = doc.binding
  if (rawBindings !== undefined && !Array.isArray(rawBindings)) throw new MappingError('[[binding]] is not an array')
  const bindings = (Array.isArray(rawBindings) ? rawBindings : []).map((b, i) => validateBinding(b, i))

  return { meta, bindings }
}
