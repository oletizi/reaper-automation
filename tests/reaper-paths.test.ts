import { describe, it, expect } from 'vitest'
import { resolveResourceDir } from '@/adapters/reaper/paths'

describe('resolveResourceDir', () => {
  it('macOS path', () => {
    expect(resolveResourceDir({ platform: 'darwin', home: '/Users/x' }))
      .toBe('/Users/x/Library/Application Support/REAPER')
  })
  it('Linux path', () => {
    expect(resolveResourceDir({ platform: 'linux', home: '/home/x' })).toBe('/home/x/.config/REAPER')
  })
  it('override and env win over the default', () => {
    expect(resolveResourceDir({ platform: 'linux', home: '/home/x', override: '/tmp/r' })).toBe('/tmp/r')
    expect(resolveResourceDir({ platform: 'linux', home: '/home/x', env: { REAPER_RESOURCE_DIR: '/tmp/e' } })).toBe('/tmp/e')
  })
  it('throws on Windows and unknown platforms', () => {
    expect(() => resolveResourceDir({ platform: 'win32', home: 'C:\\' })).toThrow(/unsupported platform/)
  })
})
