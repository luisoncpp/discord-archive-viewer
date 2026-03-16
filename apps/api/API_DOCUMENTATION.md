# API Documentation — Discord Archive Viewer

## 1) Resumen
Esta API corre sobre Cloudflare Workers (Hono) y expone endpoints REST para:
- listar mensajes paginados por cursor,
- buscar mensajes con FTS,
- listar autores.

La persistencia usa D1 (`messages` + `messages_fts`).

## 2) Cómo usarla

## 2.1 Requisitos
- Node.js instalado
- Wrangler autenticado (`wrangler login`)
- D1 configurado en `wrangler.toml` (binding `DB`)

## 2.2 Levantar en local
Desde la raíz del repo:

```bash
npm run dev:api
```

Esto ejecuta `wrangler dev` en `apps/api`.

## 2.3 Verificar salud
```bash
curl "http://127.0.0.1:8787/api/health"
```

Respuesta esperada:
```json
{
  "ok": true,
  "service": "api",
  "runtime": "cloudflare-workers"
}
```

## 3) Endpoints

## 3.1 GET /api/health
Endpoint simple para comprobar que la API está arriba.

### Response 200
```json
{
  "ok": true,
  "service": "api",
  "runtime": "cloudflare-workers"
}
```

## 3.2 GET /api/messages
Lista mensajes con paginación por cursor.

### Query params
- `cursor` (opcional): `number` entero positivo (id del mensaje)
- `dir` (opcional): `next | prev` (default: `next`)
- `limit` (opcional): entero positivo, máximo `100` (default: `100`)

### Ejemplos
Primera página:
```bash
curl "http://127.0.0.1:8787/api/messages"
```

Página siguiente desde cursor:
```bash
curl "http://127.0.0.1:8787/api/messages?cursor=1200&dir=next&limit=50"
```

### Response 200
```json
{
  "items": [
    {
      "id": 1,
      "sourceRowId": 1,
      "messageTimestamp": "2017-10-23T15:20:19.0490000-05:00",
      "authorId": "288691691462852610",
      "authorName": "miloavilaxd",
      "content": "Hola hola banda",
      "attachmentsRaw": null,
      "reactionsRaw": null
    }
  ],
  "nextCursor": "50",
  "prevCursor": "1"
}
```

## 3.3 GET /api/search
Busca mensajes por contenido usando FTS.

### Query params
- `q` (requerido): texto de búsqueda (min `2`, max `200`)
- `cursor` (opcional): entero positivo (id)
- `limit` (opcional): entero positivo, máximo `50` (default: `50`)

### Ejemplos
```bash
curl "http://127.0.0.1:8787/api/search?q=hola"
```

```bash
curl "http://127.0.0.1:8787/api/search?q=discord&cursor=10000&limit=20"
```

### Response 200
Misma forma de paginación que `/api/messages`:
```json
{
  "items": [],
  "nextCursor": null,
  "prevCursor": null
}
```

## 3.4 GET /api/authors
Lista autores por frecuencia de mensajes.

### Query params
- `query` (opcional): filtra por `author_name` o `author_id` (LIKE)
- `limit` (opcional): entero positivo, máximo `50` (default: `50`)

### Ejemplos
```bash
curl "http://127.0.0.1:8787/api/authors"
```

```bash
curl "http://127.0.0.1:8787/api/authors?query=luis&limit=20"
```

### Response 200
```json
{
  "items": [
    {
      "authorId": "123",
      "authorName": "alice",
      "messageCount": 30
    }
  ]
}
```

## 4) Formato de errores

## 4.1 Error de validación (400)
```json
{
  "code": "validation_error",
  "message": "Invalid query params for /api/messages",
  "details": {}
}
```

## 4.2 Error de búsqueda FTS (400)
```json
{
  "code": "search_query_error",
  "message": "Search query could not be executed",
  "details": "..."
}
```

## 4.3 Error inesperado (500)
```json
{
  "code": "internal_error",
  "message": "Unexpected error while handling request"
}
```

## 5) Responsabilidades por módulo

## 5.1 `modules/messages`
- **Controller (`messages.controller`)**
  - Parsea/valida query params de `/api/messages` con `zod`.
  - Traduce errores de validación a `HttpError(400)`.
- **Use case (`list-messages.use-case`)**
  - Define contrato de entrada/salida para listar mensajes.
  - Orquesta la operación delegando en el repositorio.

## 5.2 `modules/search`
- **Controller (`search.controller`)**
  - Valida `q`, `cursor`, `limit`.
  - Captura errores de ejecución FTS y los traduce a `search_query_error`.
- **Use case (`search-messages.use-case`)**
  - Define contrato de búsqueda y delega en repositorio.

## 5.3 `modules/authors`
- **Controller (`authors.controller`)**
  - Valida `query` y `limit`.
  - Devuelve autores en objeto `{ items }`.
- **Use case (`list-authors.use-case`)**
  - Define contrato para consultar autores y delega en repositorio.

## 5.4 `shared/db`
- **`D1ArchiveRepository`**
  - Implementación concreta de acceso a D1.
  - Ejecuta queries SQL para mensajes, búsqueda FTS y autores.
  - Mapea filas SQL (snake_case) a DTOs del dominio API (camelCase).

## 5.5 `shared/types`
- **`api.ts`**
  - Contratos de `MessageDto`, `AuthorDto`, `CursorPage`, `ApiErrorPayload`.
- **`env.ts`**
  - Contrato de bindings de Worker (`DB`, `APP_NAME`).

## 5.6 `shared/errors`
- **`HttpError`**
  - Error de dominio HTTP con `status` + payload serializable.
  - Consumido por el manejador global de errores.

## 5.7 `worker.ts`
- Composición del router Hono.
- Registro de rutas `/api/*`.
- Manejador global de errores (`HttpError` y fallback 500).

## 6) Principios de diseño aplicados
- **S (Single Responsibility):** controllers validan/serializan, use-cases orquestan, repository consulta DB.
- **D (Dependency Inversion):** use-cases dependen de interfaces de repositorio.
- **I (Interface Segregation):** contratos separados por capacidad (`listMessages`, `searchMessages`, `listAuthors`).

## 7) Scripts útiles
Desde raíz:

```bash
npm run dev:api
npm run test -w apps/api
npm run lint -w apps/api
npm run build -w apps/api
```

Migraciones D1:

```bash
npm run db:migrate:local
npm run db:migrate:remote
npm run db:check:local
npm run db:check:remote
```
