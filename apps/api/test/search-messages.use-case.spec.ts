import { describe, expect, it, vi } from 'vitest'
import { SearchMessagesUseCase } from '../src/modules/search/search-messages.use-case.js'

describe('SearchMessagesUseCase', () => {
  it('delegates to repository', async () => {
    const repository = {
      searchMessages: vi.fn().mockResolvedValue({
        items: [],
        nextCursor: null,
        prevCursor: null,
      }),
    }

    const useCase = new SearchMessagesUseCase(repository)
    const result = await useCase.execute({ q: 'hola', limit: 10 })

    expect(repository.searchMessages).toHaveBeenCalledWith({ q: 'hola', limit: 10 })
    expect(result.items).toEqual([])
  })
})
