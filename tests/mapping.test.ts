import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseMapping, MappingError } from '@/adapters/reaper/mapping'

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

describe('razor kinds', () => {
  it('accepts razor_extend = <int>', () => {
    const m = parseMapping('[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\nrazor_extend=41042\n')
    expect(m.bindings[0].kind).toEqual({ razorExtend: 41042 })
  })
  it('accepts razor_extend with select_items = true (for transient moves that need item selection)', () => {
    const m = parseMapping('[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\nrazor_extend=40375\nselect_items=true\n')
    expect(m.bindings[0].kind).toEqual({ razorExtend: 40375, selectItems: true })
  })
  it('rejects select_items with a non-true value', () => {
    expect(() => parseMapping('[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\nrazor_extend=40375\nselect_items=false\n')).toThrow(MappingError)
  })
  it('accepts razor_track = <int>', () => {
    const m = parseMapping('[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\nrazor_track=40297\n')
    expect(m.bindings[0].kind).toEqual({ razorTrack: 40297 })
  })
  it('accepts razor = <int>', () => {
    const m = parseMapping('[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\nrazor=40006\n')
    expect(m.bindings[0].kind).toEqual({ razor: 40006 })
  })
  it('rejects razor_extend combined with another kind', () => {
    expect(() => parseMapping('[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\nrazor_extend=41042\naction=1\n')).toThrow(MappingError)
  })
  it('rejects razor_track combined with another kind', () => {
    expect(() => parseMapping('[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\nrazor_track=40297\nextend=41042\n')).toThrow(MappingError)
  })
  it('rejects razor combined with another kind', () => {
    expect(() => parseMapping('[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\nrazor=40006\naction=1\n')).toThrow(MappingError)
  })
  it('rejects razor_extend combined with razor_track', () => {
    expect(() => parseMapping('[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\nrazor_extend=41042\nrazor_track=40297\n')).toThrow(MappingError)
  })
  it('rejects a non-integer razor value', () => {
    expect(() => parseMapping('[meta]\nname="x"\n[[binding]]\nluna="B"\nkey="A"\nrazor=1.5\n')).toThrow(MappingError)
  })
})

describe('razor_slice parsing', () => {
  it('parses razor_slice as its own kind', () => {
    const m = parseMapping('[meta]\nname="x"\n[[binding]]\nluna="Mute"\nkey="B"\nrazor_slice=40175\n')
    expect(m.bindings[0].kind).toEqual({ razorSlice: 40175 })
  })
  it('rejects razor and razor_slice on the same binding', () => {
    expect(() =>
      parseMapping('[meta]\nname="x"\n[[binding]]\nluna="Mute"\nkey="B"\nrazor=40175\nrazor_slice=40175\n'),
    ).toThrow(/exactly one of/)
  })
  it('rejects razor_slice on a disabled binding', () => {
    expect(() =>
      parseMapping('[meta]\nname="x"\n[[binding]]\nluna="Mute"\nkey="B"\nstatus="disable"\nrazor_slice=40175\n'),
    ).toThrow(/must not carry a kind key/)
  })
})

