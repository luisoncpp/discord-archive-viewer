# Diseño Técnico — Discord Archive Viewer (1.6M mensajes)

## 1) Objetivo técnico
Implementar una aplicación web escalable para explorar y buscar 1.6M de mensajes con UX tipo Discord, usando:
- **Frontend:** Vite + React + TypeScript + Tailwind CSS.
- **Backend:** Cloudflare Workers/Pages Functions en TypeScript (API REST).
- **Base de datos:** SQLite compatible con FTS5 (Cloudflare D1 en producción objetivo).

Este documento define arquitectura, módulos, contratos y criterios de calidad.

## 2) Arquitectura de alto nivel
### Componentes
1. **Frontend SPA (Vite):** renderiza UI, hace virtual scroll y consume API.
2. **Backend API (Workers):** expone endpoints de lectura/búsqueda y encapsula acceso a datos.
3. **Proceso de ingestión (Node CLI):** importa CSV en lotes y construye índices.
4. **DB SQLite/D1:** almacenamiento principal y motor FTS5.

### Flujo
- Importador lee CSV -> transforma -> inserta en `messages`.
- Triggers sincronizan `messages_fts`.
- Frontend solicita páginas por cursor y búsquedas FTS.

## 3) Stack propuesto
### Frontend
- `react`, `typescript`, `vite`
- `tailwindcss`
- `@tanstack/react-virtual` (virtualización)
- `react-router-dom` (rutas SPA)
- `zod` (validación de payloads en cliente)

### Backend (Cloudflare Workers)
- `typescript`
- `wrangler`
- handler HTTP de Workers (o `hono` sobre Workers)
- `zod` (validación de request/response)
- `pino` (logging)
- capa de repositorios sobre D1
- `compatibility_flags = ["nodejs_compat"]` cuando sea necesario para librerías compatibles

### Testing
- `vitest` para unit tests (frontend y backend)
- `@testing-library/react` para UI unitaria

## 4) Estructura de repositorio sugerida
```text
/
  apps/
    web/                  # Vite + React + TS
      src/
        app/
        features/
        components/
        services/
        hooks/
        types/
        utils/
    api/                  # Workers + TS
      src/
        modules/
          messages/
          search/
          authors/
        shared/
          db/
          validation/
          errors/
          logging/
        worker.ts
  tools/
    importer/             # script Node para CSV -> DB
  sql/
    migrations/
    seeds/
```

## 5) Funcionalidad de frontend (detalle)
### 5.1 Vistas principales
- **Shell principal:** sidebar (canales/filtros), panel de mensajes, barra de búsqueda.
- **Timeline de mensajes:** lista virtualizada con carga incremental por cursor.
- **Resultados de búsqueda:** vista paginada, resaltado básico de coincidencias.

### 5.2 Comportamientos clave
- Virtual scrolling para render de ventana visible.
- Prefetch de páginas adyacentes para scroll continuo.
- Debounce de búsqueda (250–400 ms).
- Estado de carga/empty/error por cada consulta.

### 5.3 Render tipo Discord (Markdown + embeds)
El `content` se procesa con pipeline seguro:
1. Parse Markdown compatible con formato común de Discord.
2. Autolink de URLs en texto plano.
3. Sanitización estricta (sin HTML crudo ejecutable).

Reglas de embeds en MVP:
- URL directa a imagen (`png`, `jpg`, `jpeg`, `gif`, `webp`, `avif`) -> preview con `<img loading="lazy">`.
- URL de YouTube (`watch`, `youtu.be`, `shorts`) -> `iframe` embebido con fallback a link.
- Otras URLs -> link normal.
- Máximo 1 embed por mensaje para estabilidad de layout.

### 5.4 Módulos frontend (responsabilidades)
- `features/messages`: timeline, item de mensaje, paginación por cursor.
- `features/search`: input, resultados, sincronización con query params.
- `features/renderer`: parseo de markdown, detección de embeds, sanitización.
- `services/apiClient`: cliente HTTP tipado por contratos.
- `hooks`: `useMessagesFeed`, `useSearchMessages`, `useVirtualTimeline`.

## 6) Estructura de backend (Workers + SOLID)
### 6.1 Capas
1. **Routes/Controllers:** parsean request y devuelven response HTTP.
2. **Use Cases (Application):** reglas de negocio (listar, buscar, filtrar).
3. **Repositories (Domain/Data):** acceso abstracto a DB.
4. **Infrastructure:** implementación concreta D1, logger y config de Workers.

### 6.2 Aplicación de SOLID
- **S — Single Responsibility:** cada clase/módulo con una responsabilidad (ej. `SearchMessagesUseCase`).
- **O — Open/Closed:** nuevas estrategias de búsqueda se agregan creando nuevos repositorios/adaptadores sin romper casos existentes.
- **L — Liskov:** contratos de repositorio intercambiables (`D1MessagesRepository` o `SqliteMessagesRepository`).
- **I — Interface Segregation:** interfaces pequeñas (`MessagesReader`, `MessagesSearcher`) en lugar de una interfaz monolítica.
- **D — Dependency Inversion:** use cases dependen de interfaces, no de drivers concretos.

### 6.3 Módulos backend
- `modules/messages`
  - `ListMessagesController`
  - `ListMessagesUseCase`
  - `MessagesRepository` (interface)
- `modules/search`
  - `SearchMessagesController`
  - `SearchMessagesUseCase`
  - `SearchRepository` (interface)
- `modules/authors`
  - `ListAuthorsController`
  - `ListAuthorsUseCase`

## 7) Contrato API (MVP)
### GET /api/messages
Query:
- `cursor` (opcional)
- `dir` = `next|prev`
- `limit` (máx 100)

Respuesta:
```json
{
  "items": [],
  "nextCursor": "...",
  "prevCursor": "..."
}
```

### GET /api/search
Query:
- `q` (obligatorio, min 2 chars)
- `cursor` (opcional)
- `limit` (máx 50)

### GET /api/authors
Query:
- `query` (opcional)
- `limit` (máx 50)

## 8) Modelo de datos (SQLite / D1)
### Tabla principal
```sql
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_row_id INTEGER NOT NULL UNIQUE,
  message_timestamp TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT,
  attachments_raw TEXT,
  reactions_raw TEXT
);
```

### Índices
```sql
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(message_timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_author_id ON messages(author_id);
CREATE INDEX IF NOT EXISTS idx_messages_author_name ON messages(author_name);
```

### FTS5
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content,
  content='messages',
  content_rowid='id',
  tokenize='unicode61'
);

CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.id, COALESCE(new.content, ''));
END;

CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
  INSERT INTO messages_fts(rowid, content) VALUES (new.id, COALESCE(new.content, ''));
END;
```

## 9) Ingestión CSV (Node CLI)
Pipeline:
1. Lectura streaming del CSV (sin cargar todo en memoria).
2. Normalización de encoding a UTF-8.
3. Mapeo de columnas (`AuthorID`, `Author`, `Date`, `Content`, `Attachments`, `Reactions`).
4. Inserción por lotes (5k–20k) dentro de transacciones.
5. Verificación de conteo total y muestreo de integridad.

## 9.1) Desarrollo local (servidor API sin Node clásico)
Para entorno local, el backend se ejecuta como Worker con `wrangler`, no como proceso Fastify/Express tradicional:

1. **API local (Workers):**
  - Ejecutar `wrangler dev` dentro de `apps/api`.
  - Esto levanta un servidor local de desarrollo sobre runtime de Workers.

2. **D1 local:**
  - Crear y migrar base local con comandos `wrangler d1`.
  - Usar una base local para iterar y una remota para integración.

3. **Frontend local:**
  - Ejecutar `vite` (`npm run dev`) en `apps/web`.
  - Configurar `VITE_API_URL` apuntando al host local de `wrangler dev`.

4. **Importador local (Node CLI):**
  - El importador sí corre en Node para procesar el CSV masivo.
  - Luego inserta en D1 (local o remoto, según etapa).

Resultado: en local sí tienes un “servidor” para la API, solo que corre en runtime de Workers emulado, no en un servidor Node persistente.

## 10) Seguridad, errores y observabilidad
- Sanitización de texto renderizado y validación de inputs con `zod`.
- Rate limiting en endpoints de búsqueda.
- Respuestas de error con formato estable (`code`, `message`, `details`).
- Logging estructurado por request (`requestId`, latencia, status).

## 11) Estrategia de pruebas unitarias
### Frontend (Vitest + Testing Library)
- Render de `MessageContent` (markdown, links, embeds).
- Detección de URL de imagen y YouTube.
- Hooks (`useMessagesFeed`, `useSearchMessages`) con mocks de API.

### Backend (Vitest)
- Unit tests por use case con repositorio mockeado.
- Validadores de request (queries inválidas/límites).
- Parsers/normalizadores de embed y cursores.

### Cobertura objetivo
- Use cases críticos: >= 90% statements.
- Renderer y parser de embeds: >= 90%.

## 12) Criterios de aceptación técnicos
- Scroll largo fluido con virtualización (sin freeze perceptible).
- Búsqueda FTS interactiva con paginación por cursor.
- Render markdown seguro con embeds de imagen/YouTube.
- Backend modular y testeable conforme a SOLID.
- Suite unitaria ejecutable en CI para frontend y backend.
