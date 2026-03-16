import { describe, expect, it } from 'vitest'
import { toFtsMatchQuery } from '../src/shared/db/d1-archive-repository.js'

describe('toFtsMatchQuery', () => {
  it('removes punctuation that can break MATCH syntax', () => {
    const query = toFtsMatchQuery('ya me bañe, gracias por preocuparse')
    expect(query).toBe('ya me bañe gracias por preocuparse')
  })

  it('collapses repeated whitespace', () => {
    const query = toFtsMatchQuery('  hola   mundo  ')
    expect(query).toBe('hola mundo')
  })

  it('returns empty string when no searchable tokens remain', () => {
    const query = toFtsMatchQuery('!!! ,,, ???')
    expect(query).toBe('')
  })
})
