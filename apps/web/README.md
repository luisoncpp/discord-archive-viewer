# Frontend (apps/web)

Discord Archive Viewer en React + TypeScript + Vite.

## Quick start

Desde la raíz del repo:

```bash
npm run dev:api
npm run dev:web
```

Comandos útiles:

```bash
npm run test -w apps/web
npm run lint -w apps/web
npm run build -w apps/web
```

## Variables de entorno

- `VITE_SHARE_URL` (opcional): URL base para links compartibles (`/share?focus=...`).
- `VITE_API_URL` (opcional): URL base de API.
- `SHARE_PROXY_BASE_URL` (opcional, Cloudflare Pages Functions): URL del Worker que genera OG dinámico para `?focus`.
- Prioridad para links compartibles: `VITE_SHARE_URL` -> `VITE_API_URL` -> `window.location.origin`.

Para Cloudflare Pages en monorepo:
- Si el **root directory** del proyecto es `apps/web`, usa `apps/web/functions`.
- Si el **root directory** es la raíz del repo, usa `functions` en la raíz.

## Documentación técnica

La guía principal está en `WEB_DOCUMENTATION.md` e incluye:

- mapa de arquitectura actualizado,
- invariantes de scroll/autocarga,
- flujo de datos búsqueda/contexto/feed,
- mapa de pruebas por responsabilidad,
- checklist mínima para cambios seguros.
