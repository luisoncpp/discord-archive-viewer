import { z } from 'zod'

export const MessageSchema = z.object({
  id: z.number(),
  sourceRowId: z.number(),
  messageTimestamp: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  content: z.string().nullable(),
  attachmentsRaw: z.string().nullable(),
  reactionsRaw: z.string().nullable(),
})

export const CursorPageSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    prevCursor: z.string().nullable(),
  })

export const AuthorsResponseSchema = z.object({
  items: z.array(
    z.object({
      authorId: z.string(),
      authorName: z.string(),
      messageCount: z.number(),
    }),
  ),
})

export const MessagesPageSchema = CursorPageSchema(MessageSchema)

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
})

export type MessageDto = z.infer<typeof MessageSchema>
export type MessagesPageDto = z.infer<typeof MessagesPageSchema>
export type AuthorDto = z.infer<typeof AuthorsResponseSchema>['items'][number]
