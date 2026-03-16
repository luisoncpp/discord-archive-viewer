import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { MessageContent } from './features/messages/MessageContent'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { useMessageContext } from './hooks/useMessageContext'
import { useMessagesFeed } from './hooks/useMessagesFeed'
import { useSearchMessages } from './hooks/useSearchMessages'
import type { MessageDto } from './types/api'
import './App.css'

const FEED_PAGE_SIZE = 20
const AUTO_LOAD_EDGE_THRESHOLD = 160

function parsePositiveInt(value: string | null): number | null {
  if (!value) {
    return null
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
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

function App() {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), [])
  const initialFocusId = parsePositiveInt(initialParams.get('focus'))
  const [query, setQuery] = useState(initialParams.get('q') ?? '')
  const [authorFilter, setAuthorFilter] = useState(initialParams.get('author') ?? '')
  const [fromDate, setFromDate] = useState(initialParams.get('from') ?? '')
  const [toDate, setToDate] = useState(initialParams.get('to') ?? '')
  const [searchCursor, setSearchCursor] = useState(initialParams.get('cursor') ?? '')
  const [feedCursor, setFeedCursor] = useState('')
  const [feedDir, setFeedDir] = useState<'next' | 'prev'>('next')
  const [contextMessageId, setContextMessageId] = useState<number | null>(initialFocusId)
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(initialFocusId)

  const debouncedQuery = useDebouncedValue(query, 300)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const scrollTopRef = useRef(0)
  const prependAnchorRef = useRef<{ scrollTop: number; totalSize: number } | null>(null)
  const autoLoadNextCursorRef = useRef<string | null>(null)
  const lastScrolledFocusIdRef = useRef<number | null>(null)

  const messagesFeed = useMessagesFeed({ limit: FEED_PAGE_SIZE, cursor: feedCursor || undefined, dir: feedDir })
  const messageContext = useMessageContext(contextMessageId, 15, 15)
  const searchState = useSearchMessages(
    debouncedQuery.trim().length >= 2 || authorFilter || fromDate || toDate
      ? {
          q: debouncedQuery || undefined,
          limit: 50,
          cursor: searchCursor || undefined,
          author: authorFilter || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        }
      : null,
  )

  const isSearchMode = Boolean(debouncedQuery.trim().length >= 2 || authorFilter || fromDate || toDate)
  const activeState = isSearchMode ? searchState : contextMessageId ? messageContext : messagesFeed
  const activeItems = useMemo(() => activeState.data?.items ?? [], [activeState.data?.items])

  const rowVirtualizer = useVirtualizer({
    count: activeItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 92,
    overscan: 10,
    getItemKey: (index) => activeItems[index]?.id ?? index,
  })

  useEffect(() => {
    const params = new URLSearchParams()

    if (query.trim().length > 0) {
      params.set('q', query.trim())
    }
    if (authorFilter.trim().length > 0) {
      params.set('author', authorFilter.trim())
    }
    if (fromDate) {
      params.set('from', fromDate)
    }
    if (toDate) {
      params.set('to', toDate)
    }
    if (isSearchMode && searchCursor) {
      params.set('cursor', searchCursor)
    }
    if (!isSearchMode && contextMessageId) {
      params.set('focus', String(contextMessageId))
    }

    const queryString = params.toString()
    const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}`
    window.history.replaceState({}, '', nextUrl)
  }, [query, authorFilter, fromDate, toDate, searchCursor, isSearchMode, contextMessageId])

  useEffect(() => {
    setSearchCursor('')
  }, [debouncedQuery, authorFilter, fromDate, toDate])

  useEffect(() => {
    const anchor = prependAnchorRef.current
    if (!anchor || messagesFeed.isLoadingPrevious) {
      return
    }

    const scroller = scrollRef.current
    if (!scroller) {
      prependAnchorRef.current = null
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      const nextTotalSize = rowVirtualizer.getTotalSize()
      scroller.scrollTop = anchor.scrollTop + Math.max(0, nextTotalSize - anchor.totalSize)
      prependAnchorRef.current = null
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [activeItems.length, messagesFeed.isLoadingPrevious, rowVirtualizer])

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller || isSearchMode) {
      return
    }

    function handleScroll() {
      const element = scrollRef.current
      if (!element) {
        return
      }

      const currentScrollTop = element.scrollTop
      const scrollDirection = currentScrollTop - scrollTopRef.current
      scrollTopRef.current = currentScrollTop

      const edgeThreshold = AUTO_LOAD_EDGE_THRESHOLD
      const distanceFromBottom = element.scrollHeight - currentScrollTop - element.clientHeight

      if (
        scrollDirection < 0 &&
        currentScrollTop <= edgeThreshold &&
        activeState.data?.prevCursor &&
        !activeState.isLoading &&
        (contextMessageId !== null || !messagesFeed.isLoadingPrevious)
      ) {
        if (contextMessageId !== null) {
          messagesFeed.resetWithData(activeState.data!)
          setContextMessageId(null)
        } else {
          prependAnchorRef.current = {
            scrollTop: currentScrollTop,
            totalSize: rowVirtualizer.getTotalSize(),
          }
          void messagesFeed.loadPrevious()
        }

        return
      }

      if (
        distanceFromBottom <= edgeThreshold &&
        activeState.data?.nextCursor &&
        (contextMessageId !== null || autoLoadNextCursorRef.current !== activeState.data.nextCursor) &&
        !activeState.isLoading &&
        (contextMessageId !== null || !messagesFeed.isLoadingNext)
      ) {
        if (contextMessageId !== null) {
          messagesFeed.resetWithData(activeState.data!)
          setContextMessageId(null)
        } else {
          autoLoadNextCursorRef.current = activeState.data.nextCursor
          void messagesFeed.loadNext().then((loaded) => {
            if (!loaded) {
              autoLoadNextCursorRef.current = null
            }
          })
        }
      }
    }

    scrollTopRef.current = scroller.scrollTop
    scroller.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      scroller.removeEventListener('scroll', handleScroll)
    }
  }, [
    activeState,
    contextMessageId,
    isSearchMode,
    messagesFeed,
    rowVirtualizer,
  ])

  useEffect(() => {
    autoLoadNextCursorRef.current = null
  }, [activeState.data?.nextCursor])

  useEffect(() => {
    if (isSearchMode) {
      return
    }

    const element = scrollRef.current
    if (!element) {
      return
    }

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    if (distanceFromBottom > AUTO_LOAD_EDGE_THRESHOLD) {
      return
    }

    const nextCursor = activeState.data?.nextCursor
    if (!nextCursor || activeState.isLoading) {
      return
    }

    if (contextMessageId !== null) {
      messagesFeed.resetWithData(activeState.data!)
      setContextMessageId(null)
      return
    }

    if (messagesFeed.isLoadingNext || autoLoadNextCursorRef.current === nextCursor) {
      return
    }

    autoLoadNextCursorRef.current = nextCursor
    void messagesFeed.loadNext().then((loaded) => {
      if (!loaded) {
        autoLoadNextCursorRef.current = null
      }
    })
  }, [
    activeItems.length,
    activeState.data,
    activeState.isLoading,
    contextMessageId,
    isSearchMode,
    messagesFeed,
  ])

  useEffect(() => {
    if (!highlightedMessageId) {
      lastScrolledFocusIdRef.current = null
      return
    }

    if (lastScrolledFocusIdRef.current === highlightedMessageId || activeItems.length === 0) {
      return
    }

    const highlightedIndex = activeItems.findIndex((message) => message.id === highlightedMessageId)
    if (highlightedIndex >= 0) {
      lastScrolledFocusIdRef.current = highlightedMessageId
      rowVirtualizer.scrollToIndex(highlightedIndex, {
        align: 'center',
      })
    }
  }, [highlightedMessageId, activeItems, rowVirtualizer])

  function openMessageContext(messageId: number) {
    lastScrolledFocusIdRef.current = null
    setContextMessageId(messageId)
    setHighlightedMessageId(messageId)
    setQuery('')
    setAuthorFilter('')
    setFromDate('')
    setToDate('')
    setSearchCursor('')
  }

  function openPreviousMessages() {
    const prevCursor = activeState.data?.prevCursor
    if (!prevCursor) {
      return
    }

    if (!isSearchMode && contextMessageId === null) {
      prependAnchorRef.current = {
        scrollTop: scrollRef.current?.scrollTop ?? 0,
        totalSize: rowVirtualizer.getTotalSize(),
      }
      void messagesFeed.loadPrevious()
      return
    }

    setContextMessageId(null)
    setHighlightedMessageId(null)
    setFeedCursor(prevCursor)
    setFeedDir('prev')
  }

  function openNextMessages() {
    const nextCursor = activeState.data?.nextCursor
    if (!nextCursor) {
      return
    }

    if (isSearchMode) {
      setSearchCursor(nextCursor)
      return
    }

    if (contextMessageId === null) {
      void messagesFeed.loadNext()
      return
    }

    setContextMessageId(null)
    setHighlightedMessageId(null)
    setFeedCursor(nextCursor)
    setFeedDir('next')
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

  return (
    <main className="discord-page">
      <section className="discord-panel">
        <header className="discord-toolbar">
          <h1 className="discord-title">Discord Archive Viewer</h1>
          <p className="discord-subtitle">Búsqueda en historial con render estilo Discord</p>
        </header>

        <div className="discord-search-block">
          <label htmlFor="search-input" className="discord-search-label">
            Buscar mensajes (mínimo 2 caracteres)
          </label>
          <input
            id="search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ej. sus conversaciones siempre terminan en el mismo punto"
            className="discord-search-input"
          />

          <div className="discord-filter-grid">
            <div>
              <label htmlFor="author-input" className="discord-search-label">
                Filtrar por autor
              </label>
              <input
                id="author-input"
                value={authorFilter}
                onChange={(event) => setAuthorFilter(event.target.value)}
                placeholder="Ej. elpinchealx / Kaimargonar"
                className="discord-search-input"
              />
            </div>

            <div>
              <label htmlFor="from-date-input" className="discord-search-label">
                Desde
              </label>
              <input
                id="from-date-input"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="discord-search-input"
              />
            </div>

            <div>
              <label htmlFor="to-date-input" className="discord-search-label">
                Hasta
              </label>
              <input
                id="to-date-input"
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="discord-search-input"
              />
            </div>
          </div>

          {(authorFilter || fromDate || toDate) && (
            <button
              type="button"
              className="discord-clear-filters"
              onClick={() => {
                setAuthorFilter('')
                setFromDate('')
                setToDate('')
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {activeState.isLoading && <p data-testid="loading-state" className="discord-state">Cargando...</p>}
        {activeState.error && <p data-testid="error-state" className="discord-state error">Error: {activeState.error}</p>}
        {!activeState.isLoading && activeState.isEmpty && !activeState.error && (
          <p data-testid="empty-state" className="discord-state">
            Sin resultados.
          </p>
        )}

        {activeState.data && activeState.data.items.length > 0 && (
          <section className="discord-messages" aria-label="Mensajes">
            {!isSearchMode && (
              <div className="discord-pagination discord-pagination-top">
                <button
                  type="button"
                  className="discord-pagination-button"
                  onClick={openPreviousMessages}
                  disabled={!activeState.data.prevCursor}
                >
                  Mensajes anteriores
                </button>
                <button
                  type="button"
                  className="discord-pagination-button"
                  onClick={openNextMessages}
                  disabled={!activeState.data.nextCursor}
                >
                  Mensajes siguientes
                </button>
              </div>
            )}

            <div ref={scrollRef} className="discord-message-scroller">
              {messagesFeed.isLoadingPrevious && !isSearchMode && contextMessageId === null && (
                <p className="discord-auto-load-indicator discord-auto-load-indicator-top">Cargando más...</p>
              )}

              <div
                className="discord-message-virtual-space"
                style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const message = activeItems[virtualRow.index]
                  if (!message) {
                    return null
                  }

                  const isCompact = shouldCompactWithPrevious(activeItems, virtualRow.index)

                  return (
                    <article
                      key={message.id}
                      ref={rowVirtualizer.measureElement}
                      data-index={virtualRow.index}
                      className={`discord-message-row${isCompact ? ' discord-message-row-compact' : ''}${highlightedMessageId === message.id ? ' discord-message-row-highlighted' : ''}`}
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                      onClick={isSearchMode ? () => openMessageContext(message.id) : undefined}
                      role={isSearchMode ? 'button' : undefined}
                      tabIndex={isSearchMode ? 0 : undefined}
                      onKeyDown={
                        isSearchMode
                          ? (event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                openMessageContext(message.id)
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
                                openMessageContext(message.id)
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

              {messagesFeed.isLoadingNext && !isSearchMode && contextMessageId === null && (
                <p className="discord-auto-load-indicator discord-auto-load-indicator-bottom">Cargando más...</p>
              )}
            </div>

            <div className="discord-pagination">
              {!isSearchMode && (
                <button
                  type="button"
                  className="discord-pagination-button"
                  onClick={openPreviousMessages}
                  disabled={!activeState.data.prevCursor}
                >
                  Mensajes anteriores
                </button>
              )}

              {((isSearchMode && activeState.data.nextCursor) || (!isSearchMode && activeState.data.nextCursor)) && (
                <button
                  type="button"
                  className="discord-pagination-button"
                  onClick={openNextMessages}
                >
                  {isSearchMode ? 'Siguiente página de resultados' : 'Mensajes siguientes'}
                </button>
              )}

              {!isSearchMode && contextMessageId && (
                <button
                  type="button"
                  className="discord-pagination-button discord-secondary-button"
                  onClick={() => {
                    setContextMessageId(null)
                    setHighlightedMessageId(null)
                    setFeedCursor('')
                    setFeedDir('next')
                    messagesFeed.refetch()
                  }}
                >
                  Volver al inicio del timeline
                </button>
              )}
            </div>

            {isSearchMode && activeState.data.nextCursor && (
              <div className="discord-pagination">
                <p className="discord-search-hint">Haz click en un resultado para verlo en contexto dentro del timeline.</p>
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  )
}

export default App
