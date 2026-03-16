import type { Context } from 'hono'
import { z } from 'zod'
import { HttpError } from '../../shared/errors/http-error'
import type { EnvBindings } from '../../shared/types/env'
import { D1ArchiveRepository } from '../../shared/db/d1-archive-repository'
import { ListMessagesUseCase } from './list-messages.use-case'

const ListMessagesQuerySchema = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  dir: z.enum(['next', 'prev']).default('next'),
  limit: z.coerce.number().int().positive().max(100).default(100),
})

export async function listMessagesController(
  context: Context<{ Bindings: EnvBindings }>,
): Promise<Response> {
  const parsedQuery = ListMessagesQuerySchema.safeParse(context.req.query())
  if (!parsedQuery.success) {
    throw new HttpError(400, {
      code: 'validation_error',
      message: 'Invalid query params for /api/messages',
      details: parsedQuery.error.flatten(),
    })
  }

  const repository = new D1ArchiveRepository(context.env.DB)
  const useCase = new ListMessagesUseCase(repository)
  const result = await useCase.execute(parsedQuery.data)

  return context.json(result)
}
