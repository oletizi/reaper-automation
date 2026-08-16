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
})
