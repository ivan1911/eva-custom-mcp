import { z } from "zod";
import type { EvaGlossaryClient } from "../client/glossary.js";
import { zodToJsonSchema } from "../utils/zod-to-json.js";
import type { ToolDefinition } from "./index.js";

const GetGlossaryArticleSchema = z.object({
  slugOrUrl: z
    .string()
    .describe("EvaTeam glossary slug or article URL, e.g. api or https://www.evateam.ru/glossary/api/"),
});

const SearchGlossarySchema = z.object({
  query: z.string().describe("Glossary term to resolve, e.g. API"),
});

export function registerGlossaryTools(client: EvaGlossaryClient): ToolDefinition[] {
  return [
    {
      definition: {
        name: "glossary_article_get",
        description: "Get a public EvaTeam glossary article by slug or URL",
        inputSchema: zodToJsonSchema(GetGlossaryArticleSchema) as never,
      },
      handler: async (args) => {
        const { slugOrUrl } = GetGlossaryArticleSchema.parse(args);
        const article = await client.getArticle(slugOrUrl);
        return { content: [{ type: "text", text: JSON.stringify(article, null, 2) }] };
      },
    },
    {
      definition: {
        name: "glossary_search",
        description: "Resolve an EvaTeam glossary term and return matching article content",
        inputSchema: zodToJsonSchema(SearchGlossarySchema) as never,
      },
      handler: async (args) => {
        const { query } = SearchGlossarySchema.parse(args);
        const articles = await client.search(query);
        return { content: [{ type: "text", text: JSON.stringify(articles, null, 2) }] };
      },
    },
  ];
}
