import { z } from 'zod'
import type { DatabaseAdapter, ValidationResult } from '../types/index.js'
import { AstValidator } from '../guards/ast-validator.js'
import { ResultFormatter } from '../serialization/result-formatter.js'
import { AuditLogger } from '../audit/logger.js'
import { createValidationError, createPolicyViolationError } from '../utils/errors.js'

// Tool input schemas
const ValidateQueryInput = z.object({
  sql: z.string().min(1)
})
const ExecuteSelectInput = z.object({
  sql: z.string().min(1)
})

export function createExecutionTools(
  adapter: DatabaseAdapter,
  validator: AstValidator,
  formatter: ResultFormatter,
  auditLogger: AuditLogger,
  sessionId: string
) {
  return {
    validate_query: {
      name: 'validate_query',
      description: 'Validate a SQL query without executing it. Returns operation class, rewritten SQL, warnings, and policy violations.',
      inputSchema: ValidateQueryInput.shape,
      handler: async (input: z.infer<typeof ValidateQueryInput>): Promise<ValidationResult> => {
        const result = validator.validate(input.sql)

        // Log validation attempt
        auditLogger.log({
          timestamp: new Date().toISOString(),
          sessionId,
          rawSql: input.sql,
          normalizedSql: result.rewrittenSql,
          operationClass: result.operationClass
        })

        return result
      }
    },

    execute_select: {
      name: 'execute_select',
      description: 'Execute a SELECT query with automatic validation, LIMIT injection, and result formatting',
      inputSchema: ExecuteSelectInput.shape,
      handler: async (input: z.infer<typeof ExecuteSelectInput>) => {
        // Validate first
        const validation = validator.validate(input.sql)

        if (!validation.valid) {
          throw createPolicyViolationError(
            'Query validation failed',
            { violations: validation.violations }
          )
        }

        // Use rewritten SQL if provided
        const sqlToExecute = validation.rewrittenSql || input.sql

        // Execute
        const startTime = Date.now()

        try {
          const result = await adapter.execute(sqlToExecute)

          const executionTimeMs = Date.now() - startTime

          // Format results
          const formatted = formatter.format(result)

          // Log execution
          auditLogger.log({
            timestamp: new Date().toISOString(),
            sessionId,
            rawSql: input.sql,
            normalizedSql: sqlToExecute,
            executionTimeMs,
            rowsReturned: formatted.rowCount,
            operationClass: validation.operationClass
          })

          return {
            columns: formatted.columns,
            rows: formatted.rows,
            rowCount: formatted.rowCount,
            executionTimeMs,
            warnings: validation.warnings || []
          }
        } catch (error) {
          // Log error
          auditLogger.log({
            timestamp: new Date().toISOString(),
            sessionId,
            rawSql: input.sql,
            normalizedSql: sqlToExecute,
            executionTimeMs: Date.now() - startTime,
            error: error instanceof Error ? error.message : String(error)
          })

          throw error
        }
      }
    }
  }
}
