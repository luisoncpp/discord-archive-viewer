import { Hono } from 'hono'
import { listAuthorsController } from './modules/authors/authors.controller'
import { getMessageContextController, listMessagesController } from './modules/messages/messages.controller'
import { searchMessagesController } from './modules/search/search.controller'
import { HttpError } from './shared/errors/http-error'
import type { EnvBindings } from './shared/types/env'

const app = new Hono<{ Bindings: EnvBindings }>()

app.onError((error, context) => {
  if (error instanceof HttpError) {
    return new Response(JSON.stringify(error.payload), {
      status: error.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    })
  }

  return context.json(
    {
      code: 'internal_error',
      message: 'Unexpected error while handling request',
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
