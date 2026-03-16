import { describe, expect, it } from 'vitest'
import app from '../src/worker'

describe('worker health', () => {
  it('returns ok on /api/health', async () => {
    const response = await app.request('http://localhost/api/health')
    const body = (await response.json()) as { ok: boolean }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
  })

  it('returns validation error for search without any criteria', async () => {
    const response = await app.request('http://localhost/api/search')
    const body = (await response.json()) as { code: string }

    expect(response.status).toBe(400)
    expect(body.code).toBe('validation_error')
  })

  it('returns validation error for invalid date range', async () => {
    const response = await app.request('http://localhost/api/search?q=hola&from=2024-01-10&to=2024-01-01')
    const body = (await response.json()) as { code: string }

    expect(response.status).toBe(400)
    expect(body.code).toBe('validation_error')
  })
})
