import { extractUrlsFromText } from './markdown'

const IMAGE_EXTENSION_PATTERN = /\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?.*)?$/i

export type MessageEmbed =
  | {
      type: 'image'
      url: string
    }
  | {
      type: 'youtube'
      url: string
      embedUrl: string
      videoId: string
    }
  | {
      type: 'tenor'
      url: string
      embedUrl: string
      gifId: string
    }

type AttachmentLike =
  | string
  | {
      url?: string
      proxy_url?: string
      attachment_url?: string
    }

type EmbedInput = {
  content: string | null
  attachmentsRaw: string | null
}

function isImageUrl(url: string): boolean {
  return IMAGE_EXTENSION_PATTERN.test(url)
}

function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase()

    if (host === 'youtu.be') {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0]
      return id || null
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        const id = parsed.searchParams.get('v')
        return id || null
      }

      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.replace('/shorts/', '').split('/')[0]
        return id || null
      }
    }

    return null
  } catch {
    return null
  }
}

function extractTenorGifId(url: string): string | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase()
    if (host !== 'tenor.com' && host !== 'tenor.co') {
      return null
    }

    const match = parsed.pathname.match(/-gif-(\d+)(?:$|\/)/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

function parseAttachmentCandidates(attachmentsRaw: string | null): string[] {
  if (!attachmentsRaw) {
    return []
  }

  try {
    const parsed = JSON.parse(attachmentsRaw) as unknown

    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (typeof item === 'string') {
            return item
          }

          if (!item || typeof item !== 'object') {
            return null
          }

          const attachment = item as Exclude<AttachmentLike, string>
          return attachment.url ?? attachment.proxy_url ?? attachment.attachment_url ?? null
        })
        .filter((url): url is string => typeof url === 'string' && url.length > 0)
    }

    return []
  } catch {
    return []
  }
}

export function findFirstEligibleEmbed(input: EmbedInput): MessageEmbed | null {
  const attachmentUrls = parseAttachmentCandidates(input.attachmentsRaw)
  const contentUrls = input.content ? extractUrlsFromText(input.content) : []

  const visited = new Set<string>()
  const candidates = [...attachmentUrls, ...contentUrls].filter((url) => {
    if (visited.has(url)) {
      return false
    }
    visited.add(url)
    return true
  })

  for (const url of candidates) {
    if (isImageUrl(url)) {
      return {
        type: 'image',
        url,
      }
    }

    const videoId = extractYouTubeVideoId(url)
    if (videoId) {
      return {
        type: 'youtube',
        url,
        videoId,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
      }
    }

    const gifId = extractTenorGifId(url)
    if (gifId) {
      return {
        type: 'tenor',
        url,
        gifId,
        embedUrl: `https://tenor.com/embed/${gifId}`,
      }
    }
  }

  return null
}
