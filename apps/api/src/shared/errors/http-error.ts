import type { ApiErrorPayload } from '../types/api'

export class HttpError extends Error {
  public readonly status: number
  public readonly payload: ApiErrorPayload
  public readonly headers?: Record<string, string>

  constructor(status: number, payload: ApiErrorPayload, headers?: Record<string, string>) {
    super(payload.message)
    this.status = status
    this.payload = payload
    this.headers = headers
  }
}
