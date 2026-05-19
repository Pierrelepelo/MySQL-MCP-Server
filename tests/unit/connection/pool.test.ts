import { describe, it, expect, beforeEach } from 'vitest'
import { ConnectionPool } from '../../../src/connection/pool'
import type { DatabaseConfig } from '../../../src/types'

describe('ConnectionPool', () => {
  let config: DatabaseConfig

  beforeEach(() => {
    config = {
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      database: 'depse2019',
      connectionTimeout: 5000,
      queryTimeout: 10000
    }
  })

  it('should create connection pool', async () => {
    const pool = new ConnectionPool(config)

    await pool.initialize()

    expect(pool.isConnected()).toBe(true)

    await pool.close()
  })

  it('should get connection from pool', async () => {
    const pool = new ConnectionPool(config)

    await pool.initialize()

    const connection = await pool.getConnection()

    expect(connection).toBeDefined()

    connection.release()
    await pool.close()
  })

  it('should execute simple query', async () => {
    const pool = new ConnectionPool(config)

    await pool.initialize()

    const result = await pool.query('SELECT 1 as test')

    expect(result).toEqual([{ test: 1 }])

    await pool.close()
  })
})
