import type { ApiErrorPayload } from '../types/api'

export class HttpError extends Error {
  public readonly status: number
  public readonly payload: ApiErrorPayload

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message)
    this.status = status
    this.payload = payload
  }
}
