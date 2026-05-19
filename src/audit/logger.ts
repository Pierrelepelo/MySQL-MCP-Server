import type { AuditLogEntry } from '../types/index.js'

export class AuditLogger {
  private logs: AuditLogEntry[]
  private maxLogs: number

  constructor(maxLogs: number = 1000) {
    this.logs = []
    this.maxLogs = maxLogs
  }

  log(entry: AuditLogEntry): void {
    this.logs.push({ ...entry })

    // Keep log size under limit
    if (this.logs.length > this.maxLogs) {
      this.logs.shift() // Remove oldest entry
    }
  }

  getLogs(): AuditLogEntry[] {
    return [...this.logs] // Return copy
  }

  getRecentLogs(count: number): AuditLogEntry[] {
    return this.logs.slice(-count)
  }

  clear(): void {
    this.logs = []
  }

  get size(): number {
    return this.logs.length
  }
}
