import { useState } from 'react'
import { MessageContent } from './features/messages/MessageContent'
import { useMessagesFeed } from './hooks/useMessagesFeed'
import { useSearchMessages } from './hooks/useSearchMessages'
import './App.css'

function App() {
  const [query, setQuery] = useState('')
  const messagesFeed = useMessagesFeed({ limit: 20 })
  const searchState = useSearchMessages(query.trim().length >= 2 ? { q: query, limit: 20 } : null)

  const activeState = query.trim().length >= 2 ? searchState : messagesFeed

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
          </section>
        )}
      </section>
    </main>
  )
}

export default App
