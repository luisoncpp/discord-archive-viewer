import type { Context } from 'hono'
import { z } from 'zod'
import { HttpError } from '../../shared/errors/http-error'
import type { EnvBindings } from '../../shared/types/env'
import { D1ArchiveRepository } from '../../shared/db/d1-archive-repository'
import { SearchMessagesUseCase } from './search-messages.use-case'

const SearchQuerySchema = z
  .object({
    q: z.string().trim().min(2).max(200).optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(50).default(50),
  author: z.string().trim().min(1).max(100).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .refine((value) => Boolean(value.q || value.author || value.from || value.to), {
    message: 'At least one search criterion is required',
  })

export async function searchMessagesController(
  context: Context<{ Bindings: EnvBindings }>,
): Promise<Response> {
  const parsedQuery = SearchQuerySchema.safeParse(context.req.query())
  if (!parsedQuery.success) {
    throw new HttpError(400, {
      code: 'validation_error',
      message: 'Invalid query params for /api/search',
      details: parsedQuery.error.flatten(),
    })
  }

  if (parsedQuery.data.from && parsedQuery.data.to && parsedQuery.data.from > parsedQuery.data.to) {
    throw new HttpError(400, {
      code: 'validation_error',
      message: 'from cannot be greater than to',
    })
  }

  try {
    const repository = new D1ArchiveRepository(context.env.DB)
    const useCase = new SearchMessagesUseCase(repository)
    const result = await useCase.execute({
      q: parsedQuery.data.q,
      cursor: parsedQuery.data.cursor,
      limit: parsedQuery.data.limit,
      author: parsedQuery.data.author,
      fromDate: parsedQuery.data.from,
      toDate: parsedQuery.data.to,
    })

    return context.json(result)
  } catch (error) {
    throw new HttpError(400, {
      code: 'search_query_error',
      message: 'Search query could not be executed',
      details: error instanceof Error ? error.message : 'unknown_error',
    })
  }
}
