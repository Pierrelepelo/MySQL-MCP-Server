import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getConfig } from '../../../src/config/env'
import { ErrorCode, McpServerError } from '../../../src/utils/errors'

describe('Environment Configuration', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('should load required environment variables', () => {
    process.env.MYSQL_HOST = 'testhost'
    process.env.MYSQL_PORT = '3307'
    process.env.MYSQL_USER = 'testuser'
    process.env.MYSQL_PASSWORD = 'testpass'
    process.env.MYSQL_DATABASE = 'testdb'

    const config = getConfig()

    expect(config.host).toBe('testhost')
    expect(config.port).toBe(3307)
    expect(config.user).toBe('testuser')
    expect(config.password).toBe('testpass')
    expect(config.database).toBe('testdb')
  })

  it('should throw when MYSQL_DATABASE is missing', () => {
    delete process.env.MYSQL_DATABASE

    expect(() => getConfig()).toThrow(McpServerError)
  })

  it('should use default values for optional variables', () => {
    process.env.MYSQL_DATABASE = 'testdb'

    const config = getConfig()

    expect(config.connectionTimeout).toBe(30000)
    expect(config.queryTimeout).toBe(60000)
    expect(config.maxLimit).toBe(1000) // balanced profile default
  })

  it('should apply safe profile', () => {
    process.env.MYSQL_DATABASE = 'testdb'
    process.env.MYSQL_PROFILE = 'safe'

    const config = getConfig()

    expect(config.maxLimit).toBe(100)
  })

  it('should apply power profile', () => {
    process.env.MYSQL_DATABASE = 'testdb'
    process.env.MYSQL_PROFILE = 'power'

    const config = getConfig()

    expect(config.maxLimit).toBe(10000)
  })
})
