# API Documentation — Discord Archive Viewer

## 1) Resumen
La API corre sobre Cloudflare Workers (Hono) y usa D1 como persistencia.

Capacidades actuales:
- listado de mensajes por cursor,
- contexto de mensaje (anteriores + siguientes alrededor de un id),
- búsqueda por FTS y/o filtros (`author`, `from`, `to`),
- listado de autores.

## 2) Cómo usarla

## 2.1 Requisitos
- Node.js instalado
- Wrangler autenticado (`wrangler login`)
- D1 configurado en `wrangler.toml` (binding `DB`)

## 2.2 Levantar en local
Desde raíz:

```bash
npm run dev:api
```

Para usar la base remota en modo desarrollo:

```bash
npm run dev:api:remote
```

Nota: `wrangler dev --remote` requiere tener subdominio `workers.dev` registrado en tu cuenta Cloudflare.

## 2.3 Verificar salud
```bash
curl "http://127.0.0.1:8787/api/health"
```

Response 200:
```json
{
  "ok": true,
  "service": "api",
  "runtime": "cloudflare-workers"
}
```

## 3) Endpoints

## 3.1 GET /api/health
Healthcheck del worker.

## 3.2 GET /api/messages
Lista mensajes paginados por cursor.

### Query params
- `cursor` (opcional): `number` entero positivo
- `dir` (opcional): `next | prev` (default `next`)
- `limit` (opcional): entero positivo, máximo `100` (default `100`)

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
  "prevCursor": null
}
```

## 3.3 GET /api/messages/context
Obtiene una ventana centrada en un mensaje específico para mostrarlo en contexto.

### Query params
- `id` (requerido): id del mensaje objetivo
- `before` (opcional): cantidad de mensajes anteriores (default `10`, max `50`)
- `after` (opcional): cantidad de mensajes siguientes (default `10`, max `50`)

### Ejemplo
```bash
curl "http://127.0.0.1:8787/api/messages/context?id=996333&before=10&after=10"
```

### Response 200
Misma forma de `CursorPage<MessageDto>`:
```json
{
  "items": [],
  "nextCursor": null,
  "prevCursor": null
}
```

## 3.4 GET /api/search
Búsqueda de mensajes por contenido (FTS) y filtros.

### Query params
- `q` (opcional): texto de búsqueda (si se envía, min `2`, max `200`)
- `author` (opcional): filtro por `author_name` o `author_id`
- `from` (opcional): fecha mínima (`YYYY-MM-DD`)
- `to` (opcional): fecha máxima (`YYYY-MM-DD`)
- `cursor` (opcional): entero positivo
- `limit` (opcional): entero positivo, máximo `50` (default `50`)

### Reglas de validación
- Debe existir al menos un criterio: `q` o (`author`/`from`/`to`).
- Si `from` y `to` vienen juntos, `from <= to`.
- Si `q` no se envía, la búsqueda funciona solo con filtros (`author`, `from`, `to`) sobre `messages`.

### Ejemplos
Búsqueda por texto:
```bash
curl "http://127.0.0.1:8787/api/search?q=hola"
```

Búsqueda por filtros sin texto:
```bash
curl "http://127.0.0.1:8787/api/search?author=luis&from=2020-01-01&to=2020-01-31"
```

Búsqueda paginada:
```bash
curl "http://127.0.0.1:8787/api/search?q=discord&cursor=10000&limit=20"
```

### Response 200
```json
{
  "items": [],
  "nextCursor": null,
  "prevCursor": null
}
```

Notas de paginación:
- `nextCursor` avanza a resultados más antiguos.
- `prevCursor` vuelve hacia resultados más recientes dentro del mismo flujo.

## 3.5 GET /api/authors
Lista autores por frecuencia de mensajes.

### Query params
- `query` (opcional): filtra por `author_name` o `author_id` (LIKE)
- `limit` (opcional): entero positivo, máximo `50` (default `50`)

## 4) Formato de errores

## 4.1 Error de validación (400)
```json
{
  "code": "validation_error",
  "message": "Invalid query params for /api/search",
  "details": {}
}
```

## 4.2 Error de búsqueda (400)
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
- `messages.controller`
  - valida `/api/messages` y `/api/messages/context` con Zod.
- `list-messages.use-case`
  - contrato para timeline paginado.
- `get-message-context.use-case`
  - contrato para contexto alrededor de mensaje.

## 5.2 `modules/search`
- `search.controller`
  - valida criterios de búsqueda y reglas de rango de fecha.
- `search-messages.use-case`
  - define contrato y delega al repositorio.

## 5.3 `modules/authors`
- `authors.controller`
  - valida `query` y `limit`.
- `list-authors.use-case`
  - contrato para obtener autores.

## 5.4 `shared/db`
- `D1ArchiveRepository`
  - consultas SQL de mensajes, contexto, búsqueda y autores,
  - mapeo snake_case -> camelCase,
  - sanitización de query FTS (`toFtsMatchQuery`).

## 5.5 `shared/errors`
- `HttpError`
  - error HTTP tipado con `status` + payload serializable.

## 5.6 `worker.ts`
- registro de rutas `/api/*`,
- manejador global de errores (`HttpError` y fallback 500).

## 6) Scripts útiles
Desde raíz:

```bash
npm run dev:api
npm run dev:api:remote
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
