#!/usr/bin/env node
// CLI entry. Spawned by `npx -y @g-digital/mcp-ead-factory` and by
// container/HTTP deployments. Importing src/server.ts no longer
// side-effects the bootstrap — consumers that want the MCP in-process
// (n8n adapter bundle, tests) call createServer() and wire their own
// transport.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server';
import { config } from './config';
import { createHttpApp } from './http';

async function main() {
  const server = createServer();
  const transportMode = config.transport;

  if (transportMode === 'http') {
    const app = createHttpApp(server);
    const port = config.httpPort;
    app.listen(port, () => {
      console.error(`Evidence Manager MCP Server listening on http://0.0.0.0:${port}/mcp`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Evidence Manager MCP Server running on stdio');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
