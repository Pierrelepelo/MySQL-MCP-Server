import { describe, it, expect, beforeEach } from 'vitest'
import { AstValidator } from '../../../src/guards/ast-validator'
import type { ValidationResult } from '../../../src/types'

describe('AST Validator', () => {
  let validator: AstValidator

  beforeEach(() => {
    validator = new AstValidator()
  })

  describe('Safe Queries', () => {
    it('should validate simple SELECT', () => {
      const result = validator.validate('SELECT * FROM users')

      expect(result.valid).toBe(true)
      expect(result.operationClass).toBe('SAFE_READ')
    })

    it('should validate SELECT with WHERE clause', () => {
      const result = validator.validate('SELECT id, name FROM users WHERE active = 1')

      expect(result.valid).toBe(true)
    })

    it('should validate SELECT with LIMIT', () => {
      const result = validator.validate('SELECT * FROM users LIMIT 10')

      expect(result.valid).toBe(true)
    })
  })

  describe('Unsafe Queries', () => {
    it('should reject multiple statements', () => {
      const result = validator.validate('SELECT * FROM users; DROP TABLE users')

      expect(result.valid).toBe(false)
      expect(result.violations).toContain('Multiple statements detected')
    })

    it('should reject DROP TABLE', () => {
      const result = validator.validate('DROP TABLE users')

      expect(result.valid).toBe(false)
      expect(result.violations).toContain('Unsafe SQL command: DROP')
    })

    it('should reject DELETE', () => {
      const result = validator.validate('DELETE FROM users WHERE id = 1')

      expect(result.valid).toBe(false)
      expect(result.violations).toContain('Unsafe SQL command: DELETE')
    })

    it('should reject comment hiding attempts', () => {
      const result = validator.validate('SELECT * FROM users WHERE 1=1 -- comment')

      expect(result.valid).toBe(false)
      expect(result.violations).toContain('Comments detected in query')
    })
  })

  describe('Query Rewriting', () => {
    it('should add LIMIT when missing', () => {
      const result = validator.validate('SELECT * FROM large_table')

      expect(result.valid).toBe(true)
      expect(result.rewrittenSql).toBe('SELECT * FROM `large_table` LIMIT 1000')
    })

    it('should not add LIMIT if already present', () => {
      const result = validator.validate('SELECT * FROM users LIMIT 100')

      expect(result.valid).toBe(true)
      expect(result.rewrittenSql).toBeUndefined() // No rewrite needed
    })
  })
})
