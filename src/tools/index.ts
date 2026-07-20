import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export interface ToolDefinition {
  definition: Tool;
  handler: (args: Record<string, unknown>) => Promise<{ content: { type: string; text: string }[] }>;
}