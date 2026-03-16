import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import type { ImportOptions } from './types.js'

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)))

type RawFlags = Record<string, string | boolean>

function parseFlags(argv: string[]): RawFlags {
  const flags: RawFlags = {}

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token) {
      continue
    }

    if (!token.startsWith('--')) {
      continue
    }

    const key = token.slice(2)
    if (!key) {
      continue
    }

    if (key === 'no-resume') {
      flags.resume = false
      continue
    }

    const nextToken = argv[index + 1]
    if (!nextToken || nextToken.startsWith('--')) {
      flags[key] = true
      continue
    }

    flags[key] = nextToken
    index += 1
  }

  return flags
}

const CliOptionsSchema = z.object({
  csvPath: z.string().min(1),
  databaseName: z.string().min(1),
  remote: z.boolean(),
  batchSize: z.coerce.number().int().positive().max(50000),
  encoding: z.string().min(1),
  resume: z.boolean(),
  statePath: z.string().min(1),
  wranglerConfigPath: z.string().min(1),
  maxRows: z.coerce.number().int().positive().optional(),
})

export function parseCliOptions(argv: string[]): ImportOptions {
  const flags = parseFlags(argv)

  const csvPath = String(flags.csv ?? '')
  const databaseName = String(flags['db-name'] ?? process.env.IMPORT_DB_NAME ?? 'el-sillon')
  const remote = flags.remote === true
  const batchSize = String(flags['batch-size'] ?? process.env.IMPORT_BATCH_SIZE ?? '5000')
  const encoding = String(flags.encoding ?? process.env.IMPORT_CSV_ENCODING ?? 'utf8')
  const defaultStateFile = remote ? 'import-state-remote.json' : 'import-state-local.json'
  const statePath = String(
    flags['state-path'] ?? resolve(repoRoot, `tools/importer/data/${defaultStateFile}`),
  )
  const wranglerConfigPath = String(
    flags['wrangler-config'] ?? resolve(repoRoot, 'apps/api/wrangler.toml'),
  )
  const maxRows = flags['max-rows'] === undefined ? undefined : String(flags['max-rows'])
  const resume = flags.resume !== false

  return CliOptionsSchema.parse({
    csvPath,
    databaseName,
    remote,
    batchSize,
    encoding,
    resume,
    statePath,
    wranglerConfigPath,
    maxRows,
  })
}
