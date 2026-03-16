# Importer (Fase 2)

## Objetivo
Importar CSV de DiscordChatExporter a D1 (local o remoto) con:
- lectura por streaming,
- normalización de encoding,
- inserción por lotes,
- re-ejecución segura por `source_row_id`.

## Uso
Desde la raíz del repo:

- Importar completo:
  - `npm run import -w tools/importer -- --csv ../../sillon.csv`

- Importar muestra (5k filas):
  - `npm run import:sample -w tools/importer`

- Importar hacia D1 remoto:
  - `npm run import -w tools/importer -- --csv ../../sillon.csv --remote`

## Flags
- `--csv <path>` (requerido)
- `--db-name <name>` (opcional, default `el-sillon`)
- `--remote` (opcional, por default local)
- `--batch-size <n>` (opcional, default `5000`)
- `--encoding <enc>` (opcional, default `utf8`)
- `--state-path <path>` (opcional, default `tools/importer/data/import-state.json`)
- `--wrangler-config <path>` (opcional, default `apps/api/wrangler.toml`)
- `--max-rows <n>` (opcional)
- `--no-resume` (opcional)

## Salida
Imprime métricas JSON con:
- filas procesadas,
- filas insertadas/actualizadas,
- filas omitidas por resume,
- filas fallidas,
- duración.
