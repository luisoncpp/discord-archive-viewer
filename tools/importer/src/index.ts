import { parseCliOptions } from './cli.js'
import { runImport } from './importer.js'

async function main() {
  const options = parseCliOptions(process.argv)
  const metrics = await runImport(options)

  console.log(JSON.stringify(metrics, null, 2))
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
