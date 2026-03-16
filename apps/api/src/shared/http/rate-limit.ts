type Bucket = {
  count: number
  resetAt: number
}

const SEARCH_RATE_LIMIT_MAX = 10
const SEARCH_RATE_LIMIT_WINDOW_MS = 60_000
const buckets = new Map<string, Bucket>()

function getClientKey(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for') ??
    request.headers.get('x-real-ip') ??
    'anonymous'
  )
}

function getOrCreateBucket(key: string, now: number): Bucket {
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    const freshBucket: Bucket = {
      count: 0,
      resetAt: now + SEARCH_RATE_LIMIT_WINDOW_MS,
    }
    buckets.set(key, freshBucket)
    return freshBucket
  }

  return existing
}

export function consumeSearchRateLimit(request: Request, now = Date.now()) {
  const clientKey = getClientKey(request)
  const bucket = getOrCreateBucket(clientKey, now)
  bucket.count += 1

  if (bucket.count > SEARCH_RATE_LIMIT_MAX) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      remaining: 0,
      limit: SEARCH_RATE_LIMIT_MAX,
    }
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, SEARCH_RATE_LIMIT_MAX - bucket.count),
    limit: SEARCH_RATE_LIMIT_MAX,
  }
}

export function clearRateLimitBuckets() {
  buckets.clear()
}
