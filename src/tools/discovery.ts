import { z } from 'zod'
import type { DatabaseAdapter } from '../types/index.js'
import { SchemaCache } from '../schema/cache.js'
import { ResultFormatter } from '../serialization/result-formatter.js'
import { createValidationError } from '../utils/errors.js'

// Tool input schemas
const ListDatabasesInput = z.object({})
const ListTablesInput = z.object({
  database: z.string().optional()
})
const DescribeTableInput = z.object({
  table: z.string()
})
const SearchSchemaInput = z.object({
  pattern: z.string().min(1)
})
const GetTableSampleInput = z.object({
  table: z.string(),
  limit: z.number().min(1).max(100).default(5)
})
const GetTableStatsInput = z.object({
  table: z.string()
})
const RefreshSchemaCacheInput = z.object({})

export function createDiscoveryTools(
  adapter: DatabaseAdapter,
  cache: SchemaCache,
  formatter: ResultFormatter
) {
  return {
    list_databases: {
      name: 'list_databases',
      description: 'List all accessible databases',
      inputSchema: ListDatabasesInput.shape,
      handler: async () => {
        const databases = await adapter.getDatabases()
        return { databases }
      }
    },

    list_tables: {
      name: 'list_tables',
      description: 'List tables in the database with row counts and engine information',
      inputSchema: ListTablesInput.shape,
      handler: async (input: z.infer<typeof ListTablesInput>) => {
        const tables = await cache.getTables(adapter)
        return {
          tables: tables.map(t => ({
            name: t.name,
            rows: t.rows,
            engine: t.engine
          }))
        }
      }
    },

    describe_table: {
      name: 'describe_table',
      description: 'Get detailed schema information for a specific table including columns, types, and keys',
      inputSchema: DescribeTableInput.shape,
      handler: async (input: z.infer<typeof DescribeTableInput>) => {
        const schema = await cache.getTableSchema(adapter, input.table)
        return {
          tableName: schema.tableName,
          columns: schema.columns.map(col => ({
            name: col.name,
            type: col.type,
            nullable: col.nullable,
            default: col.default,
            key: col.key
          })),
          indexes: schema.indexes?.map(idx => ({
            name: idx.name,
            columns: idx.columns,
            unique: idx.unique,
            type: idx.type
          })) || []
        }
      }
    },

    search_schema: {
      name: 'search_schema',
      description: 'Search for tables and columns matching a pattern. Critical for discovering schema in legacy databases.',
      inputSchema: SearchSchemaInput.shape,
      handler: async (input: z.infer<typeof SearchSchemaInput>) => {
        if (input.pattern.length < 2) {
          throw createValidationError('Search pattern must be at least 2 characters')
        }

        const result = await cache.searchSchema(adapter, input.pattern)

        return {
          tables: result.tables.map(t => ({
            name: t.name,
            rows: t.rows,
            engine: t.engine
          })),
          columns: result.columns.map(c => ({
            table: c.table,
            column: c.column,
            type: c.type
          })),
          matchCount: result.tables.length + result.columns.length
        }
      }
    },

    get_table_sample: {
      name: 'get_table_sample',
      description: 'Get a sample of rows from a table for semantic understanding. Useful for AI to learn data patterns.',
      inputSchema: GetTableSampleInput.shape,
      handler: async (input: z.infer<typeof GetTableSampleInput>) => {
        const result = await adapter.getTableSample(input.table, input.limit)
        const formatted = formatter.format(result)

        return {
          table: input.table,
          columns: formatted.columns,
          rows: formatted.rows,
          rowCount: formatted.rowCount,
          truncated: formatted.rowCount >= input.limit
        }
      }
    },

    get_table_stats: {
      name: 'get_table_stats',
      description: 'Get table statistics including row count, size, last update time, and index count',
      inputSchema: GetTableStatsInput.shape,
      handler: async (input: z.infer<typeof GetTableStatsInput>) => {
        const stats = await adapter.getTableStats(input.table)
        return stats
      }
    },

    refresh_schema_cache: {
      name: 'refresh_schema_cache',
      description: 'Manually refresh the schema cache. Use after schema changes.',
      inputSchema: RefreshSchemaCacheInput.shape,
      handler: async () => {
        cache.refresh()
        return {
          status: 'refreshed',
          timestamp: new Date().toISOString()
        }
      }
    }
  }
}
