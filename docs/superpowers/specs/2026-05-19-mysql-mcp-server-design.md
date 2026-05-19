# MySQL MCP Server - Production-Grade Design Specification

**Date:** 2026-05-19
**Status:** Approved for Implementation
**Version:** 1.1 (Revised with expert review feedback)

## Executive Summary

A reusable, AI-safe MySQL/MariaDB MCP server providing structured database access for Claude Code and other AI agents. The server implements defense-in-depth security with multiple validation layers, schema intelligence, and enterprise observability.

**Key Differentiator:** Not merely a database wrapper, but an AI-safe database execution platform with policy enforcement, operational safeguards, and extensibility.

---

## Architecture

### Layered Architecture

```
Claude Code
    ↓
MCP Transport Layer
    ↓
Tool Registry
    ↓
Authentication (future)
    ↓
Permission Layer (tool-level allowlist)
    ↓
Rate Limiter (query/schema call limits)
    ↓
SQL Guard (3-phase)
    ├── AST Validation (node-sql-parser)
    ├── Policy Validation (env-driven)
    └── Query Rewriting (auto-LIMIT, hints)
    ↓
Schema Cache (TTL + manual refresh)
    ↓
Query Executor (with timeouts)
    ↓
Connection Pool
    ↓
MySQL (read-only user preferred)

Parallel Paths:
    → Audit Logger (fingerprinting enabled)
    → Metrics Collector
```

### Core Components

1. **Connection Manager** — Pooling, auto-reconnection, environment-based configuration
2. **Schema Inspector + Cache** — information_schema queries with 5-minute TTL
3. **SQL Guard** — 3-phase validation (AST, policy, rewriting)
4. **Query Planner** — Validation, cost estimation, EXPLAIN analysis
5. **Query Executor** — Safe execution with limits and timeouts
6. **Permission Layer** — Tool-level allowlist
7. **Rate Limiter** — Query/schema call limits per minute
8. **Audit Logger** — Fingerprinting for analytics and compliance
9. **Metrics Collector** — Performance and health metrics with OpenTelemetry hooks

### Database-Agnostic Design

```typescript
interface DatabaseAdapter {
  connect(): Promise<void>
  execute(query: Query): Promise<QueryResult>
  getSchema(): Promise<SchemaData>
  explain(query: string): Promise<ExplainResult>
  estimateCost(query: string): Promise<CostEstimate>
}

class MySQLAdapter implements DatabaseAdapter { /* ... */ }
```

Future adapters for PostgreSQL, SQLite, etc. require only implementing this interface.

### Planning vs Execution Separation

**Critical architectural separation** — Planning tools never execute queries:

```
Planning Layer (Read-Only Analysis)
  ├── validate_query
  ├── estimate_query_cost
  └── explain_query

Execution Layer (With Side Effects)
  └── execute_select
```

**Why this separation matters:**
- **Caching:** Plan results can be cached without data freshness concerns
- **Dry runs:** Validate and optimize before execution
- **Simulation:** Test query impact without touching data
- **AI reasoning:** Claude can analyze multiple approaches safely

**Example workflow:**
```
validate_query(sql)     → Is this safe?
→ estimate_query_cost(sql)  → Will this be expensive?
→ explain_query(sql)    → How will it execute?
→ execute_select(sql)   → Now execute it
```

### OpenTelemetry Hooks (Future-Proofing)

```typescript
interface MetricsCollector {
  incrementCounter(name: string, tags?: Record<string, string>): void
  recordLatency(name: string, durationMs: number, tags?: Record<string, string>): void
  recordError(name: string, error: Error, tags?: Record<string, string>): void
  recordGauge(name: string, value: number, tags?: Record<string, string>): void
}
```

**This enables future integrations:**
- Prometheus counter/metric export
- OpenTelemetry tracing
- Datadog custom metrics
- Grafana dashboards

**Cost:** Minimal — interface-first design costs almost nothing to implement now

---

## Tool Specification

### Discovery Tools (Metadata, No Rate Limit)

| Tool | Purpose | Parameters | Returns |
|------|---------|------------|---------|
| `list_databases` | Show accessible databases | - | Array of database names |
| `list_tables` | List tables with row counts | database? (optional) | Array of `{name, rows, engine}` |
| `describe_table` | Full column details | table (required) | `{columns: [{name, type, nullable, default, key}]}`
| `search_schema` | Search tables/columns by pattern | pattern (required) | `{tables: [], columns: []}` |
| `get_table_sample` | Get representative rows for AI understanding | table (required), limit? (default: 5) | `{rows: [...], truncated: boolean}`
| `get_table_stats` | Table size and metadata | table (required) | `{rows, estimatedSizeMb, lastUpdated, indexes, engine}`
| `find_table_usage` | Find relationships and dependencies | table (required) | `{foreignKeys: [], referencedBy: []}` |
| `show_indexes` | Indexes for a table | table (required) | `{indexes: [{name, columns, unique, type}]}`
| `refresh_schema_cache` | Manual cache invalidation | - | `{status: "refreshed", cacheTimestamp}` |

### Planning Tools (AI Reasoning, No Execution)

| Tool | Purpose | Parameters | Returns |
|------|---------|------------|---------|
| `validate_query` | Validate without executing | sql (required) | `{valid, operationClass, rewrittenSql, warnings, policyViolations, estimatedRisk}` |
| `estimate_query_cost` | Risk assessment before execution | sql (required) | `{risk: "HIGH|MEDIUM|LOW", estimatedRows, usesIndex, warnings}` |
| `explain_query` | EXPLAIN with analysis | sql (required) | `{executionPlan, indexUsage, warnings}` |

### Execution Tools (Rate-Limited, Validated)

| Tool | Purpose | Parameters | Returns |
|------|---------|------------|---------|
| `execute_select` | Run SELECT with safeguards | sql OR structuredQuery | `{columns, rows, rowCount, executionTimeMs}` |

**Structured Query Format (v1+, safer):**
```typescript
{
  table: string,
  columns?: string[],
  where?: Record<string, any>,
  orderBy?: {column: string, direction: "ASC"|"DESC"},
  limit?: number
}
```

### Administrative Tools (Diagnostic)

| Tool | Purpose | Returns |
|------|---------|---------|
| `server_health` | DB connectivity, pool stats, metrics | `{connected, poolUtilization, cacheHitRate, queryMetrics, memoryUsage}` |
| `show_query_stats` | Recent query performance | `{queries: [{sql, duration, rows, timestamp}]}` |

### Optional Write Tools (Requires `MYSQL_ENABLE_WRITES=true`)

| Tool | Purpose | Safeguards |
|------|---------|------------|
| `insert_row` | Single row insert | Dry-run preview, confirm required |
| `update_rows` | Conditional update | Affected row preview, confirm required |
| `delete_rows` | Conditional delete | Affected row preview, confirm required |

**Write Operation Flow:**
1. Dry run with affected count and sample rows
2. User confirmation required (`confirm=true`)
3. Transaction wrapper optional (`MYSQL_USE_TRANSACTIONS=true`)
4. Audit log with before/after state

---

## Operation Classes (Internal)

| Class | Description | Rate Limit |
|-------|-------------|------------|
| `SAFE_READ` | Single table, limited rows, indexed | Standard |
| `HEAVY_READ` | Aggregations, full scans, large results | Higher limit |
| `WRITE` | INSERT/UPDATE/DELETE with preview | Confirmation required |
| `ADMIN` | Schema modifications | Never default |

---

## SQL Guard Specification

### Phase 1: AST Validation

**Library:** `node-sql-parser`

**Checks:**
- Single statement only (reject multiple statements)
- Valid SQL type
- No comments (reject `--`, `/* */`)
- No UNION abuse
- No subquery recursion
- No `INTO OUTFILE`
- No `LOAD_FILE`
- No prepared multi-statements

**Reject Patterns:**
```javascript
// Multiple statements
SELECT * FROM users; DROP TABLE users;  // REJECT

// Comment hiding
SELECT * FROM users WHERE 1=1 /* ... */  // REJECT

// File operations
SELECT * INTO OUTFILE '/tmp/data.txt'  // REJECT
```

### Phase 2: Policy Validation

**Environment Variables:**
```bash
# Query Permissions
MYSQL_ALLOW_JOINS=true
MYSQL_ALLOW_SUBQUERIES=false
MYSQL_ALLOW_CROSS_JOIN=false

# Query Complexity Limits
MYSQL_MAX_JOINS=5
MYSQL_MAX_SUBQUERY_DEPTH=3
MYSQL_MAX_GROUP_BY_CARDINALITY=1000

# Resource Limits
MYSQL_MAX_LIMIT=1000
MYSQL_MAX_EXECUTION_MS=10000
```

### Phase 3: Query Rewriting

**Automatic Transformations:**
```sql
-- Auto-LIMIT injection
SELECT * FROM depse_log_localite_naissance
→ SELECT * FROM depse_log_localite_naissance LIMIT 1000

-- Read consistency
SET SESSION TRANSACTION READ ONLY
→ Prepended before execution

-- Future: Optimizer hints
SELECT /*+ INDEX(users idx_email) */ * FROM users WHERE email = ?
```

### Prepared Statements Enforcement (Structured Queries)

For structured query format, **always use parameterized values**:

```typescript
// CORRECT: Parameterized
{
  table: "users",
  where: { email: "user@example.com" }
}
→ SELECT * FROM users WHERE email = ?

// WRONG: String interpolation
"SELECT * FROM users WHERE email = 'user@example.com'"
```

**Never interpolate user values directly** — even from "trusted" AI agents.

---

## Result Serialization Policies

### BLOB Handling
```typescript
// Never return raw blobs
{
  type: "BLOB",
  size: 2048000,
  preview: "<binary omitted>",
  mimeType: "image/jpeg"
}
```

### Large Text Truncation
```bash
MAX_FIELD_LENGTH=5000
```

### Decimal Preservation
```typescript
// Financial data: preserve as strings, never float
"1234.56"  // CORRECT
1234.56    // WRONG - precision loss
```

### Timezone Handling
```typescript
{
  value: "2026-05-19T14:30:00Z",
  timezone: "UTC",
  original: "2026-05-19 14:30:00"
}
```

---

## Rate Limiting

**Environment Variables:**
```bash
MYSQL_MAX_QUERIES_PER_MINUTE=30
MYSQL_MAX_SCHEMA_CALLS_PER_MINUTE=10
```

**Enforcement:**
- Sliding window counter
- Returns `429 Too Many Requests` with `Retry-After` header
- Separate limits for metadata vs execution tools

---

## Audit Logging

### Query Fingerprinting

**Stored per query:**
```typescript
{
  timestamp: "2026-05-19T14:30:00Z",
  sessionId: "uuid",
  rawSql: "SELECT * FROM users WHERE id = 9281",
  normalizedSql: "SELECT * FROM users WHERE id = ?",
  fingerprintHash: "sha256",
  executionTimeMs: 12,
  rowsReturned: 1,
  operationClass: "SAFE_READ"
}
```

**Benefits:**
- Analytics and trend detection
- Rate limiting per query pattern
- Anomaly detection
- Performance profiling

---

## Configuration

### Environment Variables

**Required:**
```bash
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=depse2019
```

**Optional - Profile System:**
```bash
# Use preset configuration (safe/balanced/power)
MYSQL_PROFILE=safe  # default: balanced
```

**Profiles:**

| Profile | Description | Limits |
|---------|-------------|--------|
| `safe` | Strictest limits, no joins, small limits | MAX_LIMIT=100, MAX_JOINS=0 |
| `balanced` (default) | Moderate flexibility for development | MAX_LIMIT=1000, MAX_JOINS=5 |
| `power` | Higher limits, more permissive reads | MAX_LIMIT=10000, MAX_JOINS=10 |

**Optional - Override Profile Values:**
```bash
# Connection
MYSQL_CONNECTION_TIMEOUT=30
MYSQL_QUERY_TIMEOUT=60
MYSQL_MAX_ROWS=1000
MYSQL_MAX_CONNECTIONS=10

# Safety
MYSQL_ENABLE_WRITES=false
MYSQL_USE_TRANSACTIONS=false
MYSQL_ALLOW_JOINS=true
MYSQL_ALLOW_SUBQUERIES=false

# Query Complexity
MYSQL_MAX_JOINS=5
MYSQL_MAX_SUBQUERY_DEPTH=3
MYSQL_ALLOW_CROSS_JOIN=false
MYSQL_MAX_GROUP_BY_CARDINALITY=1000

# Resource Limits
MYSQL_MAX_LIMIT=1000
MYSQL_MAX_EXECUTION_MS=10000
MYSQL_MAX_QUERIES_PER_MINUTE=30
MYSQL_MAX_SCHEMA_CALLS_PER_MINUTE=10

# Result Serialization
MAX_FIELD_LENGTH=5000

# Cache
SCHEMA_CACHE_TTL_MS=300000  # 5 minutes
```

**Permission Configuration (.mcp.json):**
```json
{
  "allowedTools": [
    "list_tables",
    "describe_table",
    "execute_select",
    "search_schema"
  ]
}
```

---

## Security Recommendations

### Defense-in-Depth

1. **Application Layer:** SQL Guard validation
2. **Protocol Layer:** MCP tool restrictions
3. **Database Layer:** Read-only MySQL user

### Read-Only Database User

**Recommended:**
```sql
CREATE USER 'mcp_readonly'@'localhost' IDENTIFIED BY 'secure_password';
GRANT SELECT ON depse2019.* TO 'mcp_readonly'@'localhost';
FLUSH PRIVILEGES;
```

Even if validation fails, the database account itself prevents writes.

### Never Expose

- Arbitrary shell execution
- File loading (`LOAD DATA INFILE`)
- Multiple statements (`multipleStatements: false` in mysql2)

### Query Complexity Limits

Protect against **accidentally expensive AI-generated SQL**:

```bash
MYSQL_MAX_JOINS=5
MYSQL_MAX_SUBQUERY_DEPTH=3
MYSQL_ALLOW_CROSS_JOIN=false
MYSQL_MAX_GROUP_BY_CARDINALITY=1000
```

These limits protect against:
- Accidental expensive queries (not just malicious ones)
- Full table scans on large tables
- Cartesian products from unintended cross joins
- Deeply nested subqueries

### Prepared Statements for Structured Queries

**Always parameterize** structured query values — never interpolate strings:

```typescript
// CORRECT
{ table: "users", where: { email: "user@example.com" } }
→ SELECT * FROM users WHERE email = ?

// WRONG
"SELECT * FROM users WHERE email = 'user@example.com'"
```

---

## Project Structure

```
mysql-mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── config/
│   │   └── env.ts                    # Environment variable loading
│   ├── connection/
│   │   ├── pool.ts                   # Connection pool manager
│   │   └── connection.ts             # Connection logic
│   ├── adapters/
│   │   ├── database-adapter.ts       # Interface definition
│   │   └── mysql-adapter.ts          # MySQL implementation
│   ├── schema/
│   │   ├── inspector.ts              # Schema discovery
│   │   └── cache.ts                  # Schema cache with TTL
│   ├── guards/
│   │   ├── ast-validator.ts          # Phase 1: AST validation
│   │   ├── policy-validator.ts       # Phase 2: Policy validation
│   │   └── query-rewriter.ts         # Phase 3: Query rewriting
│   ├── planning/
│   │   ├── query-planner.ts          # Validation, cost estimation
│   │   └── explain-analyzer.ts       # EXPLAIN analysis
│   ├── execution/
│   │   └── query-executor.ts         # Query execution with limits
│   ├── rate-limiter/
│   │   └── rate-limiter.ts           # Rate limiting logic
│   ├── audit/
│   │   ├── logger.ts                 # Audit logging with fingerprinting
│   │   └── fingerprint.ts            # Query normalization
│   ├── metrics/
│   │   └── collector.ts              # Metrics with OpenTelemetry hooks
│   ├── tools/
│   │   ├── discovery/                # Metadata tools
│   │   ├── planning/                 # Planning tools (validate, estimate, explain)
│   │   ├── execution/                # Execution tools
│   │   └── admin/                    # Administrative tools
│   ├── serialization/
│   │   └── result-formatter.ts       # Result serialization
│   ├── types/
│   │   └── index.ts                  # TypeScript types
│   ├── utils/
│   │   └── helpers.ts                # Utility functions
│   └── index.ts                      # MCP server entry point
├── tests/
│   ├── unit/
│   └── integration/
└── README.md
```

---

## Implementation Priority

### Phase 1: Core + Visibility (Foundation)
- Connection manager with environment config
- Schema inspector with cache (TTL)
- search_schema tool (critical for legacy schemas)
- SQL Guard (AST validation only)
- Query executor (SELECT only)
- **Minimal audit logging** (timestamp, SQL, duration, rows, errors)
- MCP tools: list_databases, list_tables, describe_table, search_schema, execute_select

### Phase 2: Safety & Intelligence
- Policy validation and query rewriting
- Query complexity limits (MAX_JOINS, MAX_SUBQUERY_DEPTH, etc.)
- Rate limiting
- Planning tools: validate_query, estimate_query_cost, explain_query
- get_table_sample, get_table_stats tools
- Profile system (safe/balanced/power)

### Phase 3: Enterprise Features
- Query fingerprinting in audit logs
- Metrics collector with OpenTelemetry hooks
- server_health, show_query_stats tools
- Structured query format with prepared statements
- Advanced observability

### Phase 4: Advanced (Future)
- Write operations with dry-run preview
- Query cancellation
- Session context
- PostgreSQL adapter
- Full OpenTelemetry implementation

---

## Success Criteria

### Functional
- [ ] Successfully connects to MySQL/MariaDB databases
- [ ] Executes SELECT queries with proper result formatting
- [ ] Validates and rejects unsafe SQL patterns
- [ ] Provides schema discovery and search capabilities
- [ ] Supports environment-based configuration

### Safety
- [ ] Read-only mode by default
- [ ] SQL Guard blocks dangerous patterns
- [ ] Rate limiting prevents runaway queries
- [ ] Audit logging captures all operations

### Operational
- [ ] Server health monitoring functional
- [ ] Connection pooling stable
- [ ] Schema caching improves performance
- [ ] Graceful error handling throughout

### Extensibility
- [ ] Database-agnostic adapter interface
- [ ] Tool registration system
- [ ] Permission layer functional
- [ ] Configuration via environment variables

---

## Dependencies

### Runtime
- `@modelcontextprotocol/sdk` — MCP protocol implementation
- `mysql2` — MySQL driver with Promise support (set `multipleStatements: false`)
- `node-sql-parser` — SQL parsing and AST validation
- `sql-formatter` — SQL formatting (optional)

### Future Integration Hooks
- OpenTelemetry SDK (optional) — For metrics/tracing export

### Development
- `typescript` — Type safety
- `@types/node` — Node.js types
- `vitest` — Testing framework

---

## Notes for Implementation

1. **Start with MySQL only** — Database-agnostic interface can be abstracted later
2. **search_schema is Phase 1 critical** — For legacy schemas, discovery is foundational, not optional
3. **Minimal audit from day one** — Debugging AI query behavior requires logging from the start
4. **Schema cache is critical** — Without it, schema calls will dominate performance
5. **Test with real legacy schemas** — DEPSE's 80+ tables provide excellent validation
6. **Planning/Execution separation** — Architecturally separate even if tools appear similar
7. **Rate limits save you** — Runaway AI queries will happen; protect against them early
8. **Profile system improves UX** — Presets dramatically improve usability over manual tuning

---

## References

- Model Context Protocol: https://modelcontextprotocol.io
- mysql2 documentation: https://github.com/sidorares/node-mysql2
- node-sql-parser: https://github.com/taozhi8833998/node-sql-parser
- DEPSE project: /c/wamp64/www/depse2019
