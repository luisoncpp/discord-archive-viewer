import { createReadStream } from 'node:fs'
import { parse } from 'csv-parse'
import iconv from 'iconv-lite'
import { ensureSchema, readImportState, upsertBatch, writeImportState } from './db.js'
import { mapCsvRowToMessage } from './transform.js'
import type { CsvRow, ImportMetrics, ImportOptions, MessageRecord } from './types.js'

export async function runImport(options: ImportOptions): Promise<ImportMetrics> {
  const startedAt = new Date()
  const target = {
    databaseName: options.databaseName,
    remote: options.remote,
    wranglerConfigPath: options.wranglerConfigPath,
  }

  ensureSchema(target)

  const persistedState = options.resume ? readImportState(options.statePath) : { lastSourceRowId: 0 }
  const lastImportedSourceRowId = persistedState.lastSourceRowId

  let processedRows = 0
  let insertedOrUpdatedRows = 0
  let skippedRows = 0
  let failedRows = 0
  let lastSourceRowId = lastImportedSourceRowId
  let sourceRowId = 0
  let batch: MessageRecord[] = []

  const parser = parse({
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: false,
  })

  const decodeStream = iconv.decodeStream(options.encoding)
  const inputStream = createReadStream(options.csvPath)

  inputStream.pipe(decodeStream).pipe(parser)

  for await (const record of parser) {
    sourceRowId += 1

    if (sourceRowId <= lastImportedSourceRowId) {
      skippedRows += 1
      continue
    }

    if (options.maxRows && processedRows >= options.maxRows) {
      break
    }

    try {
      const row = record as CsvRow
      const mapped = mapCsvRowToMessage(row, sourceRowId)
      batch.push(mapped)
      processedRows += 1
      lastSourceRowId = sourceRowId
    } catch {
      failedRows += 1
      continue
    }

    if (batch.length >= options.batchSize) {
      upsertBatch(target, batch)
      insertedOrUpdatedRows += batch.length
      writeImportState(options.statePath, { lastSourceRowId })
      batch = []
    }
  }

  if (batch.length > 0) {
    upsertBatch(target, batch)
    insertedOrUpdatedRows += batch.length
    writeImportState(options.statePath, { lastSourceRowId })
    batch = []
  }

  const finishedAt = new Date()

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    processedRows,
    insertedOrUpdatedRows,
    skippedRows,
    failedRows,
    lastSourceRowId,
    batchSize: options.batchSize,
    databaseName: options.databaseName,
    remote: options.remote,
    csvPath: options.csvPath,
  }
}
