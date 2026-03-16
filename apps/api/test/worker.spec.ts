import { describe, expect, it } from 'vitest'
import app from '../src/worker'
import { clearRateLimitBuckets } from '../src/shared/http/rate-limit.js'

describe('worker health', () => {
  it('returns ok on /api/health', async () => {
    const response = await app.request('http://localhost/api/health')
    const body = (await response.json()) as { ok: boolean }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(response.headers.get('x-request-id')).toBeTruthy()
  })

  it('returns validation error for search without any criteria', async () => {
    clearRateLimitBuckets()
    const response = await app.request('http://localhost/api/search')
    const body = (await response.json()) as { code: string; requestId?: string }

    expect(response.status).toBe(400)
    expect(body.code).toBe('validation_error')
    expect(body.requestId).toBeTruthy()
  })

  it('returns validation error for invalid date range', async () => {
    clearRateLimitBuckets()
    const response = await app.request('http://localhost/api/search?q=hola&from=2024-01-10&to=2024-01-01')
    const body = (await response.json()) as { code: string }

    expect(response.status).toBe(400)
    expect(body.code).toBe('validation_error')
  })

  it('returns validation error for message context without id', async () => {
    const response = await app.request('http://localhost/api/messages/context')
    const body = (await response.json()) as { code: string }

    expect(response.status).toBe(400)
    expect(body.code).toBe('validation_error')
  })

  it('returns 429 when search rate limit is exceeded', async () => {
    clearRateLimitBuckets()

    let response: Response | null = null
    for (let index = 0; index < 11; index += 1) {
      response = await app.request('http://localhost/api/search?q=hola', {
        headers: {
          'cf-connecting-ip': '9.9.9.9',
        },
      })
    }

    const body = (await response?.json()) as { code: string; requestId?: string }
    expect(response?.status).toBe(429)
    expect(body.code).toBe('rate_limit_exceeded')
    expect(body.requestId).toBeTruthy()
    expect(response?.headers.get('retry-after')).toBeTruthy()
  })
})
