import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { MessageRecord } from './types.js'

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)))

type WranglerTarget = {
  databaseName: string
  remote: boolean
  wranglerConfigPath: string
}

function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''")
}

function toSqlText(value: string | null): string {
  if (value === null) {
    return 'NULL'
  }

  return `'${escapeSqlString(value)}'`
}

function executeWrangler(target: WranglerTarget, args: string[]): string {
  const quotedArgs = args.map((item) => `"${item.replaceAll('"', '\\"')}"`).join(' ')
  const command = [
    'npx wrangler d1 execute',
    `"${target.databaseName}"`,
    target.remote ? '--remote' : '--local',
    '--yes',
    '--json',
    '-c',
    `"${target.wranglerConfigPath}"`,
    quotedArgs,
  ].join(' ')

  const maxAttempts = 5

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return execSync(command, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error
      }
    }
  }

  throw new Error('Unreachable executeWrangler state')
}

export function ensureSchema(target: WranglerTarget): void {
  const migrationPath = resolve(repoRoot, 'sql/migrations/0001_init_messages.sql')
  executeWrangler(target, ['--file', migrationPath])
}

export function upsertBatch(target: WranglerTarget, batch: MessageRecord[]): void {
  if (batch.length === 0) {
    return
  }

  const maxRowsPerStatement = 100

  const statements: string[] = []

  for (let start = 0; start < batch.length; start += maxRowsPerStatement) {
    const chunk = batch.slice(start, start + maxRowsPerStatement)
    const values = chunk.map((item) => {
      return `(${item.sourceRowId}, ${toSqlText(item.messageTimestamp)}, ${toSqlText(item.authorId)}, ${toSqlText(item.authorName)}, ${toSqlText(item.content)}, ${toSqlText(item.attachmentsRaw)}, ${toSqlText(item.reactionsRaw)})`
    })

    statements.push(`
INSERT INTO messages (
  source_row_id,
  message_timestamp,
  author_id,
  author_name,
  content,
  attachments_raw,
  reactions_raw
) VALUES
${values.join(',\n')}
ON CONFLICT(source_row_id) DO UPDATE SET
  message_timestamp = excluded.message_timestamp,
  author_id = excluded.author_id,
  author_name = excluded.author_name,
  content = excluded.content,
  attachments_raw = excluded.attachments_raw,
  reactions_raw = excluded.reactions_raw;
`.trim())
  }

  const sql = statements.join('\n\n')

  const tempFilePath = resolve(tmpdir(), `discord-archive-import-${Date.now()}-${Math.random().toString(16).slice(2)}.sql`)
  writeFileSync(tempFilePath, sql, 'utf8')

  try {
    executeWrangler(target, ['--file', tempFilePath])
  } finally {
    rmSync(tempFilePath, { force: true })
  }
}

type ImportState = {
  lastSourceRowId: number
}

export function readImportState(statePath: string): ImportState {
  try {
    const rawContent = readFileSync(statePath, 'utf8')
    const parsed = JSON.parse(rawContent) as Partial<ImportState>
    if (typeof parsed.lastSourceRowId === 'number' && parsed.lastSourceRowId >= 0) {
      return { lastSourceRowId: parsed.lastSourceRowId }
    }

    return { lastSourceRowId: 0 }
  } catch {
    return { lastSourceRowId: 0 }
  }
}

export function writeImportState(statePath: string, state: ImportState): void {
  mkdirSync(dirname(statePath), { recursive: true })
  const payload = JSON.stringify(state, null, 2)
  writeFileSync(statePath, payload, 'utf8')
}
