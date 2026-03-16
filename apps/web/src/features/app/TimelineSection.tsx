import type { RefObject } from 'react'
import { MessageContent } from '../messages/MessageContent'
import type { MessageDto, MessagesPageDto } from '../../types/api'

type VirtualRow = {
  index: number
  start: number
}

type RowVirtualizerLike = {
  getTotalSize: () => number
  getVirtualItems: () => VirtualRow[]
  measureElement: (node: Element | null) => void
}

type TimelineSectionProps = {
  data: MessagesPageDto
  items: MessageDto[]
  isSearchMode: boolean
  isContextMode: boolean
  highlightedMessageId: number | null
  isLoadingPrevious: boolean
  isLoadingNext: boolean
  scrollRef: RefObject<HTMLDivElement | null>
  rowVirtualizer: RowVirtualizerLike
  onOpenMessageContext: (messageId: number) => void
  onOpenNextMessages: () => void
}

function shouldCompactWithPrevious(messages: MessageDto[], index: number): boolean {
  if (index <= 0) {
    return false
  }

  const current = messages[index]
  const previous = messages[index - 1]
  if (!current || !previous) {
    return false
  }

  if (current.authorId !== previous.authorId) {
    return false
  }

  const currentTime = new Date(current.messageTimestamp).getTime()
  const previousTime = new Date(previous.messageTimestamp).getTime()
  if (Number.isNaN(currentTime) || Number.isNaN(previousTime)) {
    return false
  }

  const diffMs = Math.abs(currentTime - previousTime)
  return diffMs <= 5 * 60 * 1000
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export function TimelineSection({
  data,
  items,
  isSearchMode,
  isContextMode,
  highlightedMessageId,
  isLoadingPrevious,
  isLoadingNext,
  scrollRef,
  rowVirtualizer,
  onOpenMessageContext,
  onOpenNextMessages,
}: TimelineSectionProps) {
  return (
    <section className="discord-messages" aria-label="Mensajes">
      <div ref={scrollRef} className="discord-message-scroller">
        {isLoadingPrevious && !isSearchMode && !isContextMode && (
          <p className="discord-auto-load-indicator discord-auto-load-indicator-top">Cargando más...</p>
        )}

        <div
          className="discord-message-virtual-space"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const message = items[virtualRow.index]
            if (!message) {
              return null
            }

            const isCompact = shouldCompactWithPrevious(items, virtualRow.index)

            return (
              <article
                key={message.id}
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                data-message-id={message.id}
                className={`discord-message-row${isCompact ? ' discord-message-row-compact' : ''}${highlightedMessageId === message.id ? ' discord-message-row-highlighted' : ''}`}
                style={{ transform: `translateY(${virtualRow.start}px)` }}
                onClick={isSearchMode ? () => onOpenMessageContext(message.id) : undefined}
                role={isSearchMode ? 'button' : undefined}
                tabIndex={isSearchMode ? 0 : undefined}
                onKeyDown={
                  isSearchMode
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onOpenMessageContext(message.id)
                        }
                      }
                    : undefined
                }
              >
                {!isCompact ? (
                  <div className="discord-avatar" aria-hidden="true">
                    {message.authorName.slice(0, 1).toUpperCase()}
                  </div>
                ) : (
                  <div className="discord-avatar-spacer" aria-hidden="true" />
                )}

                <div className={`discord-message-body${isCompact ? ' discord-message-body-compact' : ''}`}>
                  {!isCompact && (
                    <header className="discord-message-header">
                      <strong className="discord-author">{message.authorName}</strong>
                      <a
                        className="discord-timestamp discord-timestamp-link"
                        href={`${window.location.pathname}?focus=${message.id}`}
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          onOpenMessageContext(message.id)
                        }}
                      >
                        {formatTimestamp(message.messageTimestamp)}
                      </a>
                    </header>
                  )}

                  <MessageContent
                    content={message.content}
                    attachmentsRaw={message.attachmentsRaw}
                    reactionsRaw={message.reactionsRaw}
                  />
                </div>
              </article>
            )
          })}
        </div>

        {isLoadingNext && !isSearchMode && !isContextMode && (
          <p className="discord-auto-load-indicator discord-auto-load-indicator-bottom">Cargando más...</p>
        )}
      </div>

      {isSearchMode && data.nextCursor && (
        <div className="discord-pagination">
          <button
            type="button"
            className="discord-pagination-button"
            onClick={onOpenNextMessages}
          >
            Siguiente página de resultados
          </button>
        </div>
      )}

      {isSearchMode && data.nextCursor && (
        <div className="discord-pagination">
          <p className="discord-search-hint">Haz click en un resultado para verlo en contexto dentro del timeline.</p>
        </div>
      )}
    </section>
  )
}