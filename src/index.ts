#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { MySQLAdapter } from './adapters/mysql-adapter.js'
import { SchemaCache } from './schema/cache.js'
import { AstValidator } from './guards/ast-validator.js'
import { ResultFormatter } from './serialization/result-formatter.js'
import { AuditLogger } from './audit/logger.js'
import { createDiscoveryTools } from './tools/discovery.js'
import { createExecutionTools } from './tools/execution.js'
import { getConfig } from './config/env.js'

async function main() {
  // Load configuration
  const config = getConfig()

  // Initialize components
  const adapter = new MySQLAdapter(config)
  await adapter.connect()

  const cache = new SchemaCache(config.schemaCacheTtlMs || 300000)
  const validator = new AstValidator({
    maxLimit: config.maxLimit || 1000
  })
  const formatter = new ResultFormatter(config.maxFieldLength || 5000)
  const auditLogger = new AuditLogger()

  // Generate session ID
  const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`

  // Create MCP server
  const server = new McpServer({
    name: 'mysql-mcp-server',
    version: '0.1.0'
  })

  // Register discovery tools
  const discoveryTools = createDiscoveryTools(adapter, cache, formatter)

  server.registerTool(
    discoveryTools.list_databases.name,
    {
      description: discoveryTools.list_databases.description,
      inputSchema: z.object({})
    },
    async () => {
      const result = await discoveryTools.list_databases.handler({})
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      }
    }
  )

  server.registerTool(
    discoveryTools.list_tables.name,
    {
      description: discoveryTools.list_tables.description,
      inputSchema: z.object({
        database: z.string().optional()
      })
    },
    async (input) => {
      const result = await discoveryTools.list_tables.handler(input)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      }
    }
  )

  server.registerTool(
    discoveryTools.describe_table.name,
    {
      description: discoveryTools.describe_table.description,
      inputSchema: z.object({
        table: z.string()
      })
    },
    async (input) => {
      const result = await discoveryTools.describe_table.handler(input)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      }
    }
  )

  server.registerTool(
    discoveryTools.search_schema.name,
    {
      description: discoveryTools.search_schema.description,
      inputSchema: z.object({
        pattern: z.string().min(1)
      })
    },
    async (input) => {
      const result = await discoveryTools.search_schema.handler(input)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      }
    }
  )

  server.registerTool(
    discoveryTools.get_table_sample.name,
    {
      description: discoveryTools.get_table_sample.description,
      inputSchema: z.object({
        table: z.string(),
        limit: z.number().min(1).max(100).default(5)
      })
    },
    async (input) => {
      const result = await discoveryTools.get_table_sample.handler(input)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      }
    }
  )

  server.registerTool(
    discoveryTools.get_table_stats.name,
    {
      description: discoveryTools.get_table_stats.description,
      inputSchema: z.object({
        table: z.string()
      })
    },
    async (input) => {
      const result = await discoveryTools.get_table_stats.handler(input)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      }
    }
  )

  server.registerTool(
    discoveryTools.refresh_schema_cache.name,
    {
      description: discoveryTools.refresh_schema_cache.description,
      inputSchema: z.object({})
    },
    async () => {
      const result = await discoveryTools.refresh_schema_cache.handler({})
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      }
    }
  )

  // Register execution tools
  const executionTools = createExecutionTools(adapter, validator, formatter, auditLogger, sessionId)

  server.registerTool(
    executionTools.validate_query.name,
    {
      description: executionTools.validate_query.description,
      inputSchema: z.object({
        sql: z.string().min(1)
      })
    },
    async (input) => {
      const result = await executionTools.validate_query.handler(input)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      }
    }
  )

  server.registerTool(
    executionTools.execute_select.name,
    {
      description: executionTools.execute_select.description,
      inputSchema: z.object({
        sql: z.string().min(1)
      })
    },
    async (input) => {
      const result = await executionTools.execute_select.handler(input)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      }
    }
  )

  // Start server
  const transport = new StdioServerTransport()
  await server.connect(transport)

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await adapter.disconnect()
    process.exit(0)
  })
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
