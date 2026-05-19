import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MySQLAdapter } from '../../src/adapters/mysql-adapter'
import { SchemaCache } from '../../src/schema/cache'
import { AstValidator } from '../../src/guards/ast-validator'
import { ResultFormatter } from '../../src/serialization/result-formatter'
import { AuditLogger } from '../../src/audit/logger'
import { createDiscoveryTools } from '../../src/tools/discovery'

describe('MCP Server Integration', () => {
  let adapter: MySQLAdapter
  let cache: SchemaCache
  let validator: AstValidator
  let formatter: ResultFormatter
  let auditLogger: AuditLogger
  const sessionId = 'test-session'

  beforeAll(async () => {
    const config = {
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'depse2019',
      connectionTimeout: 5000,
      queryTimeout: 10000
    }

    adapter = new MySQLAdapter(config)
    await adapter.connect()

    cache = new SchemaCache(5000)
    validator = new AstValidator({ maxLimit: 100 })
    formatter = new ResultFormatter(500)
    auditLogger = new AuditLogger()
  })

  afterAll(async () => {
    if (adapter.isConnected()) {
      await adapter.disconnect()
    }
  })

  it('should list databases', async () => {
    const tools = createDiscoveryTools(adapter, cache, formatter)
    const result = await tools.list_databases.handler({})

    expect(result.databases).toContain('depse2019')
  })

  it('should list tables', async () => {
    const tools = createDiscoveryTools(adapter, cache, formatter)
    const result = await tools.list_tables.handler({})

    expect(Array.isArray(result.tables)).toBe(true)
    expect(result.tables.length).toBeGreaterThan(0)
  })

  it('should search schema for naissance', async () => {
    const tools = createDiscoveryTools(adapter, cache, formatter)
    const result = await tools.search_schema.handler({ pattern: 'naissance' })

    expect(result.matchCount).toBeGreaterThan(0)
  })

  it('should validate and execute SELECT', async () => {
    const { createExecutionTools } = await import('../../src/tools/execution')
    const tools = createExecutionTools(adapter, validator, formatter, auditLogger, sessionId)

    // Validate first
    const validation = await tools.validate_query.handler({ sql: 'SELECT 1 as test' })
    expect(validation.valid).toBe(true)

    // Execute
    const result = await tools.execute_select.handler({ sql: 'SELECT 1 as test' })
    expect(result.rowCount).toBe(1)
    expect(result.rows[0]).toEqual({ test: 1 })
  })
})
