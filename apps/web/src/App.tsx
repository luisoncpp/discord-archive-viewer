import { useState } from 'react'
import { useMessagesFeed } from './hooks/useMessagesFeed'
import { useSearchMessages } from './hooks/useSearchMessages'
import './App.css'

function App() {
  const [query, setQuery] = useState('')
  const messagesFeed = useMessagesFeed({ limit: 20 })
  const searchState = useSearchMessages(query.trim().length >= 2 ? { q: query, limit: 20 } : null)

  const activeState = query.trim().length >= 2 ? searchState : messagesFeed

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Discord Archive Viewer API Integration</h1>
      <p>Fase 4: contratos tipados + cliente HTTP + estados de carga/error/vacío.</p>

      <label htmlFor="search-input" style={{ display: 'block', marginBottom: 8 }}>
        Buscar mensajes (mínimo 2 caracteres)
      </label>
      <input
        id="search-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Ej. hola"
        style={{ width: '100%', maxWidth: 420, padding: 8, marginBottom: 16 }}
      />

      {activeState.isLoading && <p data-testid="loading-state">Cargando...</p>}
      {activeState.error && <p data-testid="error-state">Error: {activeState.error}</p>}
      {!activeState.isLoading && activeState.isEmpty && !activeState.error && (
        <p data-testid="empty-state">Sin resultados.</p>
      )}

      {activeState.data && activeState.data.items.length > 0 && (
        <section>
          <h2>Datos en bruto ({activeState.data.items.length})</h2>
          <pre
            style={{
              maxHeight: 360,
              overflow: 'auto',
              background: '#111',
              color: '#d4d4d4',
              padding: 12,
              borderRadius: 6,
            }}
          >
            {JSON.stringify(activeState.data.items.slice(0, 5), null, 2)}
          </pre>
        </section>
      )}
    </main>
  )
}

export default App
