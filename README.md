# MySQL MCP Server

AI-safe MySQL/MariaDB Model Context Protocol server with schema intelligence, query validation, and audit logging.

## Features

- **Schema Intelligence**: Fast schema discovery with `search_schema` for legacy databases
- **AI-Safe Validation**: AST-based SQL validation with auto-rewriting
- **Query Planning**: Validate queries before execution
- **Audit Logging**: Track all queries with fingerprinting
- **Result Safety**: Automatic BLOB handling, text truncation, decimal preservation
- **Profile System**: safe/balanced/power presets for different use cases

## Installation

```bash
npm install -g mysql-mcp-server
```

## Configuration

Set environment variables:

```bash
export MYSQL_HOST=localhost
export MYSQL_PORT=3306
export MYSQL_USER=root
export MYSQL_PASSWORD=
export MYSQL_DATABASE=your_database
```

Optional configuration:

```bash
export MYSQL_PROFILE=balanced  # safe|balanced|power
export MYSQL_MAX_LIMIT=1000
export SCHEMA_CACHE_TTL_MS=300000
```

## MCP Configuration

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "node",
      "args": ["/path/to/mysql-mcp-server/dist/index.js"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_USER": "root",
        "MYSQL_DATABASE": "mydb"
      }
    }
  }
}
```

## Available Tools

### Discovery Tools

- `list_databases` - List accessible databases
- `list_tables` - List tables with row counts
- `describe_table` - Get table schema
- `search_schema` - Search for tables/columns by pattern
- `get_table_sample` - Get sample rows for AI understanding
- `get_table_stats` - Get table statistics
- `refresh_schema_cache` - Refresh schema cache

### Execution Tools

- `validate_query` - Validate without executing
- `execute_select` - Execute SELECT with safeguards

## Usage Example

```bash
# Start the server
mysql-mcp-server

# In Claude Code:
# "List all tables"
# → Calls list_tables

# "Find tables related to naissance"
# → Calls search_schema("naissance")

# "Show me 5 rows from depse_log_localite_naissance"
# → Calls get_table_sample("depse_log_localite_naissance", 5)

# "Execute SELECT * FROM depse_log_localite WHERE valide = 1 LIMIT 10"
# → Validates, rewrites if needed, executes
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Start dev server
npm run dev
```

## Security

- Read-only by default
- Multiple statements blocked
- Comments blocked
- Write operations require explicit opt-in
- Prepared statements for structured queries

## License

MIT
