import { describe, it, expect } from 'vitest'
import { parseIni } from '@/ini'
import { parsePrefs, statusOf, toPrefBlock, PrefsError } from '@/prefs'

const DOC = ['[meta]', 'daw = "reaper"', '', '[[pref]]', 'section = "REAPER"', 'key = "loadlastproj"', 'value = "19"', 'why = "reopen the last project"'].join('\n')

describe('parsePrefs', () => {
  it('parses a declared pref', () => {
    const d = parsePrefs(DOC)
    expect(d.daw).toBe('reaper')
    expect(d.prefs[0]).toEqual({ section: 'REAPER', key: 'loadlastproj', value: '19', why: 'reopen the last project' })
  })
  it('accepts a file that declares nothing yet', () => {
    expect(parsePrefs('[meta]\ndaw = "reaper"\n').prefs).toEqual([])
  })
  it('rejects a pref missing a required field rather than half-applying it', () => {
    expect(() => parsePrefs('[meta]\ndaw="reaper"\n[[pref]]\nsection="REAPER"\nkey="x"\n')).toThrow(PrefsError)
  })
  it('requires meta.daw so a prefs file names its target', () => {
    expect(() => parsePrefs('[[pref]]\nsection="a"\nkey="b"\nvalue="c"\n')).toThrow(/meta.daw/)
  })
})

describe('statusOf', () => {
  const prefs = parsePrefs(DOC).prefs
  it('reports a match', () => {
    expect(statusOf(prefs, parseIni('[REAPER]\nloadlastproj=19'))[0].state).toBe('match')
  })
  it('reports a difference and carries the current value', () => {
    const s = statusOf(prefs, parseIni('[REAPER]\nloadlastproj=18'))[0]
    expect(s.state).toBe('differs')
    expect(s.actual).toBe('18')
  })
  it('distinguishes absent from differing', () => {
    expect(statusOf(prefs, parseIni('[REAPER]\nother=1'))[0].state).toBe('absent')
  })
})

describe('toPrefBlock', () => {
  it('emits a block that parses back to the same pref', () => {
    const block = toPrefBlock('REAPER', 'loadlastproj', '19', 'because')
    const d = parsePrefs(`[meta]\ndaw = "reaper"\n\n${block}\n`)
    expect(d.prefs[0]).toEqual({ section: 'REAPER', key: 'loadlastproj', value: '19', why: 'because' })
  })
})
