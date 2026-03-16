import { describe, expect, it } from 'vitest'
import { parseCliOptions } from '../src/cli.js'
import { mapCsvRowToMessage } from '../src/transform.js'

describe('parseCliOptions', () => {
  it('parses required csv option', () => {
    const options = parseCliOptions(['node', 'script', '--csv', 'input.csv'])

    expect(options.csvPath).toBe('input.csv')
    expect(options.databaseName).toBe('el-sillon')
    expect(options.remote).toBe(false)
    expect(options.batchSize).toBeGreaterThan(0)
    expect(options.resume).toBe(true)
  })

  it('supports disabling resume', () => {
    const options = parseCliOptions(['node', 'script', '--csv', 'input.csv', '--no-resume'])
    expect(options.resume).toBe(false)
  })
})

describe('mapCsvRowToMessage', () => {
  it('maps Discord CSV row to message record', () => {
    const mapped = mapCsvRowToMessage(
      {
        AuthorID: '123',
        Author: 'luis',
        Date: '2020-01-01T00:00:00.000Z',
        Content: 'hola',
        Attachments: '',
        Reactions: '',
      },
      44,
    )

    expect(mapped.sourceRowId).toBe(44)
    expect(mapped.authorId).toBe('123')
    expect(mapped.authorName).toBe('luis')
    expect(mapped.content).toBe('hola')
    expect(mapped.attachmentsRaw).toBeNull()
    expect(mapped.reactionsRaw).toBeNull()
  })
})
