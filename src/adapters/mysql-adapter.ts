import mysql from 'mysql2/promise'
import type {
  DatabaseAdapter,
  DatabaseConfig,
  QueryResult,
  TableInfo,
  TableSchema,
  ColumnInfo,
  SchemaSearchResult,
  IndexInfo
} from '../types/index.js'
import { ConnectionPool } from '../connection/pool.js'
import { createConnectionError, createValidationError } from '../utils/errors.js'

export class MySQLAdapter implements DatabaseAdapter {
  private pool?: ConnectionPool
  private config: DatabaseConfig
  private sessionId: string

  constructor(config: DatabaseConfig) {
    this.config = config
    this.sessionId = this.generateSessionId()
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
  }

  async connect(): Promise<void> {
    this.pool = new ConnectionPool(this.config)
    await this.pool.initialize()
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close()
      this.pool = undefined
    }
  }

  isConnected(): boolean {
    return this.pool?.isConnected() ?? false
  }

  async execute(query: string): Promise<QueryResult> {
    if (!this.pool) {
      throw createConnectionError('Not connected to database')
    }

    const startTime = Date.now()

    try {
      const rows = await this.pool.query(query)
      const executionTimeMs = Date.now() - startTime

      // Extract column names from first row
      const columns = rows.length > 0
        ? Object.keys(rows[0] as Record<string, unknown>)
        : []

      return {
        columns,
        rows: rows as Record<string, unknown>[],
        rowCount: rows.length,
        executionTimeMs
      }
    } catch (error) {
      throw createConnectionError(
        `Query execution failed: ${error}`,
        { query, executionTimeMs: Date.now() - startTime }
      )
    }
  }

  async getDatabases(): Promise<string[]> {
    if (!this.pool) {
      throw createConnectionError('Not connected to database')
    }

    const rows = await this.pool.query('SHOW DATABASES') as Array<{ Database: string }>

    return rows
      .map(row => row.Database)
      .filter(db => !['information_schema', 'performance_schema', 'mysql', 'sys'].includes(db))
  }

  async getTables(database?: string): Promise<TableInfo[]> {
    if (!this.pool) {
      throw createConnectionError('Not connected to database')
    }

    const db = database || this.config.database

    const rows = await this.pool.query(
      `SELECT TABLE_NAME, TABLE_ROWS, ENGINE
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [db]
    ) as Array<{ TABLE_NAME: string; TABLE_ROWS: bigint | null; ENGINE: string | null }>

    return rows.map(row => ({
      name: row.TABLE_NAME,
      rows: row.TABLE_ROWS ? Number(row.TABLE_ROWS) : undefined,
      engine: row.ENGINE || undefined
    }))
  }

  async getTableSchema(table: string): Promise<TableSchema> {
    if (!this.pool) {
      throw createConnectionError('Not connected to database')
    }

    // Get column information
    const columns = await this.pool.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [this.config.database, table]
    ) as Array<{
      COLUMN_NAME: string
      COLUMN_TYPE: string
      IS_NULLABLE: string
      COLUMN_DEFAULT: string | null
      COLUMN_KEY: string
    }>

    const columnInfos: ColumnInfo[] = columns.map(col => ({
      name: col.COLUMN_NAME,
      type: col.COLUMN_TYPE,
      nullable: col.IS_NULLABLE === 'YES',
      default: col.COLUMN_DEFAULT || undefined,
      key: col.COLUMN_KEY || undefined
    }))

    // Get index information
    const indexes = await this.pool.query(
      `SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE, INDEX_TYPE
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
      [this.config.database, table]
    ) as Array<{
      INDEX_NAME: string
      COLUMN_NAME: string
      NON_UNIQUE: number
      INDEX_TYPE: string
    }>

    // Group indexes by name
    const indexMap = new Map<string, { columns: string[]; unique: boolean; type: string }>()

    for (const row of indexes) {
      if (!indexMap.has(row.INDEX_NAME)) {
        indexMap.set(row.INDEX_NAME, {
          columns: [],
          unique: row.NON_UNIQUE === 0,
          type: row.INDEX_TYPE
        })
      }
      indexMap.get(row.INDEX_NAME)!.columns.push(row.COLUMN_NAME)
    }

    const indexInfos: IndexInfo[] = Array.from(indexMap.entries()).map(([name, info]) => ({
      name,
      columns: info.columns,
      unique: info.unique,
      type: info.type
    }))

    return {
      tableName: table,
      columns: columnInfos,
      indexes: indexInfos
    }
  }

  async searchSchema(pattern: string): Promise<SchemaSearchResult> {
    if (!this.pool) {
      throw createConnectionError('Not connected to database')
    }

    const searchTerm = `%${pattern}%`

    // Search tables
    const tables = await this.pool.query(
      `SELECT TABLE_NAME, TABLE_ROWS, ENGINE
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE ?
       ORDER BY TABLE_NAME`,
      [this.config.database, searchTerm]
    ) as Array<{ TABLE_NAME: string; TABLE_ROWS: bigint | null; ENGINE: string | null }>

    // Search columns
    const columns = await this.pool.query(
      `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND COLUMN_NAME LIKE ?
       ORDER BY TABLE_NAME, COLUMN_NAME`,
      [this.config.database, searchTerm]
    ) as Array<{ TABLE_NAME: string; COLUMN_NAME: string; COLUMN_TYPE: string }>

    return {
      tables: tables.map(row => ({
        name: row.TABLE_NAME,
        rows: row.TABLE_ROWS ? Number(row.TABLE_ROWS) : undefined,
        engine: row.ENGINE || undefined
      })),
      columns: columns.map(row => ({
        table: row.TABLE_NAME,
        column: row.COLUMN_NAME,
        type: row.COLUMN_TYPE
      }))
    }
  }

  async getTableSample(table: string, limit: number): Promise<QueryResult> {
    const query = `SELECT * FROM ${this.escapeIdentifier(table)} LIMIT ${Math.min(limit, 1000)}`
    return this.execute(query)
  }

  async getTableStats(table: string): Promise<{
    rows: number
    estimatedSizeMb: number
    lastUpdated: string
    indexes: number
    engine: string
  }> {
    if (!this.pool) {
      throw createConnectionError('Not connected to database')
    }

    const stats = await this.pool.query(
      `SELECT
         TABLE_ROWS,
         ROUND(DATA_LENGTH / 1024 / 1024, 2) AS size_mb,
         UPDATE_TIME,
         ENGINE
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [this.config.database, table]
    ) as Array<{
      TABLE_ROWS: bigint | null
      size_mb: number | null
      UPDATE_TIME: Date | null
      ENGINE: string | null
    }>

    if (stats.length === 0) {
      throw createValidationError(`Table ${table} not found`)
    }

    const row = stats[0]

    const indexCount = await this.pool.query(
      `SELECT COUNT(DISTINCT INDEX_NAME) AS count
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME != 'PRIMARY'`,
      [this.config.database, table]
    ) as Array<{ count: bigint }>

    return {
      rows: row.TABLE_ROWS ? Number(row.TABLE_ROWS) : 0,
      estimatedSizeMb: row.size_mb || 0,
      lastUpdated: row.UPDATE_TIME ? row.UPDATE_TIME.toISOString() : 'Unknown',
      indexes: Number(indexCount[0].count),
      engine: row.ENGINE || 'Unknown'
    }
  }

  async explain(query: string): Promise<Record<string, unknown>> {
    if (!this.pool) {
      throw createConnectionError('Not connected to database')
    }

    const rows = await this.pool.query(`EXPLAIN ${query}`) as Record<string, unknown>[]

    return rows[0] || {}
  }

  private escapeIdentifier(identifier: string): string {
    // MySQL identifier escaping using backticks
    return `\`${identifier.replace(/`/g, '``')}\``
  }
}
