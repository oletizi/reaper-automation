import { loadActions, ActionIndex } from '@/adapters/reaper/actions'
import { parseFindAction } from '@/cli/args'

export function cmdFindAction(argv: string[]): number {
  const a = parseFindAction(argv)
  const rows = loadActions()
  const idx = new ActionIndex(rows)
  if (a.id) {
    const hit = rows.find((r) => r.commandId === a.id && r.section === (a.section ?? 'main'))
    if (!hit) { console.error(`no action ${a.id}`); return 1 }
    console.log(`${hit.commandId}\t${hit.actionName}`)
    return 0
  }
  for (const r of idx.find(a.terms, a.section)) console.log(`${r.section}\t${r.commandId}\t${r.actionName}`)
  return 0
}
