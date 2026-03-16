import type { CursorPage, MessageDto } from '../../shared/types/api'

export type SearchMessagesParams = {
  q: string
  cursor?: number
  limit: number
}

export interface SearchMessagesRepository {
  searchMessages(params: SearchMessagesParams): Promise<CursorPage<MessageDto>>
}

export class SearchMessagesUseCase {
  private readonly repository: SearchMessagesRepository

  constructor(repository: SearchMessagesRepository) {
    this.repository = repository
  }

  async execute(params: SearchMessagesParams): Promise<CursorPage<MessageDto>> {
    return this.repository.searchMessages(params)
  }
}
