import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MySQLAdapter } from '../../../src/adapters/mysql-adapter'
import type { DatabaseConfig } from '../../../src/types'

describe('MySQLAdapter', () => {
  let adapter: MySQLAdapter
  const config: DatabaseConfig = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'depse2019',
    connectionTimeout: 5000,
    queryTimeout: 10000
  }

  beforeAll(async () => {
    adapter = new MySQLAdapter(config)
    await adapter.connect()
  })

  afterAll(async () => {
    if (adapter.isConnected()) {
      await adapter.disconnect()
    }
  })

  it('should connect to database', () => {
    expect(adapter.isConnected()).toBe(true)
  })

  it('should list databases', async () => {
    const databases = await adapter.getDatabases()

    expect(Array.isArray(databases)).toBe(true)
    expect(databases).toContain('depse2019')
  })

  it('should list tables', async () => {
    const tables = await adapter.getTables()

    expect(Array.isArray(tables)).toBe(true)
    expect(tables.length).toBeGreaterThan(0)
    expect(tables[0].name).toBeDefined()
  })

  it('should get table schema', async () => {
    const schema = await adapter.getTableSchema('depse_log_localite')

    expect(schema.tableName).toBe('depse_log_localite')
    expect(Array.isArray(schema.columns)).toBe(true)
    expect(schema.columns.length).toBeGreaterThan(0)
  })

  it('should search schema', async () => {
    const result = await adapter.searchSchema('naissance')

    expect(result.tables.length + result.columns.length).toBeGreaterThan(0)
  })

  it('should execute SELECT query', async () => {
    const result = await adapter.execute('SELECT 1 as test, "hello" as message')

    expect(result.columns).toEqual(['test', 'message'])
    expect(result.rows).toEqual([{ test: 1, message: 'hello' }])
    expect(result.rowCount).toBe(1)
  })

  it('should get table sample', async () => {
    const result = await adapter.getTableSample('depse_log_localite', 5)

    expect(result.rowCount).toBeLessThanOrEqual(5)
  })
})
