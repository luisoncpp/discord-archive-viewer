import type { CsvRow, MessageRecord } from './types.js'

function normalizeText(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  return trimmed
}

export function mapCsvRowToMessage(csvRow: CsvRow, sourceRowId: number): MessageRecord {
  return {
    sourceRowId,
    messageTimestamp: csvRow.Date,
    authorId: csvRow.AuthorID,
    authorName: csvRow.Author,
    content: normalizeText(csvRow.Content),
    attachmentsRaw: normalizeText(csvRow.Attachments),
    reactionsRaw: normalizeText(csvRow.Reactions),
  }
}
