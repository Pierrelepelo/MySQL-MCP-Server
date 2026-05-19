import type { DatabaseAdapter, TableInfo, TableSchema, SchemaSearchResult } from '../types/index.js'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

export class SchemaCache {
  private ttl: number
  private tablesCache?: CacheEntry<TableInfo[]>
  private schemaCache: Map<string, CacheEntry<TableSchema>>
  private searchCache: Map<string, CacheEntry<SchemaSearchResult>>

  constructor(ttlMs: number = 300000) {
    this.ttl = ttlMs
    this.schemaCache = new Map()
    this.searchCache = new Map()
  }

  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() - entry.timestamp > this.ttl
  }

  async getTables(adapter: DatabaseAdapter): Promise<TableInfo[]> {
    if (this.tablesCache && !this.isExpired(this.tablesCache)) {
      return this.tablesCache.data
    }

    const tables = await adapter.getTables()
    this.tablesCache = {
      data: tables,
      timestamp: Date.now()
    }

    return tables
  }

  async getTableSchema(adapter: DatabaseAdapter, tableName: string): Promise<TableSchema> {
    const cached = this.schemaCache.get(tableName)

    if (cached && !this.isExpired(cached)) {
      return cached.data
    }

    const schema = await adapter.getTableSchema(tableName)
    this.schemaCache.set(tableName, {
      data: schema,
      timestamp: Date.now()
    })

    return schema
  }

  async searchSchema(adapter: DatabaseAdapter, pattern: string): Promise<SchemaSearchResult> {
    const cached = this.searchCache.get(pattern)

    if (cached && !this.isExpired(cached)) {
      return cached.data
    }

    const result = await adapter.searchSchema(pattern)
    this.searchCache.set(pattern, {
      data: result,
      timestamp: Date.now()
    })

    return result
  }

  refresh(): void {
    this.tablesCache = undefined
    this.schemaCache.clear()
    this.searchCache.clear()
  }

  setTtl(ttlMs: number): void {
    this.ttl = ttlMs
    this.refresh() // Clear cache when TTL changes
  }
}
