import { describe, expect, it, vi } from 'vitest'
import type { CursorPage, MessageDto } from '../src/shared/types/api.js'
import { ListMessagesUseCase } from '../src/modules/messages/list-messages.use-case.js'

describe('ListMessagesUseCase', () => {
  it('delegates to repository', async () => {
    const response: CursorPage<MessageDto> = {
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
      nextCursor: null,
      prevCursor: '1',
    }

    const repository = {
      listMessages: vi.fn().mockResolvedValue(response),
    }

    const useCase = new ListMessagesUseCase(repository)
    const result = await useCase.execute({ dir: 'next', limit: 50 })

    expect(repository.listMessages).toHaveBeenCalledTimes(1)
    expect(result.items.length).toBe(1)
    expect(result.items[0]?.authorName).toBe('alice')
  })
})
