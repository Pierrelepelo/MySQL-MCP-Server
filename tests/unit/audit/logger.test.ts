import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuditLogger } from '../../../src/audit/logger'
import type { AuditLogEntry } from '../../../src/types'

describe('AuditLogger', () => {
  let logger: AuditLogger

  beforeEach(() => {
    logger = new AuditLogger()
  })

  it('should log query execution', () => {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      sessionId: 'test-session',
      rawSql: 'SELECT * FROM users',
      executionTimeMs: 10,
      rowsReturned: 5,
      operationClass: 'SAFE_READ'
    }

    logger.log(entry)

    const logs = logger.getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      sessionId: 'test-session',
      rawSql: 'SELECT * FROM users'
    })
  })

  it('should log query errors', () => {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      sessionId: 'test-session',
      rawSql: 'SELECT * FROM nonexistent',
      error: 'Table not found'
    }

    logger.log(entry)

    const logs = logger.getLogs()
    expect(logs[0].error).toBe('Table not found')
  })

  it('should limit log size', () => {
    const loggerWithLimit = new AuditLogger(10)

    // Add 15 entries
    for (let i = 0; i < 15; i++) {
      loggerWithLimit.log({
        timestamp: new Date().toISOString(),
        sessionId: 'test',
        rawSql: `SELECT ${i}`
      })
    }

    const logs = loggerWithLimit.getLogs()
    expect(logs.length).toBeLessThanOrEqual(10)
  })

  it('should clear logs', () => {
    logger.log({
      timestamp: new Date().toISOString(),
      sessionId: 'test',
      rawSql: 'SELECT 1'
    })

    logger.clear()

    const logs = logger.getLogs()
    expect(logs).toHaveLength(0)
  })
})
