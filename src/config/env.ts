import type { DatabaseConfig } from '../types/index.js'
import { createValidationError } from '../utils/errors.js'

interface ProfileConfig {
  maxLimit: number
  maxJoins: number
  allowSubqueries: boolean
}

const PROFILES: Record<string, ProfileConfig> = {
  safe: {
    maxLimit: 100,
    maxJoins: 0,
    allowSubqueries: false
  },
  balanced: {
    maxLimit: 1000,
    maxJoins: 5,
    allowSubqueries: true
  },
  power: {
    maxLimit: 10000,
    maxJoins: 10,
    allowSubqueries: true
  }
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key]
  if (value === undefined) return defaultValue
  const parsed = parseInt(value, 10)
  if (isNaN(parsed)) {
    throw createValidationError(`Invalid ${key}: must be a number`, { value })
  }
  return parsed
}

function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue
}

export function loadDatabaseConfig(): DatabaseConfig {
  const host = getEnvString('MYSQL_HOST', 'localhost')
  const port = getEnvNumber('MYSQL_PORT', 3306)
  const user = getEnvString('MYSQL_USER', 'root')
  const password = getEnvString('MYSQL_PASSWORD', '')
  const database = getEnvString('MYSQL_DATABASE', '')

  if (!database) {
    throw createValidationError('MYSQL_DATABASE is required')
  }

  // Load profile defaults
  const profile = getEnvString('MYSQL_PROFILE', 'balanced')
  const profileConfig = PROFILES[profile] || PROFILES.balanced

  return {
    host,
    port,
    user,
    password,
    database,
    connectionTimeout: getEnvNumber('MYSQL_CONNECTION_TIMEOUT', 30) * 1000,
    queryTimeout: getEnvNumber('MYSQL_QUERY_TIMEOUT', 60) * 1000,
    maxRows: getEnvNumber('MYSQL_MAX_ROWS', profileConfig.maxLimit),
    maxLimit: getEnvNumber('MYSQL_MAX_LIMIT', profileConfig.maxLimit),
    maxExecutionMs: getEnvNumber('MYSQL_MAX_EXECUTION_MS', 10000),
    schemaCacheTtlMs: getEnvNumber('SCHEMA_CACHE_TTL_MS', 300000),
    maxFieldLength: getEnvNumber('MAX_FIELD_LENGTH', 5000)
  }
}

export function getConfig(): DatabaseConfig {
  return loadDatabaseConfig()
}
