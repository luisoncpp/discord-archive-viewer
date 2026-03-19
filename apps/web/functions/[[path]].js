function parseProxyBase(env) {
  const value = env.SHARE_PROXY_BASE_URL || env.VITE_SHARE_URL || env.VITE_API_URL
  if (!value) {
    return null
  }

  try {
    return new URL(value)
  } catch {
    return null
  }
}

function isSocialCrawler(userAgent) {
  const value = (userAgent || '').toLowerCase()
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

export async function onRequest(context) {
  const requestUrl = new URL(context.request.url)
  const focus = requestUrl.searchParams.get('focus') || requestUrl.searchParams.get('id')
  const isSharePath = requestUrl.pathname === '/' || requestUrl.pathname === '/share'
  const forcePreview = requestUrl.searchParams.get('__preview') === '1'
  const isCrawler = forcePreview || isSocialCrawler(context.request.headers.get('user-agent'))

  if (!focus || !isSharePath) {
    return context.next()
  }

  if (!isCrawler) {
    if (requestUrl.pathname === '/share') {
      const redirectUrl = new URL('/', requestUrl.origin)
      redirectUrl.searchParams.set('focus', focus)
      return Response.redirect(redirectUrl.toString(), 302)
    }

    return context.next()
  }

  const proxyBase = parseProxyBase(context.env)
  if (!proxyBase) {
    return context.next()
  }

  const upstreamUrl = new URL('/share', proxyBase)
  upstreamUrl.searchParams.set('focus', focus)

  const upstreamResponse = await fetch(upstreamUrl.toString(), {
    headers: {
      'user-agent': context.request.headers.get('user-agent') || 'Mozilla/5.0',
      accept: context.request.headers.get('accept') || 'text/html',
    },
  })

  const body = await upstreamResponse.text()
  const headers = new Headers(upstreamResponse.headers)
  headers.set('content-type', 'text/html; charset=utf-8')

  return new Response(body, {
    status: upstreamResponse.status,
    headers,
  })
}
