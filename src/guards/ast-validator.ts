import { Parser as SQLParser } from 'node-sql-parser'
import type { ValidationResult } from '../types/index.js'

/**
 * Options for AST validation
 */
export interface ValidationOptions {
  /** Maximum number of rows allowed in SELECT queries (default: 1000) */
  maxLimit?: number
  /** Whether to allow multiple SQL statements separated by semicolons (default: false) */
  allowMultipleStatements?: boolean
}

/**
 * AST Validator for SQL queries using node-sql-parser
 *
 * Provides deep SQL inspection by parsing queries into an Abstract Syntax Tree (AST),
 * allowing detection of injection attempts, unsafe operations, and automatic query rewriting.
 */
export class AstValidator {
  private parser: SQLParser
  private options: Required<ValidationOptions>

  constructor(options: ValidationOptions = {}) {
    this.parser = new SQLParser()
    this.options = {
      maxLimit: options.maxLimit ?? 1000,
      allowMultipleStatements: options.allowMultipleStatements ?? false
    }
  }

  /**
   * Validate a SQL query and optionally rewrite it for safety
   *
   * @param sql - The SQL query to validate
   * @returns ValidationResult with validation status, operation class, and optionally rewritten SQL
   */
  validate(sql: string): ValidationResult {
    const violations: string[] = []
    const warnings: string[] = []
    let rewrittenSql: string | undefined

    try {
      // Parse the SQL into an AST
      const ast = this.parser.astify(sql)

      // Check for multiple statements
      if (!this.options.allowMultipleStatements && Array.isArray(ast)) {
        violations.push('Multiple statements detected')
        return {
          valid: false,
          violations,
          estimatedRisk: 'HIGH'
        }
      }

      // Check for comments in the original SQL
      if (this.containsComments(sql)) {
        violations.push('Comments detected in query')
        return {
          valid: false,
          violations,
          estimatedRisk: 'MEDIUM'
        }
      }

      // Normalize to array for uniform processing
      const statements = Array.isArray(ast) ? ast : [ast]

      // Validate each statement and classify operation
      let operationClass: 'SAFE_READ' | 'HEAVY_READ' | 'WRITE' | 'ADMIN' = 'SAFE_READ'

      for (const statement of statements) {
        const validationResult = this.validateAst(statement as unknown as Record<string, unknown>)

        if (!validationResult.valid) {
          violations.push(...(validationResult.violations || []))
        }

        if (validationResult.operationClass) {
          // Upgrade operation class if needed (SAFE_READ < HEAVY_READ < WRITE < ADMIN)
          const currentLevel = this.getOperationLevel(operationClass)
          const newLevel = this.getOperationLevel(validationResult.operationClass)

          if (newLevel > currentLevel) {
            operationClass = validationResult.operationClass
          }
        }

        if (validationResult.warnings) {
          warnings.push(...validationResult.warnings)
        }
      }

      // If there are violations, return early
      if (violations.length > 0) {
        return {
          valid: false,
          violations,
          estimatedRisk: 'HIGH'
        }
      }

      // Attempt to add LIMIT if missing and this is a SELECT
      const limitResult = this.maybeAddLimit(ast, sql)
      if (limitResult) {
        rewrittenSql = limitResult
      }

      return {
        valid: true,
        operationClass,
        rewrittenSql,
        warnings: warnings.length > 0 ? warnings : undefined,
        estimatedRisk: this.estimateRisk(operationClass)
      }
    } catch (error) {
      // Parsing error - likely malformed SQL or syntax error
      violations.push(`SQL parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return {
        valid: false,
        violations,
        estimatedRisk: 'HIGH'
      }
    }
  }

  /**
   * Check if SQL contains comments (single-line or multi-line)
   */
  private containsComments(sql: string): boolean {
    // Check for single-line comments (--)
    if (/--/.test(sql)) {
      return true
    }

    // Check for multi-line comments (/* */)
    if (/\/\*/.test(sql)) {
      return true
    }

    // Check for hash comments (#)
    if (/#/.test(sql)) {
      return true
    }

    return false
  }

  /**
   * Validate an AST node
   */
  private validateAst(ast: Record<string, unknown>): ValidationResult {
    const violations: string[] = []
    const warnings: string[] = []

    // Check for unsafe SQL commands
    const astType = (ast.type as string)?.toUpperCase()

    const unsafeCommands = ['DROP', 'DELETE', 'TRUNCATE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE', 'GRANT', 'REVOKE']
    if (unsafeCommands.includes(astType)) {
      violations.push(`Unsafe SQL command: ${astType}`)
    }

    // Classify the operation
    const operationClass = this.classifyOperation(ast)

    // Add warnings for heavy operations
    if (operationClass === 'HEAVY_READ') {
      warnings.push('Query may scan large amounts of data')
    }

    return {
      valid: violations.length === 0,
      operationClass,
      violations: violations.length > 0 ? violations : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    }
  }

  /**
   * Classify the operation type based on AST analysis
   */
  private classifyOperation(ast: Record<string, unknown>): 'SAFE_READ' | 'HEAVY_READ' | 'WRITE' | 'ADMIN' {
    const astType = (ast.type as string)?.toUpperCase()

    // DDL operations
    if (['DROP', 'CREATE', 'ALTER', 'TRUNCATE'].includes(astType)) {
      return 'ADMIN'
    }

    // DML operations
    if (['INSERT', 'UPDATE', 'DELETE'].includes(astType)) {
      return 'WRITE'
    }

    // SELECT operations - check for heavy characteristics
    if (astType === 'SELECT') {
      if (this.hasAggregation(ast) || this.hasJoins(ast) || this.hasSubqueries(ast)) {
        return 'HEAVY_READ'
      }
      return 'SAFE_READ'
    }

    // Default to SAFE_READ for unknown operations
    return 'SAFE_READ'
  }

  /**
   * Check if the AST contains aggregation functions
   */
  private hasAggregation(ast: Record<string, unknown>): boolean {
    const columns = ast.columns as Array<{ expr?: { type?: string; function?: string } }>

    if (!columns || !Array.isArray(columns)) {
      return false
    }

    const aggregationFunctions = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'GROUP_CONCAT']

    return columns.some(col => {
      const funcName = (col.expr?.function || col.expr?.type)?.toString().toUpperCase() || ''
      return aggregationFunctions.includes(funcName)
    })
  }

  /**
   * Check if the AST contains JOINs
   */
  private hasJoins(ast: Record<string, unknown>): boolean {
    // Check for JOIN in FROM clause
    const from = ast.from as Array<unknown>

    if (!from || !Array.isArray(from)) {
      return false
    }

    return from.length > 1 || from.some((item: unknown) => {
      if (typeof item === 'object' && item !== null && 'join' in item) {
        return true
      }
      return false
    })
  }

  /**
   * Check if the AST contains subqueries
   */
  private hasSubqueries(ast: Record<string, unknown>): boolean {
    // This is a simplified check - a full implementation would recursively traverse the AST
    // For now, we'll check if there are nested SELECT statements in WHERE or FROM clauses
    const sql = JSON.stringify(ast)

    // Look for nested selects (indicated by select within select)
    // A proper subquery would have a SELECT nested inside another clause
    const selectCount = (sql.match(/"type":"select"/g) || []).length
    return selectCount > 1
  }

  /**
   * Add LIMIT to SELECT queries if missing
   */
  private maybeAddLimit(ast: unknown, originalSql: string): string | undefined {
    // Only add LIMIT to single SELECT statements
    if (Array.isArray(ast)) {
      return undefined
    }

    const statement = ast as Record<string, unknown>

    if ((statement.type as string)?.toUpperCase() !== 'SELECT') {
      return undefined
    }

    // Check if LIMIT already exists
    if (statement.limit) {
      return undefined
    }

    try {
      // Add LIMIT to the AST - clone the original to avoid mutation
      const modifiedAst = {
        ...statement,
        limit: {
          value: [this.options.maxLimit],
          separator: '',
          offset: null
        }
      }

      // Convert back to SQL
      return this.parser.sqlify(modifiedAst as any)
    } catch {
      // If SQLify fails, return undefined
      return undefined
    }
  }

  /**
   * Get numeric level for operation class (for comparison)
   */
  private getOperationLevel(operationClass: 'SAFE_READ' | 'HEAVY_READ' | 'WRITE' | 'ADMIN'): number {
    const levels = {
      SAFE_READ: 1,
      HEAVY_READ: 2,
      WRITE: 3,
      ADMIN: 4
    }
    return levels[operationClass] || 1
  }

  /**
   * Estimate risk level based on operation class
   */
  private estimateRisk(operationClass: 'SAFE_READ' | 'HEAVY_READ' | 'WRITE' | 'ADMIN'): 'LOW' | 'MEDIUM' | 'HIGH' {
    const riskMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH'> = {
      SAFE_READ: 'LOW',
      HEAVY_READ: 'MEDIUM',
      WRITE: 'HIGH',
      ADMIN: 'HIGH'
    }
    return riskMap[operationClass] || 'LOW'
  }
}
