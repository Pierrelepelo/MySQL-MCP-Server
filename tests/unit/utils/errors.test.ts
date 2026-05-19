import { describe, it, expect } from 'vitest'
import { ErrorCode, McpServerError, createValidationError, createPolicyViolationError } from '../../../src/utils/errors'

describe('Error System', () => {
  it('should create error with correct code and message', () => {
    const error = createValidationError('Invalid SQL syntax')

    expect(error).toBeInstanceOf(McpServerError)
    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR)
    expect(error.message).toBe('Invalid SQL syntax')
  })

  it('should attach details to error', () => {
    const error = createPolicyViolationError('Query too complex', { maxJoins: 5, actualJoins: 10 })

    expect(error.details).toEqual({ maxJoins: 5, actualJoins: 10 })
  })

  it('should have correct error name', () => {
    const error = createValidationError('Test error')

    expect(error.name).toBe('McpServerError')
  })
})
