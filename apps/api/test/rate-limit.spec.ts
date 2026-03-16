import { beforeEach, describe, expect, it } from 'vitest'
import { clearRateLimitBuckets, consumeSearchRateLimit } from '../src/shared/http/rate-limit.js'

describe('consumeSearchRateLimit', () => {
  beforeEach(() => {
    clearRateLimitBuckets()
  })

  it('allows requests under the limit', () => {
    const request = new Request('http://localhost/api/search', {
      headers: {
        'cf-connecting-ip': '1.1.1.1',
      },
    })

    const result = consumeSearchRateLimit(request, 0)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(9)
  })

  it('blocks requests over the limit', () => {
    const request = new Request('http://localhost/api/search', {
      headers: {
        'cf-connecting-ip': '2.2.2.2',
      },
    })

    for (let index = 0; index < 10; index += 1) {
      consumeSearchRateLimit(request, 0)
    }

    const blocked = consumeSearchRateLimit(request, 0)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })
})
