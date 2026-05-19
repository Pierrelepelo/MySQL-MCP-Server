import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SchemaCache } from '../../../src/schema/cache'
import type { TableInfo, TableSchema } from '../../../src/types'

describe('SchemaCache', () => {
  let cache: SchemaCache
  let mockAdapter: any

  beforeEach(() => {
    cache = new SchemaCache(5000) // 5 second TTL for testing
    mockAdapter = {
      getTables: vi.fn(),
      getTableSchema: vi.fn(),
      searchSchema: vi.fn()
    }
  })

  it('should cache table list', async () => {
    const tables: TableInfo[] = [
      { name: 'table1', rows: 100 },
      { name: 'table2', rows: 200 }
    ]

    mockAdapter.getTables.mockResolvedValue(tables)

    // First call
    let result = await cache.getTables(mockAdapter)
    expect(result).toEqual(tables)
    expect(mockAdapter.getTables).toHaveBeenCalledTimes(1)

    // Second call should use cache
    result = await cache.getTables(mockAdapter)
    expect(result).toEqual(tables)
    expect(mockAdapter.getTables).toHaveBeenCalledTimes(1) // Still 1, not called again
  })

  it('should expire cache after TTL', async () => {
    const tables: TableInfo[] = [{ name: 'table1', rows: 100 }]

    mockAdapter.getTables.mockResolvedValue(tables)

    await cache.getTables(mockAdapter)
    expect(mockAdapter.getTables).toHaveBeenCalledTimes(1)

    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 5100))

    // Should fetch again
    await cache.getTables(mockAdapter)
    expect(mockAdapter.getTables).toHaveBeenCalledTimes(2)
  }, 10000) // 10 second timeout for this test

  it('should cache table schema', async () => {
    const schema: TableSchema = {
      tableName: 'test_table',
      columns: [
        { name: 'id', type: 'int', nullable: false, key: 'PRI' },
        { name: 'name', type: 'varchar(255)', nullable: true }
      ]
    }

    mockAdapter.getTableSchema.mockResolvedValue(schema)

    let result = await cache.getTableSchema(mockAdapter, 'test_table')
    expect(result).toEqual(schema)
    expect(mockAdapter.getTableSchema).toHaveBeenCalledTimes(1)

    result = await cache.getTableSchema(mockAdapter, 'test_table')
    expect(mockAdapter.getTableSchema).toHaveBeenCalledTimes(1)
  })

  it('should refresh cache manually', async () => {
    const tables: TableInfo[] = [{ name: 'table1', rows: 100 }]
    mockAdapter.getTables.mockResolvedValue(tables)

    await cache.getTables(mockAdapter)
    await cache.refresh()

    await cache.getTables(mockAdapter)
    expect(mockAdapter.getTables).toHaveBeenCalledTimes(2)
  })
})
