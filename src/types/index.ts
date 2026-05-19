// Core Types
export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  executionTimeMs: number
}

export interface TableInfo {
  name: string
  rows?: number
  engine?: string
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  default?: string
  key?: string
}

export interface TableSchema {
  tableName: string
  columns: ColumnInfo[]
  indexes?: IndexInfo[]
}

export interface IndexInfo {
  name: string
  columns: string[]
  unique: boolean
  type: string
}

// Schema Search Result
export interface SchemaSearchResult {
  tables: TableInfo[]
  columns: Array<{
    table: string
    column: string
    type: string
  }>
}

// Query Validation Result
export interface ValidationResult {
  valid: boolean
  operationClass?: 'SAFE_READ' | 'HEAVY_READ' | 'WRITE' | 'ADMIN'
  rewrittenSql?: string
  violations?: string[]
  warnings?: string[]
  estimatedRisk?: 'LOW' | 'MEDIUM' | 'HIGH'
}

// Audit Log Entry
export interface AuditLogEntry {
  timestamp: string
  sessionId: string
  rawSql: string
  normalizedSql?: string
  executionTimeMs?: number
  rowsReturned?: number
  operationClass?: string
  error?: string
}

// Configuration
export interface DatabaseConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
  connectionTimeout?: number
  queryTimeout?: number
  maxRows?: number
  maxLimit?: number
  maxExecutionMs?: number
  schemaCacheTtlMs?: number
  maxFieldLength?: number
}

// Database Adapter Interface
export interface DatabaseAdapter {
  connect(): Promise<void>
  disconnect(): Promise<void>
  execute(query: string): Promise<QueryResult>
  getDatabases(): Promise<string[]>
  getTables(database?: string): Promise<TableInfo[]>
  getTableSchema(table: string): Promise<TableSchema>
  searchSchema(pattern: string): Promise<SchemaSearchResult>
  getTableSample(table: string, limit: number): Promise<QueryResult>
  getTableStats(table: string): Promise<{ rows: number; estimatedSizeMb: number; lastUpdated: string; indexes: number; engine: string }>
  explain(query: string): Promise<Record<string, unknown>>
  isConnected(): boolean
}
