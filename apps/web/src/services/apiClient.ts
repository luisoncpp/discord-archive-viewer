import { z } from 'zod'
import {
  ApiErrorSchema,
  AuthorsResponseSchema,
  MessagesPageSchema,
} from '../types/api'

export class ApiClientError extends Error {
  public readonly status: number
  public readonly code: string
  public readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_URL ?? ''
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const url = new URL(path, getApiBaseUrl() || window.location.origin)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === '') {
        continue
      }
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

async function requestJson<T>(url: string, schema: z.ZodSchema<T>): Promise<T> {
  const response = await fetch(url)
  const contentType = response.headers.get('content-type') ?? ''
  const isJsonResponse = contentType.includes('application/json')

  if (!response.ok) {
    let errorBody: unknown = null
    if (!isJsonResponse) {
      throw new ApiClientError(
        response.status,
        'non_json_response',
        `Request failed: ${response.status}. Expected JSON but received ${contentType || 'unknown content type'}`,
      )
    }

    try {
      errorBody = await response.json()
    } catch {
      throw new ApiClientError(response.status, 'http_error', `Request failed: ${response.status}`)
    }

    const parsedError = ApiErrorSchema.safeParse(errorBody)
    if (parsedError.success) {
      throw new ApiClientError(
        response.status,
        parsedError.data.code,
        parsedError.data.message,
        parsedError.data.details,
      )
    }

    throw new ApiClientError(response.status, 'http_error', `Request failed: ${response.status}`)
  }

  if (!isJsonResponse) {
    throw new ApiClientError(
      response.status,
      'non_json_response',
      `Expected JSON but received ${contentType || 'unknown content type'}`,
    )
  }

  const jsonData: unknown = await response.json()
  return schema.parse(jsonData)
}

export type ListMessagesInput = {
  cursor?: string
  dir?: 'next' | 'prev'
  limit?: number
}

export async function listMessages(input: ListMessagesInput = {}) {
  const url = buildUrl('/api/messages', {
    cursor: input.cursor,
    dir: input.dir ?? 'next',
    limit: input.limit ?? 100,
  })

  return requestJson(url, MessagesPageSchema)
}

export type SearchMessagesInput = {
  q?: string
  cursor?: string
  limit?: number
  author?: string
  from?: string
  to?: string
}

export async function searchMessages(input: SearchMessagesInput) {
  const url = buildUrl('/api/search', {
    q: input.q,
    cursor: input.cursor,
    limit: input.limit ?? 50,
    author: input.author,
    from: input.from,
    to: input.to,
  })

  return requestJson(url, MessagesPageSchema)
}

export type ListAuthorsInput = {
  query?: string
  limit?: number
}

export async function listAuthors(input: ListAuthorsInput = {}) {
  const url = buildUrl('/api/authors', {
    query: input.query,
    limit: input.limit ?? 50,
  })

  return requestJson(url, AuthorsResponseSchema)
}
