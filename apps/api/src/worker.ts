import { Hono } from 'hono'

const app = new Hono()

app.get('/api/health', (context) => {
  return context.json({
    ok: true,
    service: 'api',
    runtime: 'cloudflare-workers',
  })
})

app.get('/api/messages', (context) => {
  return context.json({
    items: [],
    nextCursor: null,
    prevCursor: null,
    note: 'Fase 0 placeholder',
  })
})

export default app
