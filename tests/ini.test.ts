import { describe, it, expect } from 'vitest'
import { parseIni, readValue, writeValue, diffIni } from '@/adapters/reaper/ini'

const SAMPLE = ['[REAPER]', 'loadlastproj=18', 'zoom=3', '', '[audioconfig]', 'device=alsa', ''].join('\n')

describe('parseIni', () => {
  it('attributes each key to its section', () => {
    const e = parseIni(SAMPLE)
    expect(readValue(e, 'REAPER', 'loadlastproj')).toBe('18')
    expect(readValue(e, 'audioconfig', 'device')).toBe('alsa')
  })
  it('does not confuse same-named keys in different sections', () => {
    const t = ['[a]', 'x=1', '[b]', 'x=2'].join('\n')
    const e = parseIni(t)
    expect(readValue(e, 'a', 'x')).toBe('1')
    expect(readValue(e, 'b', 'x')).toBe('2')
  })
  it('keeps values containing = intact', () => {
    expect(readValue(parseIni('[a]\npath=/x=y/z'), 'a', 'path')).toBe('/x=y/z')
  })
})

describe('writeValue', () => {
  it('rewrites one line and leaves every other byte alone', () => {
    // REAPER owns this file; a parse-and-regenerate round trip would silently
    // drop whatever we failed to model.
    const out = writeValue(SAMPLE, 'REAPER', 'loadlastproj', '19')
    expect(out).toBe(SAMPLE.replace('loadlastproj=18', 'loadlastproj=19'))
  })
  it('inserts a missing key at the end of its section, not the file', () => {
    const out = writeValue(SAMPLE, 'REAPER', 'newkey', '7')
    const lines = out.split('\n')
    expect(lines.indexOf('newkey=7')).toBeGreaterThan(lines.indexOf('zoom=3'))
    expect(lines.indexOf('newkey=7')).toBeLessThan(lines.indexOf('[audioconfig]'))
    expect(readValue(parseIni(out), 'audioconfig', 'device')).toBe('alsa')
  })
  it('refuses to invent a section it cannot find', () => {
    expect(() => writeValue(SAMPLE, 'nosuch', 'k', 'v')).toThrow(/refusing to create/)
  })
})

describe('diffIni', () => {
  it('reports changed, added and removed keys', () => {
    const before = parseIni(['[REAPER]', 'a=1', 'b=2'].join('\n'))
    const after = parseIni(['[REAPER]', 'a=9', 'c=3'].join('\n'))
    expect(diffIni(before, after)).toEqual([
      { section: 'REAPER', key: 'a', before: '1', after: '9' },
      { section: 'REAPER', key: 'b', before: '2', after: undefined },
      { section: 'REAPER', key: 'c', before: undefined, after: '3' },
    ])
  })
  it('is empty for identical snapshots', () => {
    expect(diffIni(parseIni(SAMPLE), parseIni(SAMPLE))).toEqual([])
  })
})
