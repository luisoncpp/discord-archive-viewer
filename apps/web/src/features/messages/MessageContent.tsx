import { findFirstEligibleEmbed } from './embeds'
import { renderDiscordMarkdown } from './markdown'
import { parseReactionsRaw } from './reactions'

type MessageContentProps = {
  content: string | null
  attachmentsRaw: string | null
  reactionsRaw: string | null
}

export function MessageContent({ content, attachmentsRaw, reactionsRaw }: MessageContentProps) {
  const normalizedContent = content?.trim() ?? ''
  const embed = findFirstEligibleEmbed({
    content,
    attachmentsRaw,
  })
  const reactions = parseReactionsRaw(reactionsRaw)

  return (
    <div className="message-content">
      {normalizedContent ? (
        <div data-testid="message-markdown" className="message-markdown">
          {renderDiscordMarkdown(normalizedContent)}
        </div>
      ) : (
        <p data-testid="message-no-content" className="message-empty-content">
          (sin texto)
        </p>
      )}

      {embed && (
        <div data-testid="message-embed" className="message-embed">
          {embed.type === 'image' ? (
            <img
              src={embed.url}
              alt="Embedded image"
              loading="lazy"
              className="message-embed-image"
            />
          ) : (
            <div className="message-embed-youtube">
              <iframe
                title={`YouTube video ${embed.videoId}`}
                src={embed.embedUrl}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="message-embed-iframe"
              />
              <p className="message-embed-link">
                <a href={embed.url} target="_blank" rel="noreferrer noopener">
                  Abrir video original
                </a>
              </p>
            </div>
          )}
        </div>
      )}

      {reactions.length > 0 && (
        <div className="message-reactions" data-testid="message-reactions">
          {reactions.map((reaction) => (
            <span key={`${reaction.emoji}-${reaction.count}`} className="message-reaction-pill">
              <span className="message-reaction-emoji">{reaction.emoji}</span>
              <span className="message-reaction-count">{reaction.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
