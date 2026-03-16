# Web Documentation — Discord Archive Viewer

## 1) Resumen
El frontend está construido con Vite + React + TypeScript y actualmente implementa la Fase 4 del plan:
- contratos tipados de API,
- cliente HTTP con validación de payload,
- serialización de query params/cursor,
- hooks con estados de carga, error y vacío,
- integración mínima en UI para consumo real del backend.

## 2) Cómo correr el frontend

## 2.1 Requisitos
- Node.js instalado
- Dependencias instaladas en el monorepo
- API disponible (idealmente con `wrangler dev` en `apps/api`)

## 2.2 Variables de entorno
Archivo recomendado: `.env` o `.env.local` dentro de `apps/web`.

Variable usada:
- `VITE_API_URL` (ejemplo: `http://127.0.0.1:8787`)

Si no existe, el cliente usa `window.location.origin` como fallback.

En desarrollo, `vite.config.ts` define proxy para `/api` hacia `http://127.0.0.1:8787`, por lo que `npm run dev:web` + `npm run dev:api` funciona sin configurar `VITE_API_URL`.

Si defines `VITE_API_URL`, ese valor se usa como base para construir la URL de API.

## 2.3 Comandos
Desde raíz del repo:

```bash
npm run dev:api
npm run dev:web
npm run lint -w apps/web
npm run test -w apps/web
npm run build -w apps/web
```

## 3) Estructura actual del frontend

```text
apps/web/src
  App.tsx
  hooks/
    useMessagesFeed.ts
    useSearchMessages.ts
  services/
    apiClient.ts
  types/
    api.ts
  test/
    app.spec.tsx
    apiClient.spec.ts
```

## 4) Responsabilidades por módulo

## 4.1 `src/types/api.ts`
Responsabilidad:
- definir contratos de datos del API y validadores Zod.

Incluye:
- `MessageSchema`
- `CursorPageSchema`
- `MessagesPageSchema`
- `AuthorsResponseSchema`
- `ApiErrorSchema`
- tipos derivados (`MessageDto`, `MessagesPageDto`, `AuthorDto`)

## 4.2 `src/services/apiClient.ts`
Responsabilidad:
- encapsular llamadas HTTP al backend y validar respuestas con Zod.

Funciones principales:
- `listMessages(input)`
- `searchMessages(input)`
- `listAuthors(input)`

Comportamiento clave:
- serializa query params (cursor, dir, limit, q, query),
- parsea payload de éxito con schema,
- interpreta payload de error tipado,
- detecta respuestas no JSON y devuelve error explícito (`non_json_response`),
- lanza `ApiClientError` con `status`, `code`, `message`, `details`.

## 4.3 `src/hooks/useMessagesFeed.ts`
Responsabilidad:
- obtener y exponer estado de listado de mensajes.

Input:
- `{ cursor?, dir?, limit? }`

Output:
- `data`
- `isLoading`
- `error`
- `isEmpty`
- `refetch()`

Comportamiento:
- ejecuta carga inicial en `useEffect`,
- controla cancelación para evitar actualizar estado tras unmount,
- mantiene recarga manual por `reloadNonce`.

## 4.4 `src/hooks/useSearchMessages.ts`
Responsabilidad:
- ejecutar búsqueda por texto y exponer estados.

Input:
- `SearchMessagesInput | null`

Reglas:
- no busca si `q` tiene menos de 2 caracteres,
- usa `searchMessages` del cliente,
- maneja `loading/error/empty` y `refetch`.

## 4.5 `src/App.tsx`
Responsabilidad:
- integración mínima de Fase 4 para demostrar consumo real del API.

Comportamiento:
- input de búsqueda,
- si hay query válida usa `useSearchMessages`,
- si no, usa `useMessagesFeed`,
- renderiza estados:
  - cargando,
  - error,
  - vacío,
  - datos en bruto (preview de primeros elementos).

## 5) Contratos consumidos del backend

## 5.1 `GET /api/messages`
Query:
- `cursor?`
- `dir?` (`next|prev`)
- `limit?` (máx 100)

Respuesta esperada:
```json
{
  "items": [],
  "nextCursor": null,
  "prevCursor": null
}
```

## 5.2 `GET /api/search`
Query:
- `q` (mínimo 2 chars)
- `cursor?`
- `limit?` (máx 50)

Respuesta esperada:
- misma forma de paginación por cursor que `messages`.

## 5.3 `GET /api/authors`
Query:
- `query?`
- `limit?` (máx 50)

Respuesta esperada:
```json
{
  "items": [
    {
      "authorId": "...",
      "authorName": "...",
      "messageCount": 1
    }
  ]
}
```

## 6) Estrategia de manejo de errores
- Errores HTTP del backend se transforman en `ApiClientError`.
- Si el backend devuelve payload `{ code, message, details }`, el cliente conserva ese detalle.
- Si llega una respuesta no JSON (ej. HTML/doctype por endpoint mal resuelto), se lanza `ApiClientError` con `code = non_json_response`.
- Si el backend responde JSON con forma no esperada, Zod lanza error de validación.

## 9) Troubleshooting rápido
- Síntoma: `Unexpected token '<', "<!doctype ..." is not valid JSON`.
- Causa típica: el frontend recibió HTML en lugar de JSON (ruta API incorrecta o API no levantada).
- Verificación mínima:
  - correr `npm run dev:api` en una terminal,
  - correr `npm run dev:web` en otra,
  - abrir `http://localhost:5173/api/messages` y confirmar que responde JSON (vía proxy de Vite).

## 7) Testing actual

## 7.1 `src/test/apiClient.spec.ts`
Cubre:
- parseo correcto de respuesta válida,
- manejo de error tipado del backend,
- rechazo de payload inválido.

## 7.2 `src/test/app.spec.tsx`
Cubre:
- render base de la integración de App.

## 8) Estado de Fase 4
Cerrado funcionalmente para:
- contratos,
- cliente HTTP,
- hooks con estado,
- integración mínima.

Siguiente paso natural: Fase 5 (renderer de mensajes tipo Discord con markdown seguro y embeds de imagen/YouTube).
