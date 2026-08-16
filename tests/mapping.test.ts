import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseMapping, MappingError } from '@/mapping'

const mini = readFileSync(fileURLToPath(new URL('./fixtures/mini.toml', import.meta.url)), 'utf8')

describe('parseMapping', () => {
  it('parses the four binding shapes and defaults status to ok', () => {
    const m = parseMapping(mini)
    expect(m.meta.name).toBe('mini')
    expect(m.bindings).toHaveLength(4)
    expect(m.bindings[0]).toMatchObject({ luna: 'Play', key: 'Space', status: 'ok', kind: { action: 40044 } })
    expect(m.bindings[1].kind).toEqual({ macro: [40296, 41325] })
    expect(m.bindings[1].label).toBe('Increase all track heights')
    expect(m.bindings[2].kind).toEqual({ extend: 41042 })
    expect(m.bindings[3].status).toBe('unmapped')
  })
  it('throws MappingError when a normal binding has two kind keys', () => {
    const bad = '[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\naction=1\nmacro=[2]\n'
    expect(() => parseMapping(bad)).toThrow(MappingError)
  })
  it('throws MappingError when a normal binding has no kind key and no disable/unmapped status', () => {
    const bad = '[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\n'
    expect(() => parseMapping(bad)).toThrow(MappingError)
  })
  it('throws MappingError when a non-unmapped binding has no key', () => {
    const bad = '[meta]\nname="x"\n[[binding]]\nluna="B"\naction=1\n'
    expect(() => parseMapping(bad)).toThrow(MappingError)
  })
  it('parses a disable binding with key and no kind', () => {
    const t = '[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\nstatus="disable"\n'
    const m = parseMapping(t)
    expect(m.bindings[0]).toMatchObject({ luna: 'B', key: 'A', status: 'disable' })
    expect(m.bindings[0].kind).toBeUndefined()
  })
  it('throws MappingError when a disable binding carries a kind key', () => {
    const bad = '[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\nstatus="disable"\naction=1\n'
    expect(() => parseMapping(bad)).toThrow(MappingError)
  })
  it('throws MappingError when a disable binding has no key', () => {
    const bad = '[meta]\nname="x"\n[[binding]]\nluna="B"\nstatus="disable"\n'
    expect(() => parseMapping(bad)).toThrow(MappingError)
  })
  it('throws MappingError for an unknown status value', () => {
    const bad = '[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\nstatus="typo"\naction=1\n'
    expect(() => parseMapping(bad)).toThrow(MappingError)
  })
  it('throws MappingError for a non-integer action', () => {
    const bad = '[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\naction=1.5\n'
    expect(() => parseMapping(bad)).toThrow(MappingError)
  })
  it('throws MappingError when macro is not an array', () => {
    const bad = '[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\nmacro=40296\n'
    expect(() => parseMapping(bad)).toThrow(MappingError)
  })
  it('throws MappingError when luna is missing', () => {
    const bad = '[meta]\nname="x"\n[[binding]]\nkey="A"\naction=1\n'
    expect(() => parseMapping(bad)).toThrow(MappingError)
  })
  it('throws MappingError when luna is present but not a string', () => {
    const bad = '[meta]\nname="x"\n[[binding]]\nluna=1\nkey="A"\naction=1\n'
    expect(() => parseMapping(bad)).toThrow(MappingError)
  })
  it('throws MappingError when meta.name is missing', () => {
    const bad = '[[binding]]\nluna="B"\nkey="A"\naction=1\n'
    expect(() => parseMapping(bad)).toThrow(MappingError)
  })
  it('throws MappingError when meta.name is present but not a string', () => {
    const bad = '[meta]\nname=1\n[[binding]]\nluna="B"\nkey="A"\naction=1\n'
    expect(() => parseMapping(bad)).toThrow(MappingError)
  })
  it('defaults meta.notes to an empty array when absent', () => {
    const t = '[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\naction=1\n'
    const m = parseMapping(t)
    expect(m.meta.notes).toEqual([])
  })
  it('throws MappingError when meta.notes is not an array', () => {
    const bad = '[meta]\nname="x"\nnotes="oops"\n[[binding]]\nluna="B"\nkey="A"\naction=1\n'
    expect(() => parseMapping(bad)).toThrow(MappingError)
  })
  it('throws MappingError when meta.notes contains a non-string element', () => {
    const bad = '[meta]\nname="x"\nnotes=["ok", 5]\n[[binding]]\nluna="B"\nkey="A"\naction=1\n'
    expect(() => parseMapping(bad)).toThrow(MappingError)
  })
  it('throws MappingError when key is present but not a string', () => {
    const bad = '[meta]\nname="x"\n[[binding]]\nluna="B"\nkey=42\naction=1\n'
    expect(() => parseMapping(bad)).toThrow(MappingError)
  })
  it('throws MappingError when label is present but not a string', () => {
    const bad = '[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\nlabel=42\naction=1\n'
    expect(() => parseMapping(bad)).toThrow(MappingError)
  })
  it('sets error.name to MappingError', () => {
    const bad = '[[binding]]\nluna="B"\nkey="A"\naction=1\n'
    expect.assertions(2)
    try {
      parseMapping(bad)
    } catch (e) {
      expect(e).toBeInstanceOf(MappingError)
      if (e instanceof MappingError) {
        expect(e.name).toBe('MappingError')
      }
    }
  })
})
