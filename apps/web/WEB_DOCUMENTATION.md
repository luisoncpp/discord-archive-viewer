# Web Documentation (LLM-Optimized)

Objetivo: describir la arquitectura del frontend con el menor contexto posible para cambios seguros.

## 1) TL;DR (lectura en 30s)

- Stack: React 19 + TypeScript + Vite.
- Shell principal: `src/App.tsx`.
- Lógica crítica de timeline: `src/hooks/useTimelineController.ts`.
- Render UI extraído: `src/features/app/SearchFilters.tsx` y `src/features/app/TimelineSection.tsx`.
- Rendering de mensajes: `src/features/messages/MessageContent.tsx`.
- Fuente de datos: `src/hooks/useMessagesFeed.ts`, `src/hooks/useMessageContext.ts`, `src/hooks/useSearchMessages.ts`.
- Contratos/API: `src/services/apiClient.ts` + `src/types/api.ts` (Zod).

## 2) Mapa de arquitectura

### Capa UI

- `App.tsx`: composición de estado, selección de modo (`search/context/feed`), wiring de componentes.
- `SearchFilters.tsx`: inputs de búsqueda/filtros, sin estado interno.
- `TimelineSection.tsx`: lista virtualizada + botones de navegación + loading indicators.
- `MessageContent.tsx`: markdown seguro + embeds + reacciones.

### Capa comportamiento

- `useTimelineController.ts`: scroll listener, auto-load en bordes, transición context→feed, foco one-shot.
- `useDebouncedValue.ts`: debounce para query.

### Capa datos

- `useMessagesFeed.ts`: timeline paginado por cursor (`next`/`prev`) con merge y dedupe.
- `useMessageContext.ts`: ventana alrededor de `focus`.
- `useSearchMessages.ts`: búsqueda por `q`, `author`, `from`, `to`.
- `apiClient.ts`: requests + validación Zod + errores tipados.

## 3) Modos de pantalla (source of truth)

- `isSearchMode = true` → usa `searchState`.
- `isSearchMode = false && contextMessageId !== null` → usa `messageContext`.
- `isSearchMode = false && contextMessageId === null` → usa `messagesFeed`.

El `activeState` siempre deriva de esas reglas. Cambios en auto-load deben respetar esta prioridad.

## 4) Invariantes críticas (no romper)

1. Context→Feed debe hidratar primero:
   - usar `messagesFeed.resetWithData(contextPage)`
   - luego `setContextMessageId(null)`.
   - evita salto agresivo de scroll y pérdida del mensaje original.

2. `scrollToIndex` de foco es one-shot por `highlightedMessageId`:
   - controlado con `lastScrolledFocusIdRef`.
   - evita recentrado repetido tras auto-cargas.

3. Auto-load inferior deduplica por cursor:
   - `autoLoadNextCursorRef` evita disparos duplicados para el mismo `nextCursor`.

4. Prepend conserva viewport:
   - antes de `loadPrevious`, guardar `{ scrollTop, totalSize }`.
   - después del prepend, compensar delta de altura.

5. Reset de timeline debe forzar refetch:
   - `messagesFeed.refetch()` en `resetTimeline`.
   - evita quedarse en datos hidratados de contexto cuando `feedCursor` no cambió.

## 5) Endpoints consumidos por frontend

- `GET /api/messages` (`cursor`, `dir`, `limit`)
- `GET /api/messages/context` (`id`, `before`, `after`)
- `GET /api/search` (`q`, `author`, `from`, `to`, `cursor`, `limit`)
- `GET /api/authors` (`query`, `limit`)

Semántica relevante:
- `nextCursor` = avanzar a mensajes más recientes del flujo actual.
- `prevCursor` = cargar mensajes anteriores.

## 6) URL contract

La app sincroniza estado en query params:

- `q`, `author`, `from`, `to`: filtros de búsqueda.
- `cursor`: paginación de búsqueda.
- `focus`: mensaje objetivo para abrir contexto.

Deep-link válido: `/?focus=<messageId>`.

## 7) Testing map (qué protege cada suite)

- `src/test/useTimelineController.spec.tsx`
  - acciones del controlador,
  - auto-load por scroll,
  - transición context→feed,
  - foco one-shot.

- `src/test/app.spec.tsx`
  - integración de `App` con hooks,
  - flujos de búsqueda/contexto,
  - regresiones clave de auto-load y reset timeline.

- `src/test/messageContent.spec.tsx`
  - markdown/embeds/reacciones sanitizados.

- `src/test/apiClient.spec.ts`
  - parseo de payload, errores tipados, payload inválido.

## 8) Flujo recomendado para cambios

1. Cambiar primero lógica en `useTimelineController.ts`.
2. Ajustar wiring mínimo en `App.tsx`.
3. Ejecutar pruebas focalizadas:
   - `npm run test -- useTimelineController.spec.tsx`
   - `npm run test -- app.spec.tsx`
4. Ejecutar validación final:
   - `npm run lint -w apps/web`
   - `npm run build -w apps/web`

## 9) Known caveats

- ESLint puede reportar warning `react-hooks/incompatible-library` por `useVirtualizer`.
- Es warning conocido; build y tests permanecen válidos.

## 10) Minimal context pack for future LLM edits

Si un LLM necesita editar comportamiento de timeline, normalmente basta con leer solo:

1. `src/App.tsx`
2. `src/hooks/useTimelineController.ts`
3. `src/hooks/useMessagesFeed.ts`
4. `src/test/useTimelineController.spec.tsx`
5. `src/test/app.spec.tsx`

Con esos 5 archivos suele ser suficiente para cambios sin romper invariantes.
