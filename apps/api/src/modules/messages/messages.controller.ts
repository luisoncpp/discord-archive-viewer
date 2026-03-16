import type { Context } from 'hono'
import { z } from 'zod'
import { HttpError } from '../../shared/errors/http-error'
import type { EnvBindings } from '../../shared/types/env'
import { D1ArchiveRepository } from '../../shared/db/d1-archive-repository'
import { GetMessageContextUseCase } from './get-message-context.use-case'
import { ListMessagesUseCase } from './list-messages.use-case'

const ListMessagesQuerySchema = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  dir: z.enum(['next', 'prev']).default('next'),
  limit: z.coerce.number().int().positive().max(100).default(100),
})

const MessageContextQuerySchema = z.object({
  id: z.coerce.number().int().positive(),
  before: z.coerce.number().int().min(0).max(50).default(10),
  after: z.coerce.number().int().min(0).max(50).default(10),
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

export async function getMessageContextController(
  context: Context<{ Bindings: EnvBindings }>,
): Promise<Response> {
  const parsedQuery = MessageContextQuerySchema.safeParse(context.req.query())
  if (!parsedQuery.success) {
    throw new HttpError(400, {
      code: 'validation_error',
      message: 'Invalid query params for /api/messages/context',
      details: parsedQuery.error.flatten(),
    })
  }

  const repository = new D1ArchiveRepository(context.env.DB)
  const useCase = new GetMessageContextUseCase(repository)
  const result = await useCase.execute({
    messageId: parsedQuery.data.id,
    before: parsedQuery.data.before,
    after: parsedQuery.data.after,
  })

  return context.json(result)
}
