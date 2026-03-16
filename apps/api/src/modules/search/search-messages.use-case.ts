import type { CursorPage, MessageDto } from '../../shared/types/api'

export type SearchMessagesParams = {
  q?: string
  cursor?: number
  limit: number
  author?: string
  fromDate?: string
  toDate?: string
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
