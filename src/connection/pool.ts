import mysql from 'mysql2/promise'
import type { DatabaseConfig, QueryResult } from '../types/index.js'
import { createConnectionError } from '../utils/errors.js'

export interface PooledConnection {
  connection: mysql.Connection
  release(): void
}

export class ConnectionPool {
  private pool?: mysql.Pool
  private config: DatabaseConfig

  constructor(config: DatabaseConfig) {
    this.config = config
  }

  async initialize(): Promise<void> {
    try {
      this.pool = mysql.createPool({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        multipleStatements: false // Security: never allow multiple statements
      })

      // Test connection
      await this.getConnection()
    } catch (error) {
      throw createConnectionError(
        `Failed to connect to database: ${error}`,
        { host: this.config.host, port: this.config.port, database: this.config.database }
      )
    }
  }

  async getConnection(): Promise<PooledConnection> {
    if (!this.pool) {
      throw createConnectionError('Connection pool not initialized')
    }

    const connection = await this.pool.getConnection()

    return {
      connection,
      release: () => connection.release()
    }
  }

  async query(sql: string, params?: unknown[]): Promise<unknown[]> {
    if (!this.pool) {
      throw createConnectionError('Connection pool not initialized')
    }

    try {
      const [rows] = await this.pool.query({
        sql,
        values: params || [],
        timeout: this.config.queryTimeout
      })

      return rows as unknown[]
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ER_QUERY_TIMEOUT') {
        throw createConnectionError('Query timeout exceeded', { sql, timeout: this.config.queryTimeout })
      }
      throw error
    }
  }

  isConnected(): boolean {
    return this.pool !== undefined
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end()
      this.pool = undefined
    }
  }
}
