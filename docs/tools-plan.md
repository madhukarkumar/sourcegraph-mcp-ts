Implementation Plan for New MCP Tools

## 1. Currently Implemented Tools
- search-code: General code search across repositories
- search-commits: Find commits with filters by author, message, date
- search-diffs: Find code changes and modifications
- search-github-repos: Search specific GitHub repositories
- debug: List available tools and capabilities
- deep-code-researcher: Advanced code pattern analysis (placeholder)

### Implemented Code Intelligence Tools
- get-definition: Find where a symbol is defined (implemented in src/mcp-server.ts)
- find-references: Find all references to a symbol (implemented in src/mcp-server.ts)
- find-implementations: Find implementations of interfaces/abstract classes (implemented in src/mcp-server.ts)
- get-hover-documentation: Get documentation/type information for a symbol (implemented in src/mcp-server.ts)
- get-document-symbols: Get all symbols in a file (functions, classes, etc.) (implemented in src/mcp-server.ts)

These tools use the Sourcegraph GraphQL API through src/services/code-intelligence.ts, which contains:
- GraphQL query definitions for each feature
- Helper functions to execute queries and format results
- Comprehensive result formatting with markdown support

### Implemented Repository Content Tools

- get-file-content: Get the raw content of a file (implemented in src/mcp-server.ts)
- get-file-blame: Get git blame information for a file (implemented in src/mcp-server.ts)

These tools use the Sourcegraph GraphQL API through src/services/repository-content.ts, which contains:
- GraphQL query definitions for file content and blame
- Helper functions to execute queries and format results
- Comprehensive result formatting with markdown support

### Implemented Security Tools

- lookup-cve: Search for CVEs affecting repositories or packages (implemented in src/mcp-server.ts)
- lookup-package-vulnerability: Check if specific packages have known vulnerabilities (implemented in src/mcp-server.ts)
- search-exploits: Search for exploit code for known vulnerabilities (implemented in src/mcp-server.ts)
- find-vendor-advisory: Find vendor security advisories (implemented in src/mcp-server.ts)

These tools use a combination of Sourcegraph's GraphQL API and search capabilities through src/services/security.ts, which contains:
- GraphQL query definitions for security-related endpoints
- Helper functions to execute queries and build search queries
- Comprehensive result formatting with markdown support

## 2. All Tools Now Implemented
## 3. Implementation Progress

### Implementation Status
- ✅ Created `src/services/code-intelligence.ts` with core code intelligence functionality
- ✅ Created `src/services/repository-content.ts` for repository content functionality
- ✅ Created `src/services/security.ts` for security-related API calls
- ✅ Implemented all planned code intelligence tools (get-definition, find-references, find-implementations, get-hover-documentation, get-document-symbols)
- ✅ Implemented all planned repository content tools (get-file-content, get-file-blame)
- ✅ Implemented all planned security tools (lookup-cve, lookup-package-vulnerability, search-exploits, find-vendor-advisory)
- ✅ Added type safety and error handling for API interactions
- ✅ Integrated with existing credential and configuration management
- ✅ Implemented extensive documentation for each tool
- ✅ Added markdown-formatted result output

### Implementation Details

#### Common Architecture
All implemented tools follow the same pattern:
1. Validate Sourcegraph credentials
2. Execute GraphQL query through the code-intelligence service
3. Format results with improved readability
4. Handle errors gracefully with meaningful messages

### Next Steps
1. Write automated tests for all implemented tools
2. Add rate limiting awareness and feedback to users
3. Implement additional natural language processing capabilities
4. Explore additional tool integrations with Sourcegraph API

## 4. Implementation Approach

### Architecture Extensions
- ✅ Created `src/services/code-intelligence.ts` for code intelligence API calls
- ✅ Created `src/services/repository-content.ts` for repository content API calls
- ✅ Created `src/services/security.ts` for security-related API calls
- ✅ Extended formatter utilities to handle new response types

### API Integration
- ✅ Using dedicated `executeSourcegraphQuery` function for GraphQL queries
- ✅ Extended error handling for specific code intelligence error cases
- ✅ Implemented proper type safety for new response types
- ✅ Added search query builders for security-related searches

### Error Handling
- ✅ Added graceful fallbacks for instances where endpoints are unavailable
- ✅ Implemented clear error messages for various failure scenarios
- ✅ Added parameter validation for required fields
- 🔲 Add rate limiting awareness and feedback to users (future enhancement)

### Response Formatting
- ✅ For code intelligence: Format responses with relevant file, line, and code context
- ✅ For repository content: Format file content with syntax highlighting and metadata
- ✅ For security tools: Provide severity levels, links to advisories, and remediation guidance
- ✅ Added markdown formatting for better readability

## 5. Testing Strategy
- 🔲 Create unit tests for each new tool
- 🔲 Test with enterprise and free-tier Sourcegraph instances
- 🔲 Test with various programming languages and repository types
- 🔲 Verify rate limiting compliance

## 6. Additional Considerations
- Some endpoints may require enterprise features - detect and provide fallbacks
- Security tools might need throttling to avoid excessive API usage
- Consider adding natural language support for more intuitive queries
- Document limitations (e.g., LSIF data availability requirements for code intelligence)

This plan provides a comprehensive approach to implementing the requested tools while maintaining the existing architecture and providing high-quality results to users.