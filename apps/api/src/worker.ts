import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { listAuthorsController } from './modules/authors/authors.controller'
import { getMessageContextController, listMessagesController } from './modules/messages/messages.controller'
import { searchMessagesController } from './modules/search/search.controller'
import { HttpError } from './shared/errors/http-error'
import { consumeSearchRateLimit } from './shared/http/rate-limit'
import type { EnvBindings } from './shared/types/env'

type AppVariables = {
  requestId: string
  startedAt: number
}

function createRequestId(): string {
  return crypto.randomUUID()
}

const app = new Hono<{ Bindings: EnvBindings; Variables: AppVariables }>()

app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  maxAge: 86400,
}))

app.use('*', async (context, next) => {
  const requestId = createRequestId()
  const startedAt = Date.now()

  context.set('requestId', requestId)
  context.set('startedAt', startedAt)

  await next()

  const durationMs = Date.now() - startedAt
  context.header('x-request-id', requestId)
  context.header('server-timing', `app;dur=${durationMs}`)

  console.log(
    JSON.stringify({
      level: 'info',
      requestId,
      method: context.req.method,
      path: new URL(context.req.url).pathname,
      status: context.res.status,
      durationMs,
    }),
  )
})

app.use('/api/search', async (context, next) => {
  const rateLimit = consumeSearchRateLimit(context.req.raw)
  context.header('x-ratelimit-limit', String(rateLimit.limit))
  context.header('x-ratelimit-remaining', String(rateLimit.remaining))

  if (!rateLimit.allowed) {
    throw new HttpError(429, {
      code: 'rate_limit_exceeded',
      message: 'Too many search requests. Please retry later.',
      details: {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
    }, {
      'retry-after': String(rateLimit.retryAfterSeconds),
    })
  }

  await next()
})

app.onError((error, context) => {
  const requestId = context.get('requestId')

  if (error instanceof HttpError) {
    return new Response(JSON.stringify({ ...error.payload, requestId }), {
      status: error.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-request-id': requestId,
        ...error.headers,
      },
    })
  }

  return context.json(
    {
      code: 'internal_error',
      message: 'Unexpected error while handling request',
      requestId,
    },
    500,
  )
})

app.get('/api/health', (context) => {
  return context.json({
    ok: true,
    service: 'api',
    runtime: 'cloudflare-workers',
  })
})

app.get('/api/messages/context', getMessageContextController)
app.get('/api/messages', listMessagesController)
app.get('/api/search', searchMessagesController)
app.get('/api/authors', listAuthorsController)

export default app
