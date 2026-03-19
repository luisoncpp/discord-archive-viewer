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

type SharePreviewMessageRow = {
  id: number
  author_name: string
  content: string | null
  message_timestamp: string
}

function createRequestId(): string {
  return crypto.randomUUID()
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizePreviewText(value: string | null): string {
  if (!value) {
    return 'Sin contenido'
  }

  return value.replace(/\s+/g, ' ').trim() || 'Sin contenido'
}

function toDdMmYyyy(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '00/00/0000'
  }

  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const year = String(date.getUTCFullYear())
  return `${day}/${month}/${year}`
}

function toFocusedPreviewText(message: SharePreviewMessageRow): string {
  const author = normalizePreviewText(message.author_name)
  const content = normalizePreviewText(message.content).replace(/[.!?\s]+$/g, '')
  const date = toDdMmYyyy(message.message_timestamp)
  return `${author}: ${content}. ${date}`
}

function renderShareHtml(options: {
  title: string
  description: string
  landingUrl: string
}): string {
  const title = escapeHtml(options.title)
  const description = escapeHtml(options.description)
  const landingUrl = escapeHtml(options.landingUrl)

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta http-equiv="refresh" content="0;url=${landingUrl}" />
    <link rel="canonical" href="${landingUrl}" />
  </head>
  <body>
    <p><a href="${landingUrl}">Abrir mensaje en Cenotafio</a></p>
  </body>
</html>`
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

app.get('/share', async (context) => {
  const requestUrl = new URL(context.req.url)
  const focusParam = requestUrl.searchParams.get('focus') ?? requestUrl.searchParams.get('id')
  const focusId = Number(focusParam)

  if (!focusParam || !Number.isInteger(focusId) || focusId <= 0) {
    throw new HttpError(400, {
      code: 'validation_error',
      message: 'Invalid query params for /share. Expected positive integer focus.',
      details: {
        focus: focusParam,
      },
    })
  }

  const row = await context.env.DB
    .prepare(
      `
        SELECT id, author_name, content, message_timestamp
        FROM messages
        WHERE id = ?
        LIMIT 1
      `,
    )
    .bind(focusId)
    .first<SharePreviewMessageRow>()

  const landingUrl = `${requestUrl.origin}/?focus=${focusId}`
  if (!row) {
    return new Response(
      renderShareHtml({
        title: 'Cenotafio',
        description: 'El Cenotafio de Sillonio',
        landingUrl,
      }),
      {
        status: 404,
        headers: {
          'content-type': 'text/html; charset=utf-8',
        },
      },
    )
  }

  const previewText = toFocusedPreviewText(row)
  return new Response(
    renderShareHtml({
      title: previewText,
      description: previewText,
      landingUrl,
    }),
    {
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
    },
  )
})

app.get('/api/messages/context', getMessageContextController)
app.get('/api/messages', listMessagesController)
app.get('/api/search', searchMessagesController)
app.get('/api/authors', listAuthorsController)

export default app
