# Plan de Implementación — Discord Archive Viewer

## 1) Objetivo del plan
Definir una ruta de implementación incremental para construir el sistema descrito en el diseño técnico, minimizando riesgo técnico y permitiendo validar pronto los puntos críticos: importación de 1.6M mensajes, búsqueda FTS, render de contenido estilo Discord y scroll virtualizado.

Topología seleccionada para este proyecto: **Ruta A (Cloudflare nativa)**.

## 2) Estrategia general
Se implementará por fases verticales, dejando cada etapa en un estado ejecutable y verificable. El orden prioriza primero la base técnica y la capacidad de mover datos reales, luego los endpoints de negocio y finalmente la experiencia completa del frontend.

Principios de ejecución:
- Entregables pequeños y verificables.
- Primero resolver riesgos de volumen de datos.
- Mantener separación clara entre frontend, backend e importador.
- Aplicar SOLID desde la primera versión del backend.
- Escribir pruebas unitarias junto con los módulos críticos, no al final.

## 3) Fases

## Fase 0 — Preparación del repositorio
### Objetivo
Dejar listo el monorepo, convenciones, toolchain y estructura base para trabajar sin retrabajo posterior.

### Tareas
- Crear estructura de carpetas:
  - `apps/web`
  - `apps/api`
  - `tools/importer`
  - `sql/migrations`
- Configurar TypeScript por proyecto.
- Definir scripts base de desarrollo, build, test y lint.
- Configurar formato y reglas de calidad de código.
- Definir variables de entorno por aplicación.

### Entregables
- Monorepo inicial funcional.
- Configuración TS separada para web, api e importer.
- Scripts documentados.

### Criterio de salida
- Los tres proyectos arrancan localmente.
- `build` y `test` ejecutan sin errores, aunque haya pruebas mínimas iniciales.

## Fase 1 — Base de datos y migraciones
### Objetivo
Tener listo el esquema SQLite/D1, índices y búsqueda FTS5 para comenzar importación y lectura.

### Tareas
- Crear migración inicial de `messages`.
- Crear índices por `message_timestamp`, `author_id`, `author_name`.
- Crear tabla virtual `messages_fts`.
- Crear triggers de sincronización FTS.
- Documentar estrategia de evolución de schema.

### Entregables
- SQL versionado en `sql/migrations`.
- Script para aplicar migraciones en entorno local.

### Criterio de salida
- La base puede inicializarse desde cero sin intervención manual.
- Se puede insertar un mensaje de prueba y consultarlo vía FTS.

## Fase 2 — Importador CSV a SQLite/D1
### Objetivo
Resolver el mayor riesgo técnico: cargar el dataset masivo de manera correcta, estable y repetible.

### Tareas
- Implementar lector CSV por streaming.
- Detectar y normalizar encoding a UTF-8.
- Mapear columnas del export real:
  - `AuthorID`
  - `Author`
  - `Date`
  - `Content`
  - `Attachments`
  - `Reactions`
- Insertar por lotes con transacciones.
- Registrar métricas de importación:
  - filas procesadas
  - filas insertadas
  - filas rechazadas
  - tiempo por lote
- Implementar reanudación o re-ejecución segura.

### Pruebas unitarias
- Parseo de filas CSV.
- Normalización de encoding.
- Mapeo de columnas a entidad interna.
- Serialización de `attachments_raw` y `reactions_raw`.

### Entregables
- CLI `importer` funcional.
- Reporte final de importación.

### Criterio de salida
- Importación completa del archivo real sin agotar memoria.
- Conteo total consistente con el CSV.
- Muestreo manual correcto de mensajes con caracteres especiales.

## Fase 3 — Núcleo del backend API
### Objetivo
Levantar una API Node tipada, modular y alineada con SOLID.

### Tareas
- Crear servidor Fastify con bootstrap limpio.
- Implementar módulos:
  - `messages`
  - `search`
  - `authors`
- Definir interfaces de repositorio.
- Implementar capa SQLite local.
- Crear validación de requests con `zod`.
- Estandarizar manejo de errores y respuestas.
- Agregar logging estructurado.

### Diseño interno esperado
- `Controller`: solo HTTP.
- `UseCase`: lógica de aplicación.
- `Repository`: interfaz por capacidad.
- `Infrastructure`: implementación concreta.

### Pruebas unitarias
- Casos de uso con repositorios mock.
- Validación de queries inválidas.
- Construcción de cursores y límites.

### Entregables
- API ejecutable localmente.
- Endpoints base:
  - `GET /api/messages`
  - `GET /api/search`
  - `GET /api/authors`

### Criterio de salida
- Los endpoints responden contra base real.
- No existen dependencias directas de controllers a drivers SQL.

## Fase 4 — Contratos de datos y cliente frontend
### Objetivo
Cerrar el contrato entre frontend y backend antes de construir la UI completa.

### Tareas
- Definir DTOs de request/response.
- Crear cliente HTTP tipado en frontend.
- Crear capa `services/apiClient`.
- Estandarizar serialización de cursores.
- Manejar estados de error, carga y vacío.

### Pruebas unitarias
- Parseo de respuestas de API.
- Manejo de errores HTTP.
- Validación de payloads con `zod`.

### Entregables
- Cliente frontend reutilizable.
- Tipos compartidos o sincronizados.

### Criterio de salida
- El frontend puede consultar localmente la API y representar datos en bruto.

## Fase 5 — Renderer de mensajes estilo Discord
### Objetivo
Implementar el núcleo visual del producto: el render correcto de mensajes y embeds.

### Tareas
- Construir `MessageContent`.
- Implementar parser Markdown seguro.
- Habilitar autolink de URLs.
- Implementar sanitización.
- Detectar primer embed elegible por mensaje.
- Renderizar previews de imagen.
- Renderizar embed de YouTube con fallback.
- Resolver prioridad entre `attachments_raw` y URLs en `content`.

### Pruebas unitarias
- Bold, italic, strike, inline code.
- Bloques con triple backtick.
- Links normales.
- Imagen embebida por URL directa.
- YouTube embed por URL válida.
- Casos sin embed.
- Sanitización de contenido malicioso.

### Entregables
- Componente de render de mensaje estable.
- Utilidades puras de detección de embeds.

### Criterio de salida
- Un conjunto de fixtures de mensajes reales renderiza correctamente.
- No hay ejecución de HTML inseguro.

## Fase 6 — Timeline virtualizado y navegación principal
### Objetivo
Construir la experiencia principal de lectura continua de mensajes a gran escala.

### Tareas
- Implementar layout general estilo Discord.
- Crear sidebar de navegación y filtros.
- Crear timeline virtualizado con `@tanstack/react-virtual`.
- Integrar carga incremental por cursor.
- Agregar prefetch de páginas cercanas.
- Manejar scroll ascendente y descendente.
- Mostrar estados de loading y placeholders.

### Pruebas unitarias
- Lógica de hooks de timeline.
- Cálculo de páginas a solicitar.
- Integración básica del render virtual.

### Entregables
- Vista principal funcional para explorar historial.

### Criterio de salida
- Scroll fluido sobre grandes volúmenes.
- No se renderizan miles de nodos simultáneamente.

## Fase 7 — Búsqueda y filtros
### Objetivo
Permitir exploración eficiente por contenido, autor y fecha.

### Tareas
- Construir barra de búsqueda global.
- Agregar debounce.
- Crear vista de resultados.
- Integrar búsqueda FTS paginada.
- Implementar filtros por autor.
- Implementar filtro por rango de fechas.
- Sincronizar filtros con query params.

### Pruebas unitarias
- Hooks de búsqueda.
- Transformación de filtros en query string.
- Composición de resultados y reseteo de paginación.

### Entregables
- Flujo de búsqueda usable de extremo a extremo.

### Criterio de salida
- El usuario puede encontrar mensajes por palabra y filtrar sin recargar la app.

## Fase 8 — Hardening técnico
### Objetivo
Elevar robustez, mantenibilidad y diagnóstico antes de despliegue.

### Tareas
- Revisar límites de paginación.
- Aplicar rate limiting a búsqueda.
- Mejorar logs y trazabilidad.
- Afinar errores tipados.
- Medir tiempos de respuesta del API.
- Medir costo de render del timeline.
- Revisar estrategia de caché local.

### Pruebas unitarias adicionales
- Casos límite de cursores inválidos.
- Requests malformados.
- Respuestas vacías.

### Entregables
- Versión endurecida para pruebas finales.

### Criterio de salida
- El sistema resiste entradas inválidas y escenarios comunes sin romper UX.

## Fase 9 — Despliegue y validación final
### Objetivo
Publicar una versión operativa y validar comportamiento con datos reales en entorno objetivo.

### Decisión cerrada
Se confirma **Ruta A: Cloudflare nativa**:
- Frontend en Cloudflare Pages.
- API en Cloudflare Workers / Pages Functions.
- Base de datos en Cloudflare D1.

### Restricción técnica importante
Cloudflare D1 está diseñado para consumirse de forma nativa desde runtime de Cloudflare, por lo que esta ruta elimina el riesgo de incompatibilidad entre runtime y base de datos.

### Tareas
- Preparar build de frontend.
- Preparar configuración productiva del backend en Workers/Functions.
- Conectar D1 como base de datos productiva.
- Ejecutar importación final.
- Validar consultas reales.
- Medir tiempos de búsqueda y navegación.
- Corregir cuellos de botella críticos detectados.

### Tareas específicas (Ruta A)
- Configurar proyecto de Cloudflare Pages para el frontend.
- Implementar la API final sobre Workers o Pages Functions.
- Configurar binding de D1.
- Adaptar el acceso a datos del repositorio para runtime Cloudflare.
- Ejecutar migraciones D1.
- Ejecutar importación final hacia D1.
- Validar latencia edge y comportamiento FTS.

### Entregables
- Entorno desplegado.
- Checklist de validación productiva.

### Recomendación técnica
Mantener Node únicamente para tooling e importación CSV, y ejecutar la API productiva en Workers/Functions.

### Criterio de salida
- La aplicación permite navegar y buscar el dataset completo con desempeño aceptable.

## 4) Orden recomendado de ejecución
1. Fase 0
2. Fase 1
3. Fase 2
4. Fase 3
5. Fase 4
6. Fase 5
7. Fase 6
8. Fase 7
9. Fase 8
10. Fase 9

## 5) Riesgos principales y mitigación
### Riesgo 1: encoding inconsistente del CSV
Mitigación:
- validar muestras tempranas
- crear normalizador reutilizable
- agregar tests con fixtures corruptos

### Riesgo 2: búsquedas lentas sobre 1.6M filas
Mitigación:
- FTS5 desde el inicio
- índices correctos
- paginación por cursor
- límite estricto por request

### Riesgo 3: rendimiento pobre en frontend
Mitigación:
- virtualización obligatoria
- render incremental
- previews limitadas por mensaje
- caché de páginas recientes

### Riesgo 4: backend acoplado a infraestructura
Mitigación:
- repositorios por interfaz
- use cases sin dependencia de Fastify o SQL
- pruebas unitarias con mocks

### Riesgo 5: incompatibilidad entre D1 y backend Node separado
Mitigación:
- decidir topología de despliegue antes de cerrar Fase 3
- mantener repositorios abstraídos desde el inicio
- no acoplar casos de uso al runtime de Fastify ni al driver concreto
- preparar dos adaptadores de infraestructura si se desea conservar flexibilidad

## 6) Topologías de despliegue recomendadas
### Opción recomendada para Cloudflare puro
**Frontend:** Cloudflare Pages  
**API:** Cloudflare Workers o Pages Functions  
**DB:** Cloudflare D1  
**Importador:** Node local o job temporal

Ventajas:
- alineación total con el objetivo original
- acceso nativo a D1
- menor complejidad operativa

Desventajas:
- la API productiva deja de ser un servidor Node puro

### Opción recomendada para backend Node separado
**Frontend:** Cloudflare Pages  
**API:** Node.js en servicio externo  
**DB:** alternativa remota accesible desde Node  
**Importador:** Node local o job del mismo backend

Ventajas:
- backend homogéneo en Node
- despliegue más cercano a una arquitectura tradicional

Desventajas:
- se abandona D1 como pieza principal
- se pierde parte del objetivo de stack Cloudflare integral
- puede dejar de ser completamente zero-cost según proveedor

## 7) Ajuste recomendado al orden de ejecución
La topología ya está definida, por lo que entre Fase 2 y Fase 3 solo se valida:

1. Contrato de acceso a D1 desde repositorios.
2. Configuración local de `wrangler dev` y D1 local.
3. Paridad básica entre entorno local y entorno de Cloudflare.

## 8) Definición de terminado
Una fase se considera terminada solo si cumple todo lo siguiente:
- código implementado
- pruebas unitarias relevantes agregadas y pasando
- scripts de ejecución funcionales
- validación manual básica completada
- sin deuda crítica bloqueante para la siguiente fase

## 9) Primera iteración recomendada
La primera iteración práctica debería cubrir:
1. Fase 0 completa.
2. Fase 1 completa.
3. Fase 2 con importación parcial de muestra.
4. Fase 3 con `GET /api/messages`.
5. Fase 5 con renderer básico de markdown + links + imagen.

Ese corte permite validar temprano las decisiones de arquitectura y detectar rápido problemas con datos reales antes de construir toda la UI.