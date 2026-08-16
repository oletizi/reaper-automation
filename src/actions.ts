import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export interface ActionRow {
  section: string
  sectionId: string
  commandId: string
  namedId: string
  actionName: string
}

export const DEFAULT_ACTIONS_TSV = fileURLToPath(
  new URL('../data/reaper-actions-7.78.tsv', import.meta.url),
)

export function loadActions(tsvPath: string = DEFAULT_ACTIONS_TSV): ActionRow[] {
  const text = readFileSync(tsvPath, 'utf8')
  const out: ActionRow[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const f = line.split('\t')
    if (f.length < 5) continue
    if (i === 0 && f[0] === 'section') continue // header
    out.push({ section: f[0], sectionId: f[1], commandId: f[2], namedId: f[3], actionName: f[4] })
  }
  return out
}

export class ActionIndex {
  private mainById = new Map<string, string>()
  constructor(private rows: ActionRow[]) {
    for (const r of rows) if (r.section === 'main') this.mainById.set(r.commandId, r.actionName)
  }
  byId(id: string): string | undefined {
    return this.mainById.get(id)
  }
  has(id: string): boolean {
    return this.mainById.has(id)
  }
  find(terms: string[], section?: string): ActionRow[] {
    const needles = terms.map((t) => t.toLowerCase())
    return this.rows.filter((r) => {
      if (section && r.section !== section) return false
      const hay = r.actionName.toLowerCase()
      return needles.every((n) => hay.includes(n))
    })
  }
}
