import { parseArgs } from 'node:util'

export function parseBuild(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      target: { type: 'string' },
      'no-strict': { type: 'boolean', default: false },
    },
  })
  const mapping = positionals[0]
  if (!mapping) throw new Error('build: missing <mapping> positional')
  if (!values.out) throw new Error('build: -o/--out is required')
  return { mapping, out: values.out, target: values.target, strict: !values['no-strict'] }
}

export function parseInstall(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: { keymap: { type: 'string' }, 'resource-dir': { type: 'string' } },
  })
  return { keymap: values.keymap, resourceDir: values['resource-dir'] }
}

export function parseFindAction(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { id: { type: 'string' }, section: { type: 'string' } },
  })
  return { terms: positionals, id: values.id, section: values.section }
}

export function parseReport(argv: string[]) {
  const { values } = parseArgs({ args: argv, options: { kb: { type: 'string' } } })
  return { kb: values.kb }
}
