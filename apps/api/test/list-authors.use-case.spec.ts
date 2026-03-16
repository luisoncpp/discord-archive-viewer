import { describe, expect, it, vi } from 'vitest'
import { ListAuthorsUseCase } from '../src/modules/authors/list-authors.use-case.js'

describe('ListAuthorsUseCase', () => {
  it('delegates to repository', async () => {
    const repository = {
      listAuthors: vi.fn().mockResolvedValue([
        {
          authorId: '1',
          authorName: 'alice',
          messageCount: 30,
        },
      ]),
    }

    const useCase = new ListAuthorsUseCase(repository)
    const result = await useCase.execute({ limit: 20, query: 'ali' })

    expect(repository.listAuthors).toHaveBeenCalledWith({ limit: 20, query: 'ali' })
    expect(result[0]?.messageCount).toBe(30)
  })
})
