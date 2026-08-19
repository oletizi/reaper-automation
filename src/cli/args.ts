import { parseArgs } from 'node:util'

export function parseBuild(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      target: { type: 'string' },
      section: { type: 'string' },
    },
  })
  // Both optional, mirroring `refresh`: the caller shouldn't have to know the
  // artifact-naming rule. cmdBuild fills them in from the repo root + host.
  const mapping = positionals[0]
  let section: number | undefined
  if (values.section !== undefined) {
    section = Number(values.section)
    if (!Number.isInteger(section) || section < 0) {
      throw new Error(`build: --section must be a non-negative integer, got ${JSON.stringify(values.section)}`)
    }
  }
  return { mapping, out: values.out, target: values.target, section }
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

export function parseRefresh(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      mapping: { type: 'string' },
      out: { type: 'string' },
      target: { type: 'string' },
      section: { type: 'string' },
      'resource-dir': { type: 'string' },
    },
  })
  let section: number | undefined
  if (values.section !== undefined) {
    section = Number(values.section)
    if (!Number.isInteger(section) || section < 0) {
      throw new Error(`refresh: --section must be a non-negative integer, got ${JSON.stringify(values.section)}`)
    }
  }
  return { mapping: values.mapping, out: values.out, target: values.target, section, resourceDir: values['resource-dir'] }
}

export function parseDoctor(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: { out: { type: 'string' }, 'resource-dir': { type: 'string' } },
  })
  return { out: values.out, resourceDir: values['resource-dir'] }
}

export function parseDocs(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { out: { type: 'string', short: 'o' }, check: { type: 'boolean' } },
  })
  return { mapping: positionals[0], out: values.out, check: values.check ?? false }
}

export function parseWm(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: { apply: { type: 'boolean' }, revert: { type: 'boolean' } },
  })
  return { mapping: positionals[0], apply: values.apply ?? false, revert: values.revert ?? false }
}

export function parsePrefsCmd(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      apply: { type: 'boolean' },
      snapshot: { type: 'boolean' },
      changed: { type: 'boolean' },
      prefs: { type: 'string' },
      ini: { type: 'string' },
      'snapshot-path': { type: 'string' },
      'resource-dir': { type: 'string' },
    },
  })
  return {
    apply: values.apply ?? false,
    snapshotMode: values.snapshot ?? false,
    changed: values.changed ?? false,
    prefs: values.prefs,
    ini: values.ini,
    snapshot: values['snapshot-path'],
    resourceDir: values['resource-dir'],
  }
}

