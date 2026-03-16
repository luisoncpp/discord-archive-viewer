import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { SearchFilters } from './features/app/SearchFilters'
import { TimelineSection } from './features/app/TimelineSection'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { useMessageContext } from './hooks/useMessageContext'
import { useMessagesFeed } from './hooks/useMessagesFeed'
import { useSearchMessages } from './hooks/useSearchMessages'
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

  function resetTimeline() {
    setContextMessageId(null)
    setHighlightedMessageId(null)
    setFeedCursor('')
    setFeedDir('next')
    messagesFeed.refetch()
  }

  return (
    <main className="discord-page">
      <section className="discord-panel">
        <header className="discord-toolbar">
          <h1 className="discord-title">Discord Archive Viewer</h1>
          <p className="discord-subtitle">Búsqueda en historial con render estilo Discord</p>
        </header>

        <SearchFilters
          query={query}
          authorFilter={authorFilter}
          fromDate={fromDate}
          toDate={toDate}
          onQueryChange={setQuery}
          onAuthorFilterChange={setAuthorFilter}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onClearFilters={() => {
            setAuthorFilter('')
            setFromDate('')
            setToDate('')
          }}
        />

        {activeState.isLoading && <p data-testid="loading-state" className="discord-state">Cargando...</p>}
        {activeState.error && <p data-testid="error-state" className="discord-state error">Error: {activeState.error}</p>}
        {!activeState.isLoading && activeState.isEmpty && !activeState.error && (
          <p data-testid="empty-state" className="discord-state">
            Sin resultados.
          </p>
        )}

        {activeState.data && activeState.data.items.length > 0 && (
          <TimelineSection
            data={activeState.data}
            items={activeItems}
            isSearchMode={isSearchMode}
            isContextMode={contextMessageId !== null}
            highlightedMessageId={highlightedMessageId}
            isLoadingPrevious={messagesFeed.isLoadingPrevious}
            isLoadingNext={messagesFeed.isLoadingNext}
            scrollRef={scrollRef}
            rowVirtualizer={rowVirtualizer}
            onOpenMessageContext={openMessageContext}
            onOpenPreviousMessages={openPreviousMessages}
            onOpenNextMessages={openNextMessages}
            onResetTimeline={resetTimeline}
          />
        )}
      </section>
    </main>
  )
}

export default App
