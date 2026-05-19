export enum ErrorCode {
  // Validation layer
  VALIDATION_ERROR = "VALIDATION_ERROR",
  POLICY_VIOLATION = "POLICY_VIOLATION",
  UNSAFE_SQL_DETECTED = "UNSAFE_SQL_DETECTED",

  // Resource limits
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  QUERY_TIMEOUT = "QUERY_TIMEOUT",
  CONNECTION_ERROR = "CONNECTION_ERROR",

  // Data handling
  SERIALIZATION_ERROR = "SERIALIZATION_ERROR",
  CACHE_MISS = "CACHE_MISS",

  // Permissions
  PERMISSION_DENIED = "PERMISSION_DENIED",
  TOOL_NOT_ALLOWED = "TOOL_NOT_ALLOWED"
}

export class McpServerError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'McpServerError'
  }
}

export function createValidationError(message: string, details?: Record<string, unknown>): McpServerError {
  return new McpServerError(ErrorCode.VALIDATION_ERROR, message, details)
}

export function createPolicyViolationError(message: string, details?: Record<string, unknown>): McpServerError {
  return new McpServerError(ErrorCode.POLICY_VIOLATION, message, details)
}

export function createConnectionError(message: string, details?: Record<string, unknown>): McpServerError {
  return new McpServerError(ErrorCode.CONNECTION_ERROR, message, details)
}
