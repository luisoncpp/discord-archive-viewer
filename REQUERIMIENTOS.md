# Requerimientos — Discord Archive Viewer (1.6M mensajes)

## 1) Objetivo
Construir una aplicación web estilo Discord para explorar, buscar y navegar 1.6M de mensajes exportados desde DiscordChatExporter (CSV), con operación de costo cero usando Cloudflare.

## 2) Alcance funcional (MVP)
- Navegación por canal/archivo de mensajes.
- Timeline de mensajes con scroll virtual.
- Búsqueda full-text por contenido.
- Filtros básicos por autor y rango de fechas.
- Vista de adjuntos (cuando existan URLs).

## 3) Stack y despliegue (Zero Cost)
- Frontend: Next.js (App Router) con Tailwind CSS.
- Hosting: Cloudflare Pages.
- API/Backend: Functions de Cloudflare Pages (edge) o Worker integrado.
- Base de datos: Cloudflare D1 (SQLite).
- Búsqueda: SQLite FTS5 en D1.

## 4) Estructura real del CSV detectada
Cabecera identificada en el archivo fuente:
- AuthorID
- Author
- Date
- Content
- Attachments
- Reactions

Ejemplo de fecha observado:
- 2017-10-23T15:20:19.0490000-05:00


## 8) Frontend y performance
- UI estilo Discord (dark mode, sidebar de canales, lista de mensajes).
- Virtualización con @tanstack/react-virtual para renderizar solo viewport.
- Carga incremental con cursor para evitar offset pesado.
- Debounce en búsqueda (250–400 ms).
- Cache local de páginas recientes para scroll fluido.

## 8.1) Render de texto estilo Discord (Markdown + embeds)
El campo `content` debe renderizarse con formato tipo Discord (muy cercano a Markdown), incluyendo:
- **Inline:** negritas, cursivas, tachado, `inline code`, links y saltos de línea.
- **Bloques:** code fences con triple backtick.
- **Menciones y texto plano:** se muestran como texto si no hay metadata adicional para resolverlas.

### Estrategia recomendada de render
- Parsear `content` con un pipeline Markdown seguro (sin HTML crudo).
- Habilitar autolink para URLs en texto plano.
- Sanitizar siempre la salida para prevenir XSS.

### Reglas de embed automático por URL en contenido
1. **URL directa de imagen** (extensiones típicas: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.avif`):
  - Renderizar una tarjeta de preview debajo del texto del mensaje.
  - Mostrar `<img>` responsive con lazy loading.
  - Mantener link clickeable a la URL original.

2. **URL de YouTube** (`youtube.com/watch?v=...`, `youtu.be/...`, `youtube.com/shorts/...`):
  - Extraer `videoId` y renderizar `iframe` embebido.
  - Usar URL de embed: `https://www.youtube.com/embed/{videoId}`.
  - Activar `loading="lazy"` y `referrerPolicy="strict-origin-when-cross-origin"`.
  - Si el embed falla, mantener fallback a link normal.

3. **Otras URLs**:
  - Renderizar como link estándar sin embed.

### Relación con `attachments_raw`
- Si `attachments_raw` contiene assets, estos tienen prioridad para preview visual.
- Si no hay attachments parseables, aplicar detección de embeds por URLs dentro de `content`.

### Criterios UX para embeds
- Máximo 1 preview embebida por mensaje en MVP (la primera URL elegible).
- Mantener altura acotada del embed para no romper la densidad del chat.
- No bloquear render principal: previews se resuelven de forma progresiva.

## 9) Consideraciones de calidad de datos
- Encoding: el CSV muestra posibles mojibake; se requiere paso de normalización UTF-8.
- Mensajes vacíos: conservar registro si tiene adjuntos o reacciones.
- Usuarios eliminados: mantener author_name como “Deleted User” cuando aplique.

## 10) Seguridad y límites
- Sanitizar texto en frontend (render seguro, sin HTML inyectado).
- Limitar tamaño de q y rate-limit básico por IP en endpoints de búsqueda.
- Paginación con límites máximos (ej. 100 mensajes por request).

## 11) Plan técnico de implementación (siguiente paso)
1. Inicializar proyecto Next.js + Tailwind + Cloudflare Pages.
2. Crear esquema D1 + migraciones SQL.
3. Implementar script de importación CSV -> D1 por lotes.
4. Exponer endpoints /api/messages y /api/search.
5. Construir UI Discord-like con virtual scrolling.
6. Validar performance con dataset real y ajustar índices.

## 12) Criterios de aceptación MVP
- Búsqueda de palabras devuelve resultados en tiempo interactivo.
- Scroll de historial largo se mantiene fluido.
- El sistema soporta el archivo completo (~1.6M filas) en D1 sin degradación crítica.
- Deploy funcional en Cloudflare Pages + D1 en plan gratuito.
