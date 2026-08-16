export interface KbBinding {
  flags: number
  keycode: number
  command: string
  section: number
}

export function parseKb(text: string): KbBinding[] {
  const out: KbBinding[] = []
  for (const raw of text.split('\n')) {
    const line = raw.split('\t')[0].trim()
    if (!line.startsWith('KEY ')) continue
    const f = line.split(/\s+/)
    if (f.length < 5) continue
    out.push({ flags: Number(f[1]), keycode: Number(f[2]), command: f[3], section: Number(f[4]) })
  }
  return out
}

// Raw observation ONLY. OVERRIDE/FREE semantics are blocked on the section-
// precedence probe (see spec Open Questions); this must not assert coexistence.
export function observeAgainstReatooled(
  ours: { flags: number; keycode: number }[],
  kb: KbBinding[],
): { ourCount: number; sectionsSeen: number[]; sameSlotSameSection: number } {
  const sectionsSeen = [...new Set(kb.map((r) => r.section))].sort((a, b) => a - b)
  const slots = new Set(kb.map((r) => `${r.section},${r.flags},${r.keycode}`))
  let sameSlotSameSection = 0
  for (const o of ours) {
    for (const s of sectionsSeen) {
      if (slots.has(`${s},${o.flags},${o.keycode}`)) { sameSlotSameSection++; break }
    }
  }
  return { ourCount: ours.length, sectionsSeen, sameSlotSameSection }
}
