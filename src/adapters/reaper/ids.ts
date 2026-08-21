import { createHash } from 'node:crypto'

export function stableId(label: string): string {
  return createHash('md5').update('reaper-automation/' + label, 'utf8').digest('hex')
}

export function slugify(text: string): string {
  let out = ''
  for (const c of text) out += /[a-z0-9]/i.test(c) ? c.toLowerCase() : '_'
  while (out.includes('__')) out = out.replaceAll('__', '_')
  return out.replace(/^_+|_+$/g, '')
}
