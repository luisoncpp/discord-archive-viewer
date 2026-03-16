import type { AuthorDto, CursorPage, MessageDto } from '../types/api'
import type {
  ListAuthorsParams,
  ListAuthorsRepository,
} from '../../modules/authors/list-authors.use-case'
import type {
  ListMessagesParams,
  ListMessagesRepository,
} from '../../modules/messages/list-messages.use-case'
import type {
  SearchMessagesParams,
  SearchMessagesRepository,
} from '../../modules/search/search-messages.use-case'

type MessageRow = {
  id: number
  source_row_id: number
  message_timestamp: string
  author_id: string
  author_name: string
  content: string | null
  attachments_raw: string | null
  reactions_raw: string | null
}

type AuthorRow = {
  author_id: string
  author_name: string
  message_count: number
}

export function toFtsMatchQuery(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toMessageDto(row: MessageRow): MessageDto {
  return {
    id: row.id,
    sourceRowId: row.source_row_id,
    messageTimestamp: row.message_timestamp,
    authorId: row.author_id,
    authorName: row.author_name,
    content: row.content,
    attachmentsRaw: row.attachments_raw,
    reactionsRaw: row.reactions_raw,
  }
}

function buildCursorPage(items: MessageDto[], hasMore: boolean): CursorPage<MessageDto> {
  if (items.length === 0) {
    return {
      items: [],
      nextCursor: null,
      prevCursor: null,
    }
  }

  const firstItem = items[0]
  const lastItem = items[items.length - 1]
  if (!firstItem || !lastItem) {
    return {
      items,
      nextCursor: null,
      prevCursor: null,
    }
  }

  return {
    items,
    nextCursor: hasMore ? String(lastItem.id) : null,
    prevCursor: String(firstItem.id),
  }
}

export class D1ArchiveRepository
  implements ListMessagesRepository, SearchMessagesRepository, ListAuthorsRepository
{
  private readonly db: D1Database

  constructor(db: D1Database) {
    this.db = db
  }

  async listMessages(params: ListMessagesParams): Promise<CursorPage<MessageDto>> {
    const fetchLimit = params.limit + 1

    if (params.dir === 'prev') {
      const query = params.cursor
        ? `
          SELECT id, source_row_id, message_timestamp, author_id, author_name, content, attachments_raw, reactions_raw
          FROM messages
          WHERE id < ?
          ORDER BY id DESC
          LIMIT ?
        `
        : `
          SELECT id, source_row_id, message_timestamp, author_id, author_name, content, attachments_raw, reactions_raw
          FROM messages
          ORDER BY id DESC
          LIMIT ?
        `

      const statement = this.db.prepare(query)
      const result = params.cursor
        ? await statement.bind(params.cursor, fetchLimit).all<MessageRow>()
        : await statement.bind(fetchLimit).all<MessageRow>()

      const rows = result.results ?? []
      const hasMore = rows.length > params.limit
      const slicedRows = rows.slice(0, params.limit).reverse()
      return buildCursorPage(slicedRows.map(toMessageDto), hasMore)
    }

    const query = params.cursor
      ? `
        SELECT id, source_row_id, message_timestamp, author_id, author_name, content, attachments_raw, reactions_raw
        FROM messages
        WHERE id > ?
        ORDER BY id ASC
        LIMIT ?
      `
      : `
        SELECT id, source_row_id, message_timestamp, author_id, author_name, content, attachments_raw, reactions_raw
        FROM messages
        ORDER BY id ASC
        LIMIT ?
      `

    const statement = this.db.prepare(query)
    const result = params.cursor
      ? await statement.bind(params.cursor, fetchLimit).all<MessageRow>()
      : await statement.bind(fetchLimit).all<MessageRow>()

    const rows = result.results ?? []
    const hasMore = rows.length > params.limit
    const slicedRows = rows.slice(0, params.limit)
    return buildCursorPage(slicedRows.map(toMessageDto), hasMore)
  }

  async searchMessages(params: SearchMessagesParams): Promise<CursorPage<MessageDto>> {
    const safeQuery = toFtsMatchQuery(params.q)
    if (!safeQuery) {
      return {
        items: [],
        nextCursor: null,
        prevCursor: null,
      }
    }

    const fetchLimit = params.limit + 1

    const query = params.cursor
      ? `
        SELECT m.id, m.source_row_id, m.message_timestamp, m.author_id, m.author_name, m.content, m.attachments_raw, m.reactions_raw
        FROM messages_fts f
        JOIN messages m ON m.id = f.rowid
        WHERE f.content MATCH ? AND m.id < ?
        ORDER BY m.id DESC
        LIMIT ?
      `
      : `
        SELECT m.id, m.source_row_id, m.message_timestamp, m.author_id, m.author_name, m.content, m.attachments_raw, m.reactions_raw
        FROM messages_fts f
        JOIN messages m ON m.id = f.rowid
        WHERE f.content MATCH ?
        ORDER BY m.id DESC
        LIMIT ?
      `

    const statement = this.db.prepare(query)
    const result = params.cursor
      ? await statement.bind(safeQuery, params.cursor, fetchLimit).all<MessageRow>()
      : await statement.bind(safeQuery, fetchLimit).all<MessageRow>()

    const rows = result.results ?? []
    const hasMore = rows.length > params.limit
    const slicedRows = rows.slice(0, params.limit)
    return buildCursorPage(slicedRows.map(toMessageDto), hasMore)
  }

  async listAuthors(params: ListAuthorsParams): Promise<AuthorDto[]> {
    const query = params.query
      ? `
        SELECT author_id, author_name, COUNT(*) AS message_count
        FROM messages
        WHERE author_name LIKE ? OR author_id LIKE ?
        GROUP BY author_id, author_name
        ORDER BY message_count DESC
        LIMIT ?
      `
      : `
        SELECT author_id, author_name, COUNT(*) AS message_count
        FROM messages
        GROUP BY author_id, author_name
        ORDER BY message_count DESC
        LIMIT ?
      `

    const statement = this.db.prepare(query)
    const searchValue = `%${params.query}%`
    const result = params.query
      ? await statement.bind(searchValue, searchValue, params.limit).all<AuthorRow>()
      : await statement.bind(params.limit).all<AuthorRow>()

    const rows = result.results ?? []
    return rows.map((item) => ({
      authorId: item.author_id,
      authorName: item.author_name,
      messageCount: Number(item.message_count),
    }))
  }
}
