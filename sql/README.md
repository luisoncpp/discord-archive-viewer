# SQL Migrations

## Fase 1
- `0001_init_messages.sql`: crea `messages`, índices por timestamp/autor y FTS5 (`messages_fts`) con triggers de sincronización.

## Comandos
Desde la raíz del monorepo:
- Migrar local: `npm run db:migrate:local`
- Validar local: `npm run db:check:local`
- Migrar remoto: `npm run db:migrate:remote`
- Validar remoto: `npm run db:check:remote`
