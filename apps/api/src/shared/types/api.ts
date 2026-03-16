export type MessageDto = {
  id: number
  sourceRowId: number
  messageTimestamp: string
  authorId: string
  authorName: string
  content: string | null
  attachmentsRaw: string | null
  reactionsRaw: string | null
}

export type AuthorDto = {
  authorId: string
  authorName: string
  messageCount: number
}

export type CursorPage<T> = {
  items: T[]
  nextCursor: string | null
  prevCursor: string | null
}

export type ApiErrorPayload = {
  code: string
  message: string
  details?: unknown
  requestId?: string
}
