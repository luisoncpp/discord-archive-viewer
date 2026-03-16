import type { CursorPage, MessageDto } from '../../shared/types/api'

export type ListMessagesParams = {
  cursor?: number
  dir: 'next' | 'prev'
  limit: number
}

export interface ListMessagesRepository {
  listMessages(params: ListMessagesParams): Promise<CursorPage<MessageDto>>
}

export class ListMessagesUseCase {
  private readonly repository: ListMessagesRepository

  constructor(repository: ListMessagesRepository) {
    this.repository = repository
  }

  async execute(params: ListMessagesParams): Promise<CursorPage<MessageDto>> {
    return this.repository.listMessages(params)
  }
}
