import type { AuthorDto } from '../../shared/types/api'

export type ListAuthorsParams = {
  query?: string
  limit: number
}

export interface ListAuthorsRepository {
  listAuthors(params: ListAuthorsParams): Promise<AuthorDto[]>
}

export class ListAuthorsUseCase {
  private readonly repository: ListAuthorsRepository

  constructor(repository: ListAuthorsRepository) {
    this.repository = repository
  }

  async execute(params: ListAuthorsParams): Promise<AuthorDto[]> {
    return this.repository.listAuthors(params)
  }
}
