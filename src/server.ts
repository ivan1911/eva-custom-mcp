import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { EvaGlossaryClient } from "./client/glossary.js";
import { EvaTeamClient } from "./client/index.js";
import { EvaProjectClient } from "./client/eva-project.js";
import { EvaWikiClient } from "./client/eva-wiki.js";
import { loadConfig } from "./config.js";
import { registerGlossaryTools } from "./tools/glossary.js";
import { registerProjectTools } from "./tools/project.js";
import { registerWikiTools } from "./tools/wiki.js";

export async function createServer() {
  const config = loadConfig();
  const client = new EvaTeamClient(config.baseUrl, config.apiToken);
  const glossaryClient = new EvaGlossaryClient(client);

  const server = new Server(
    { name: "eva-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  const tools = [...registerGlossaryTools(glossaryClient)];

  if (config.apiToken) {
    const projectClient = new EvaProjectClient(client);
    const wikiClient = new EvaWikiClient(client);
    tools.push(...registerProjectTools(projectClient, wikiClient), ...registerWikiTools(wikiClient));
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => t.definition),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.definition.name === request.params.name);
    if (!tool) throw new Error(`Unknown tool: ${request.params.name}`);
    return tool.handler(request.params.arguments ?? {});
  });

  return server;
}

export async function startServer() {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
