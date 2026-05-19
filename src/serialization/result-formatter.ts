import type { QueryResult } from '../types/index.js'

export class ResultFormatter {
  private maxFieldLength: number

  constructor(maxFieldLength: number = 5000) {
    this.maxFieldLength = maxFieldLength
  }

  format(result: QueryResult): QueryResult {
    const formattedRows = result.rows.map(row => this.formatRow(row))

    return {
      columns: result.columns,
      rows: formattedRows,
      rowCount: result.rowCount,
      executionTimeMs: result.executionTimeMs
    }
  }

  private formatRow(row: Record<string, unknown>): Record<string, unknown> {
    const formatted: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(row)) {
      formatted[key] = this.formatValue(value)
    }

    return formatted
  }

  private formatValue(value: unknown): unknown {
    // Handle NULL
    if (value === null || value === undefined) {
      return null
    }

    // Handle Buffer/BLOB
    if (Buffer.isBuffer(value)) {
      return {
        type: 'BLOB',
        size: value.length,
        preview: '<binary omitted>',
        mimeType: this.detectMimeType(value)
      }
    }

    // Handle Date objects
    if (value instanceof Date) {
      return {
        value: value.toISOString(),
        timezone: 'UTC',
        original: value.toISOString()
      }
    }

    // Handle strings (truncate long text)
    if (typeof value === 'string') {
      return this.truncateString(value)
    }

    // Handle numbers
    if (typeof value === 'number') {
      // Check if it looks like a decimal that should be preserved
      if (!Number.isInteger(value)) {
        return value.toString() // Preserve as string to avoid precision loss
      }
      return value
    }

    // Handle objects (JSON, etc.)
    if (typeof value === 'object') {
      try {
        const jsonString = JSON.stringify(value)
        if (jsonString.length > this.maxFieldLength) {
          return this.truncateString(jsonString)
        }
        return value
      } catch {
        return '[Object]'
      }
    }

    return value
  }

  private truncateString(str: string): string {
    if (str.length <= this.maxFieldLength) {
      return str
    }

    return `${str.substring(0, this.maxFieldLength)}... (truncated, was ${str.length} chars)`
  }

  private detectMimeType(buffer: Buffer): string {
    // Simple magic number detection
    if (buffer.length < 4) return 'application/octet-stream'

    const header = buffer.subarray(0, 4).toString('hex')

    // PNG
    if (header === '89504e47') return 'image/png'
    // JPEG
    if (header.startsWith('ffd8')) return 'image/jpeg'
    // GIF
    if (header === '47494638') return 'image/gif'
    // PDF
    if (header.startsWith('25504446')) return 'application/pdf'

    return 'application/octet-stream'
  }
}
