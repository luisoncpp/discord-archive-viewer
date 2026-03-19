import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const LOCAL_API_ORIGIN = 'http://127.0.0.1:8787'

function isSocialCrawler(userAgent: string): boolean {
  const value = userAgent.toLowerCase()
  return [
    'discordbot',
    'twitterbot',
    'slackbot',
    'facebookexternalhit',
    'linkedinbot',
    'whatsapp',
    'telegrambot',
  ].some((token) => value.includes(token))
}

function focusPreviewProxyPlugin() {
  return {
    name: 'focus-preview-proxy',
    configureServer(server: { middlewares: { use: (handler: (req: { method?: string; url?: string }, res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string) => void }, next: () => void) => void) => void } }) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' || !req.url) {
          next()
          return
        }

        const requestUrl = new URL(req.url, 'http://localhost')
        const focus = requestUrl.searchParams.get('focus') ?? requestUrl.searchParams.get('id')
        const userAgent = (req as { headers?: { 'user-agent'?: string } }).headers?.['user-agent'] ?? ''
        const forcePreview = requestUrl.searchParams.get('__preview') === '1'
        const isCrawler = forcePreview || isSocialCrawler(userAgent)

        if (!focus) {
          next()
          return
        }

        if (requestUrl.pathname === '/share' && !isCrawler) {
          res.statusCode = 302
          res.setHeader('Location', `/?focus=${encodeURIComponent(focus)}`)
          res.end()
          return
        }

        if (requestUrl.pathname !== '/' && requestUrl.pathname !== '/share') {
          next()
          return
        }

        if (!isCrawler) {
          next()
          return
        }

        const upstreamUrl = new URL('/share', LOCAL_API_ORIGIN)
        upstreamUrl.searchParams.set('focus', focus)

        try {
          const upstreamResponse = await fetch(upstreamUrl)
          const html = await upstreamResponse.text()

          res.statusCode = upstreamResponse.status
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(html)
          return
        } catch {
          res.statusCode = 502
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end('No se pudo obtener preview desde la API local (http://127.0.0.1:8787).')
          return
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), focusPreviewProxyPlugin()],
  server: {
    proxy: {
      '/share': {
        target: LOCAL_API_ORIGIN,
        changeOrigin: true,
      },
      '/api': {
        target: LOCAL_API_ORIGIN,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
})
