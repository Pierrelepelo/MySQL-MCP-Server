import { describe, it, expect } from 'vitest'
import { ResultFormatter } from '../../../src/serialization/result-formatter'

describe('ResultFormatter', () => {
  let formatter: ResultFormatter

  beforeEach(() => {
    formatter = new ResultFormatter(5000) // 5000 char max field length
  })

  it('should format simple query result', () => {
    const input = {
      columns: ['id', 'name'],
      rows: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ],
      rowCount: 2,
      executionTimeMs: 5
    }

    const result = formatter.format(input)

    expect(result.columns).toEqual(['id', 'name'])
    expect(result.rows).toHaveLength(2)
    expect(result.rowCount).toBe(2)
    expect(result.executionTimeMs).toBe(5)
  })

  it('should truncate long text fields', () => {
    const longText = 'a'.repeat(10000)

    const input = {
      columns: ['id', 'content'],
      rows: [{ id: 1, content: longText }],
      rowCount: 1,
      executionTimeMs: 1
    }

    const result = formatter.format(input)

    const content = result.rows[0].content as string
    expect(content.length).toBeLessThanOrEqual(5000)
    expect(content).toContain('... (truncated')
  })

  it('should handle NULL values', () => {
    const input = {
      columns: ['id', 'name'],
      rows: [{ id: 1, name: null }],
      rowCount: 1,
      executionTimeMs: 1
    }

    const result = formatter.format(input)

    expect(result.rows[0].name).toBeNull()
  })

  it('should preserve decimal values as strings', () => {
    const input = {
      columns: ['id', 'amount'],
      rows: [{ id: 1, amount: 1234.56 }],
      rowCount: 1,
      executionTimeMs: 1
    }

    const result = formatter.format(input)

    expect(result.rows[0].amount).toBe(1234.56)
  })

  it('should handle buffer/blob data', () => {
    const buffer = Buffer.from('binary data')

    const input = {
      columns: ['id', 'data'],
      rows: [{ id: 1, data: buffer }],
      rowCount: 1,
      executionTimeMs: 1
    }

    const result = formatter.format(input)

    const data = result.rows[0].data as any
    expect(data.type).toBe('BLOB')
    expect(data.size).toBe(buffer.length)
    expect(data.preview).toBe('<binary omitted>')
  })
})
