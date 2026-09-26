import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";
import { EvaGlossaryClient } from "./client/glossary.js";
import { EvaTeamClient } from "./client/index.js";
import { EvaPersonClient } from "./client/eva-person.js";
import { EvaProjectClient } from "./client/eva-project.js";
import { EvaWikiClient } from "./client/eva-wiki.js";
import { loadConfig } from "./config.js";
import { registerGlossaryTools } from "./tools/glossary.js";
import { registerPeopleTools } from "./tools/people.js";
import { registerProjectTools } from "./tools/project.js";
import { registerReleaseTools } from "./tools/release.js";
import { registerWikiTools } from "./tools/wiki.js";

export async function createServer() {
  const config = loadConfig();
  const client = new EvaTeamClient(config.baseUrl, config.apiToken);
  // The glossary lives on the public EvaTeam site, not on the company instance, and needs no token.
  const glossaryClient = new EvaGlossaryClient(new EvaTeamClient(config.glossaryUrl));

  const server = new Server(
    { name: "eva-custom-mcp", version: "0.1.5" },
    { capabilities: { tools: {} } },
  );

  const tools = [...registerGlossaryTools(glossaryClient)];

  if (config.apiToken) {
    const projectClient = new EvaProjectClient(client);
    const personClient = new EvaPersonClient(client, config.userLogin);
    const wikiClient = new EvaWikiClient(client, config.uploadRoot);
    tools.push(
      ...registerProjectTools(projectClient, personClient, wikiClient),
      ...registerPeopleTools(personClient, projectClient),
      ...registerReleaseTools(projectClient),
      ...registerWikiTools(wikiClient),
    );
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => t.definition),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.definition.name === request.params.name);
    if (!tool) throw new Error(`Unknown tool: ${request.params.name}`);
    try {
      return await tool.handler(request.params.arguments ?? {});
    } catch (error) {
      // Report tool failures as results so the model sees the reason and can retry with fixed arguments.
      return { isError: true, content: [{ type: "text", text: formatToolError(error) }] };
    }
  });

  return server;
}

function formatToolError(error: unknown): string {
  if (error instanceof ZodError) {
    const issues = error.issues.map((issue) => `${issue.path.join(".") || "arguments"}: ${issue.message}`);
    return `Invalid arguments:\n${issues.join("\n")}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export async function startServer() {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
