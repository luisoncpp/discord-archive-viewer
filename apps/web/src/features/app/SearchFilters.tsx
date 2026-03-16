import { useState } from 'react'

type SearchFiltersProps = {
  query: string
  authorFilter: string
  fromDate: string
  toDate: string
  onQueryChange: (value: string) => void
  onAuthorFilterChange: (value: string) => void
  onFromDateChange: (value: string) => void
  onToDateChange: (value: string) => void
  onClearFilters: () => void
}

export function SearchFilters({
  query,
  authorFilter,
  fromDate,
  toDate,
  onQueryChange,
  onAuthorFilterChange,
  onFromDateChange,
  onToDateChange,
  onClearFilters,
}: SearchFiltersProps) {
  const [isVisible, setIsVisible] = useState(true)

  return (
    <div className="discord-search-block">
      <div className="discord-search-header">
        <span className="discord-search-title">Búsqueda</span>
        <button
          type="button"
          className="discord-search-toggle"
          aria-expanded={isVisible}
          aria-controls="search-filters-content"
          onClick={() => setIsVisible((value) => !value)}
        >
          {isVisible ? 'Ocultar búsqueda' : 'Mostrar búsqueda'}
        </button>
      </div>

      {isVisible && (
        <div id="search-filters-content">
          <label htmlFor="search-input" className="discord-search-label">
            Buscar mensajes (mínimo 2 caracteres)
          </label>
          <input
            id="search-input"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
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
                onChange={(event) => onAuthorFilterChange(event.target.value)}
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
                onChange={(event) => onFromDateChange(event.target.value)}
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
                onChange={(event) => onToDateChange(event.target.value)}
                className="discord-search-input"
              />
            </div>
          </div>

          {(authorFilter || fromDate || toDate) && (
            <button type="button" className="discord-clear-filters" onClick={onClearFilters}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  )
}