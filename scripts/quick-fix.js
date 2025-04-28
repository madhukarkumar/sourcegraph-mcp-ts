const fs = require('fs');
const path = require('path');

// Path to dist file
const distPath = path.join(__dirname, '../dist/mcp-server.js');

// Make a backup
if (fs.existsSync(distPath)) {
  fs.copyFileSync(distPath, `${distPath}.bak`);
  console.log(`Created backup at ${distPath}.bak`);
}

// Read the file
let content = fs.readFileSync(distPath, 'utf8');

// Fix the debug tool implementation to properly handle errors
content = content.replace(
  /server\.tool\("debug",[\s\S]*?async \(\) => \{[\s\S]*?content: \[\{[\s\S]*?type: "text",[\s\S]*?text: JSON\.stringify\([\s\S]*?\}\]/g,
  'server.tool("debug", "Lists all available tools and methods in the MCP server.", {}, async () => {\n' +
  '      try {\n' +
  '        return {\n' +
  '          content: [{\n' +
  '            type: "text",\n' +
  '            text: JSON.stringify({\n' +
  '              tools: ["echo", "search-code", "search-commits", "search-diffs", "search-github-repos", "natural-search", "debug", "deep-code-researcher"],\n' +
  '              resources: ["hello://sourcegraph", "greeting://{name}"],\n' +
  '              prompts: ["sourcegraph-assistant"],\n' +
  '              methods: ["tools/invoke", "mcp/capabilities", "debug/info"]\n' +
  '            }, null, 2)\n' +
  '          }]'
);

// Write the fixed content back
fs.writeFileSync(distPath, content);
console.log('Fixed debug tool implementation');