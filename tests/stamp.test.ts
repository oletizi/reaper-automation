import { describe, it, expect } from 'vitest'
import { formatStamp } from '@/core/stamp'

describe('formatStamp', () => {
  it('renders a clean commit as the short sha alone', () => {
    expect(formatStamp({ sha: '7aec6b4', dirty: false })).toBe('7aec6b4')
  })
  it('marks a dirty working tree with a -dirty suffix', () => {
    expect(formatStamp({ sha: '7aec6b4', dirty: true })).toBe('7aec6b4-dirty')
  })
  it('falls back to "unknown" when there is no sha', () => {
    expect(formatStamp({ sha: '', dirty: false })).toBe('unknown')
    expect(formatStamp({ sha: '', dirty: true })).toBe('unknown')
  })
})
