import { useEffect, useMemo, useState } from 'react'
import { SearchFilters } from './features/app/SearchFilters'
import { TimelineSection } from './features/app/TimelineSection'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { useMessageContext } from './hooks/useMessageContext'
import { useMessagesFeed } from './hooks/useMessagesFeed'
import { useSearchMessages } from './hooks/useSearchMessages'
import { useTimelineController } from './hooks/useTimelineController'
import './App.css'

const FEED_PAGE_SIZE = 20

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


  const {
    scrollRef,
    rowVirtualizer,
    openMessageContext,
    openPreviousMessages,
    openNextMessages,
    resetTimeline,
  } = useTimelineController({
    isSearchMode,
    activeState,
    activeItems,
    contextMessageId,
    highlightedMessageId,
    messagesFeed,
    setContextMessageId,
    setHighlightedMessageId,
    setFeedCursor,
    setFeedDir,
    setSearchCursor,
    clearSearchFilters: () => {
      setQuery('')
      setAuthorFilter('')
      setFromDate('')
      setToDate('')
    },
  })

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
