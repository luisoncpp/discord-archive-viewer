# Web Documentation — Discord Archive Viewer

## 1) Resumen
El frontend está construido con Vite + React + TypeScript y actualmente cubre Fase 4, 5 y 7:
- contratos tipados de API,
- cliente HTTP con validación de payload y manejo de errores tipados,
- renderer estilo Discord (markdown seguro, embeds y reacciones),
- búsqueda con debounce,
- filtros por autor y rango de fechas,
- sincronización de filtros y estado de foco en query params,
- salto desde resultados de búsqueda a contexto del mensaje en timeline normal.

## 2) Cómo correr el frontend

## 2.1 Requisitos
- Node.js instalado
- Dependencias instaladas en el monorepo
- API disponible (`wrangler dev` local o endpoint remoto)

## 2.2 Variables de entorno
Archivo recomendado: `.env` o `.env.local` dentro de `apps/web`.

Variable usada:
- `VITE_API_URL` (ejemplo: `http://127.0.0.1:8787`)

Si no existe, el cliente usa `window.location.origin` como fallback.

En desarrollo, `vite.config.ts` define proxy para `/api` hacia `http://127.0.0.1:8787`, por lo que `npm run dev:web` + `npm run dev:api` funciona sin configurar `VITE_API_URL`.

## 2.3 Comandos
Desde raíz del repo:

```bash
npm run dev:api
npm run dev:api:remote
npm run dev:web
npm run lint -w apps/web
npm run test -w apps/web
npm run build -w apps/web
```

Notas:
- `dev:api:remote` usa `wrangler dev --remote` y requiere subdominio `workers.dev` en Cloudflare.
- Si no necesitas datos remotos en vivo, usa `npm run dev:api`.

## 3) Estructura actual del frontend

```text
apps/web/src
  App.tsx
  features/messages/
    MessageContent.tsx
    embeds.ts
    markdown.tsx
    reactions.ts
  hooks/
    useDebouncedValue.ts
    useMessageContext.ts
    useMessagesFeed.ts
    useSearchMessages.ts
  services/
    apiClient.ts
  types/
    api.ts
  test/
    app.spec.tsx
    apiClient.spec.ts
    messageContent.spec.tsx
```

## 4) Responsabilidades por módulo

## 4.1 `src/types/api.ts`
- define contratos de datos del API y validadores Zod.
- contiene `MessageSchema`, `MessagesPageSchema`, `AuthorsResponseSchema`, `ApiErrorSchema`.

## 4.2 `src/services/apiClient.ts`
- encapsula llamadas HTTP al backend.
- valida respuestas con Zod.
- detecta respuestas no JSON y lanza `ApiClientError` (`non_json_response`).

Funciones principales:
- `listMessages(input)`
- `getMessageContext(input)`
- `searchMessages(input)`
- `listAuthors(input)`

## 4.3 Hooks
- `useMessagesFeed`: lista normal paginada por cursor y dirección.
- `useSearchMessages`: búsqueda con estado (`loading/error/empty`) y soporte de filtros.
- `useMessageContext`: obtiene contexto alrededor de un `messageId`.
- `useDebouncedValue`: debounce reutilizable para input de búsqueda.

## 4.4 `src/features/messages/MessageContent.tsx`
- render seguro de markdown tipo Discord:
  - inline code, bold, italic, strike,
  - code fences,
  - quotes (`>`),
  - links/autolinks.
- embeds soportados:
  - imagen directa,
  - YouTube,
  - Tenor.
- reacciones desde `reactionsRaw` como pills (`emoji + count`).

## 4.5 `src/App.tsx`
- vista principal estilo Discord.
- búsqueda + filtros (`author`, `from`, `to`).
- sincronización de estado con URL:
  - `q`, `author`, `from`, `to`, `cursor`,
  - `focus` para mensaje enfocado en contexto.
- comportamiento clave:
  - click en resultado de búsqueda => abre timeline normal centrado en ese mensaje,
  - navegación `Mensajes anteriores/siguientes` también en lista normal,
  - resaltado visual del mensaje enfocado.

## 5) Contratos consumidos del backend

## 5.1 `GET /api/messages`
Query:
- `cursor?`
- `dir?` (`next|prev`)
- `limit?` (máx 100)

## 5.2 `GET /api/messages/context`
Query:
- `id` (requerido)
- `before?` (default 10, máx 50)
- `after?` (default 10, máx 50)

Uso:
- devuelve una ventana centrada en el mensaje objetivo para mostrar contexto.

## 5.3 `GET /api/search`
Query:
- `q?` (si viene, mínimo 2 chars)
- `author?`
- `from?` (`YYYY-MM-DD`)
- `to?` (`YYYY-MM-DD`)
- `cursor?`
- `limit?` (máx 50)

Regla:
- requiere al menos un criterio: `q` o filtros (`author/from/to`).

## 5.4 `GET /api/authors`
Query:
- `query?`
- `limit?` (máx 50)

## 6) Estado URL y deep links
La UI mantiene estado en query params para compartir vistas:
- `q`, `author`, `from`, `to`: estado de búsqueda y filtros.
- `cursor`: paginación de búsqueda.
- `focus`: id del mensaje enfocado en vista de contexto.

Comportamiento de restauración:
- Si abres una URL con `focus=<id>`, la app carga automáticamente el contexto de ese mensaje y lo resalta en el timeline.

Ejemplo:
```text
/?focus=996333
```

## 7) Estrategia de manejo de errores
- Errores HTTP del backend se transforman en `ApiClientError`.
- Si llega HTML/no-JSON, se lanza `code = non_json_response`.
- Si el payload JSON no cumple contrato, Zod falla.

## 8) Testing actual

## 8.1 `src/test/apiClient.spec.ts`
- parseo de payload válido,
- error tipado backend,
- rechazo de payload inválido.

## 8.2 `src/test/messageContent.spec.tsx`
- markdown inline,
- bloques de código,
- quotes,
- autolinks,
- embeds (imagen, YouTube, Tenor),
- parseo de reacciones,
- sanitización (sin ejecutar HTML).

## 8.3 `src/test/app.spec.tsx`
- smoke test de render de la app.

## 9) Troubleshooting rápido
- Síntoma: `Unexpected token '<', "<!doctype ..." is not valid JSON`.
- Causa típica: frontend recibió HTML en lugar de JSON (ruta API incorrecta o API no levantada).
- Verificación mínima:
  - correr `npm run dev:api` en una terminal,
  - correr `npm run dev:web` en otra,
  - abrir `http://localhost:5173/api/health` y confirmar JSON.
