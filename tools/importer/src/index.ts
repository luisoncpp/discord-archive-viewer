import { z } from 'zod'

const CliArgsSchema = z.object({
  csvPath: z.string().min(1),
})

function parseArgs(argv: string[]) {
  const csvPath = argv[2] ?? ''
  return CliArgsSchema.parse({ csvPath })
}

function main() {
  const args = parseArgs(process.argv)
  console.log('Importer ready (Fase 0):', args.csvPath)
}

main()
