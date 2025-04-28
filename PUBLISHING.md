# Publishing to NPM

## Prerequisites

1. You need an npm account. Create one at https://www.npmjs.com/signup if you don't have one.
2. Log in to npm from your terminal:
   ```bash
   npm login
   ```

## Publishing Process

### Automated Publishing (Recommended)

We've created a script that handles all the publishing steps automatically:

```bash
# Build and publish to npm
npm run publish
```

This script will:
1. Build the project
2. Create necessary package files (.npmignore)
3. Create a temporary npm-friendly README
4. Publish to npm
5. Restore the original README

### Manual Publishing

If you prefer to publish manually:

1. Update the version in package.json
2. Build the project
   ```bash
   npm run build
   ```
3. Publish to npm
   ```bash
   npm publish --access public
   ```

## Updating the Published Package

1. Make your changes to the codebase
2. Update the version in package.json (follow semver: major.minor.patch)
   - Major: Breaking changes
   - Minor: New features, no breaking changes
   - Patch: Bug fixes, no new features or breaking changes
3. Run the publish script
   ```bash
   npm run publish
   ```

## Testing the Published Package

To test the published package:

```bash
# Run directly
npx sourcegraph-mcp-server

# Or install globally and run
npm install -g sourcegraph-mcp-server
sourcegraph-mcp-server
```

## Using with MCP Inspector

In MCP Inspector:
1. Add a Process connection
2. Set Command to: `npx`
3. Set Arguments to: `sourcegraph-mcp-server`