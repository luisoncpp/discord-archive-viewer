import { describe, expect, it } from 'vitest'
import app from '../src/worker'

describe('worker health', () => {
  it('returns ok on /api/health', async () => {
    const response = await app.request('http://localhost/api/health')
    const body = (await response.json()) as { ok: boolean }

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
  })
})
