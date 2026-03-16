import type { CursorPage, MessageDto } from '../../shared/types/api'

export type GetMessageContextParams = {
  messageId: number
  before: number
  after: number
}

export interface MessageContextRepository {
  getMessageContext(params: GetMessageContextParams): Promise<CursorPage<MessageDto>>
}

export class GetMessageContextUseCase {
  private readonly repository: MessageContextRepository

  constructor(repository: MessageContextRepository) {
    this.repository = repository
  }

  async execute(params: GetMessageContextParams): Promise<CursorPage<MessageDto>> {
    return this.repository.getMessageContext(params)
  }
}
