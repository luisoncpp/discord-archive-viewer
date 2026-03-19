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

  it('returns dynamic social preview for focused message on /share', async () => {
    const env = {
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({
              id: 42,
              author_name: 'Sillonio',
              content: 'Mensaje de prueba',
              message_timestamp: '2026-03-18T12:30:00.000Z',
            }),
          }),
        }),
      },
      APP_NAME: 'discord-archive-api',
    } as unknown as { DB: D1Database; APP_NAME: string }

    const response = await app.request('http://localhost/share?focus=42', undefined, env)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(body).toContain('Sillonio: Mensaje de prueba. 18/03/2026')
    expect(body).toContain('property="og:title"')
    expect(body).toContain('name="twitter:title"')
  })

  it('returns dynamic social preview for focused message on /?focus', async () => {
    const env = {
      DB: {
        prepare: () => ({
          bind: () => ({
            first: async () => ({
              id: 43,
              author_name: 'TacoBailador',
              content: 'por ahora',
              message_timestamp: '2017-10-23T10:00:00.000Z',
            }),
          }),
        }),
      },
      APP_NAME: 'discord-archive-api',
    } as unknown as { DB: D1Database; APP_NAME: string }

    const response = await app.request('http://localhost/?focus=43', undefined, env)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')
    expect(body).toContain('TacoBailador: por ahora. 23/10/2017')
    expect(body).toContain('<h1>TacoBailador: por ahora. 23/10/2017</h1>')
  })
})
