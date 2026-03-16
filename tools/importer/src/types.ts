export type CsvRow = {
  AuthorID: string
  Author: string
  Date: string
  Content: string
  Attachments: string
  Reactions: string
}

export type MessageRecord = {
  sourceRowId: number
  messageTimestamp: string
  authorId: string
  authorName: string
  content: string | null
  attachmentsRaw: string | null
  reactionsRaw: string | null
}

export type ImportOptions = {
  csvPath: string
  databaseName: string
  remote: boolean
  batchSize: number
  encoding: string
  resume: boolean
  statePath: string
  wranglerConfigPath: string
  maxRows?: number
}

export type ImportMetrics = {
  startedAt: string
  finishedAt: string
  durationMs: number
  processedRows: number
  insertedOrUpdatedRows: number
  skippedRows: number
  failedRows: number
  lastSourceRowId: number
  batchSize: number
  databaseName: string
  remote: boolean
  csvPath: string
}
