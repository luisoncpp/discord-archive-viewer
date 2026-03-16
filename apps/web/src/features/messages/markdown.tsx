import { Fragment, type ReactNode } from 'react'

const URL_PATTERN = /https?:\/\/[^\s<]+/g
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
const INLINE_TOKEN_PATTERN = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(~~[^~\n]+~~)|(\*[^*\n]+\*)|(\[[^\]]+\]\(https?:\/\/[^\s)]+\))|(https?:\/\/[^\s<]+)/g

function trimTrailingPunctuation(url: string): string {
  return url.replace(/[.,!?;:]+$/g, '')
}

function normalizeUrl(url: string): string | null {
  const trimmed = trimTrailingPunctuation(url)
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let cursor = 0
  let tokenIndex = 0

  for (const tokenMatch of text.matchAll(INLINE_TOKEN_PATTERN)) {
    const raw = tokenMatch[0]
    if (!raw) {
      continue
    }

    const start = tokenMatch.index ?? 0
    if (start > cursor) {
      nodes.push(text.slice(cursor, start))
    }

    if (raw.startsWith('`') && raw.endsWith('`')) {
      nodes.push(<code key={`code-${tokenIndex}`}>{raw.slice(1, -1)}</code>)
    } else if (raw.startsWith('**') && raw.endsWith('**')) {
      nodes.push(<strong key={`strong-${tokenIndex}`}>{raw.slice(2, -2)}</strong>)
    } else if (raw.startsWith('~~') && raw.endsWith('~~')) {
      nodes.push(<s key={`strike-${tokenIndex}`}>{raw.slice(2, -2)}</s>)
    } else if (raw.startsWith('*') && raw.endsWith('*')) {
      nodes.push(<em key={`em-${tokenIndex}`}>{raw.slice(1, -1)}</em>)
    } else if (raw.startsWith('[')) {
      const match = MARKDOWN_LINK_PATTERN.exec(raw)
      MARKDOWN_LINK_PATTERN.lastIndex = 0
      const label = match?.[1]
      const href = normalizeUrl(match?.[2] ?? '')
      if (label && href) {
        nodes.push(
          <a key={`md-link-${tokenIndex}`} href={href} target="_blank" rel="noreferrer noopener">
            {label}
          </a>,
        )
      } else {
        nodes.push(raw)
      }
    } else {
      const href = normalizeUrl(raw)
      if (href) {
        nodes.push(
          <a key={`link-${tokenIndex}`} href={href} target="_blank" rel="noreferrer noopener">
            {href}
          </a>,
        )
      } else {
        nodes.push(raw)
      }
    }

    cursor = start + raw.length
    tokenIndex += 1
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor))
  }

  return nodes
}

export function extractUrlsFromText(content: string): string[] {
  const urls: string[] = []
  for (const match of content.matchAll(URL_PATTERN)) {
    const value = match[0]
    if (!value) {
      continue
    }

    const normalized = normalizeUrl(value)
    if (normalized) {
      urls.push(normalized)
    }
  }
  return urls
}

export function renderDiscordMarkdown(content: string): ReactNode[] {
  const lines = content.split('\n')
  const nodes: ReactNode[] = []
  let inCodeBlock = false
  let codeFenceLang = ''
  let codeBuffer: string[] = []
  let keyCounter = 0

  const flushCodeBlock = () => {
    nodes.push(
      <pre key={`pre-${keyCounter++}`}>
        <code className={codeFenceLang ? `language-${codeFenceLang}` : undefined}>
          {codeBuffer.join('\n')}
        </code>
      </pre>,
    )
    codeBuffer = []
    codeFenceLang = ''
  }

  for (const line of lines) {
    const fence = line.match(/^```(\w+)?\s*$/)
    if (fence) {
      if (inCodeBlock) {
        flushCodeBlock()
      } else {
        codeFenceLang = fence[1] ?? ''
      }
      inCodeBlock = !inCodeBlock
      continue
    }

    if (inCodeBlock) {
      codeBuffer.push(line)
      continue
    }

    if (!line.trim()) {
      nodes.push(<br key={`br-${keyCounter++}`} />)
      continue
    }

    nodes.push(
      <p key={`p-${keyCounter++}`}>
        {renderInline(line).map((node, index) => (
          <Fragment key={`fragment-${keyCounter}-${index}`}>{node}</Fragment>
        ))}
      </p>,
    )
  }

  if (inCodeBlock && codeBuffer.length > 0) {
    flushCodeBlock()
  }

  return nodes
}
