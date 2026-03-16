import { describe, expect, it, vi, afterEach } from 'vitest'
import { ApiClientError, listMessages } from '../services/apiClient'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('apiClient', () => {
  it('parses valid messages page response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 1,
              sourceRowId: 1,
              messageTimestamp: '2020-01-01T00:00:00.000Z',
              authorId: '123',
              authorName: 'alice',
              content: 'hola',
              attachmentsRaw: null,
              reactionsRaw: null,
            },
          ],
          nextCursor: '2',
          prevCursor: '1',
        }),
        { status: 200 },
      ),
    )

    const result = await listMessages({ limit: 1 })
    expect(result.items[0]?.authorName).toBe('alice')
  })

  it('throws typed ApiClientError on HTTP error payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'validation_error',
          message: 'Invalid query',
        }),
        { status: 400 },
      ),
    )

    try {
      await listMessages()
      throw new Error('Expected listMessages to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiClientError)
      expect(error).toMatchObject({
        status: 400,
        code: 'validation_error',
      })
    }
  })

  it('rejects invalid response payload via zod', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'bad-id',
            },
          ],
          nextCursor: null,
          prevCursor: null,
        }),
        { status: 200 },
      ),
    )

    await expect(listMessages()).rejects.toBeTruthy()
  })
})
