import { useEffect, useMemo, useState } from 'react'
import { MessageContent } from './features/messages/MessageContent'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { useMessagesFeed } from './hooks/useMessagesFeed'
import { useSearchMessages } from './hooks/useSearchMessages'
import './App.css'

function App() {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), [])
  const [query, setQuery] = useState(initialParams.get('q') ?? '')
  const [authorFilter, setAuthorFilter] = useState(initialParams.get('author') ?? '')
  const [fromDate, setFromDate] = useState(initialParams.get('from') ?? '')
  const [toDate, setToDate] = useState(initialParams.get('to') ?? '')
  const [searchCursor, setSearchCursor] = useState(initialParams.get('cursor') ?? '')

  const debouncedQuery = useDebouncedValue(query, 300)

  const messagesFeed = useMessagesFeed({ limit: 20 })
  const searchState = useSearchMessages(
    debouncedQuery.trim().length >= 2 || authorFilter || fromDate || toDate
      ? {
          q: debouncedQuery || undefined,
          limit: 20,
          cursor: searchCursor || undefined,
          author: authorFilter || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        }
      : null,
  )

  const isSearchMode = Boolean(debouncedQuery.trim().length >= 2 || authorFilter || fromDate || toDate)
  const activeState = isSearchMode ? searchState : messagesFeed

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

    const queryString = params.toString()
    const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}`
    window.history.replaceState({}, '', nextUrl)
  }, [query, authorFilter, fromDate, toDate, searchCursor, isSearchMode])

  useEffect(() => {
    setSearchCursor('')
  }, [debouncedQuery, authorFilter, fromDate, toDate])

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
            placeholder="Ej. ya me bañe"
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
                placeholder="Ej. luis / bloodstainedrabbit"
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
            {activeState.data.items.map((message) => (
              <article key={message.id} className="discord-message-row">
                <div className="discord-avatar" aria-hidden="true">
                  {message.authorName.slice(0, 1).toUpperCase()}
                </div>

                <div className="discord-message-body">
                  <header className="discord-message-header">
                    <strong className="discord-author">{message.authorName}</strong>
                    <span className="discord-timestamp">{formatTimestamp(message.messageTimestamp)}</span>
                  </header>

                  <MessageContent
                    content={message.content}
                    attachmentsRaw={message.attachmentsRaw}
                    reactionsRaw={message.reactionsRaw}
                  />
                </div>
              </article>
            ))}

            {isSearchMode && activeState.data.nextCursor && (
              <div className="discord-pagination">
                <button
                  type="button"
                  className="discord-pagination-button"
                  onClick={() => setSearchCursor(activeState.data?.nextCursor ?? '')}
                >
                  Siguiente página
                </button>
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  )
}

export default App
