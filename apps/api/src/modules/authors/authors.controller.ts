import type { Context } from 'hono'
import { z } from 'zod'
import { HttpError } from '../../shared/errors/http-error'
import type { EnvBindings } from '../../shared/types/env'
import { D1ArchiveRepository } from '../../shared/db/d1-archive-repository'
import { ListAuthorsUseCase } from './list-authors.use-case'

const ListAuthorsQuerySchema = z.object({
  query: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().positive().max(50).default(50),
})

export async function listAuthorsController(
  context: Context<{ Bindings: EnvBindings }>,
): Promise<Response> {
  const parsedQuery = ListAuthorsQuerySchema.safeParse(context.req.query())
  if (!parsedQuery.success) {
    throw new HttpError(400, {
      code: 'validation_error',
      message: 'Invalid query params for /api/authors',
      details: parsedQuery.error.flatten(),
    })
  }

  const repository = new D1ArchiveRepository(context.env.DB)
  const useCase = new ListAuthorsUseCase(repository)
  const result = await useCase.execute(parsedQuery.data)

  return context.json({ items: result })
}
