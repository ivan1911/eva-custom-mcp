import { z } from "zod";
import { zodToJsonSchema } from "../utils/zod-to-json.js";
import type { EvaPersonClient } from "../client/eva-person.js";
import type { EvaProjectClient } from "../client/eva-project.js";
import type { Person } from "../types/person.js";
import type { ToolDefinition } from "./index.js";

const PersonSchema = z.string().describe("Person login, unique part of a name, or CmfPerson:<uuid>");
const StatusTypeSchema = z
  .enum(["OPEN", "IN_PROGRESS", "IN_REVIEW", "CLOSED"])
  .describe("Status type (cache_status_type)");

const PersonSearchSchema = z.object({
  query: z.string().describe("Part of a name or login, for example Petrov"),
  limit: z.number().int().positive().max(100).optional().default(20),
});

const PersonGetSchema = z.object({
  person: PersonSchema,
});

const MyTasksSchema = z.object({
  role: z
    .enum(["responsible", "owner", "waiting"])
    .optional()
    .default("responsible")
    .describe('"responsible": assigned to the person; "owner": reported by the person; "waiting": waiting for the person\'s answer'),
  person: PersonSchema.optional().describe("Whose tasks to list. Defaults to the current user."),
  statusType: StatusTypeSchema.optional().describe("Only tasks with this status type. Defaults to all tasks that are not CLOSED."),
  projectCode: z.string().optional().describe("Only tasks from this project"),
  limit: z.number().int().positive().max(200).optional().default(50),
  fields: z.array(z.string()).optional().describe("Task fields to return"),
});

const ROLE_FIELDS = {
  responsible: "responsible",
  owner: "cmf_owner",
  waiting: "waiting_for",
} as const;

const DEFAULT_TASK_FIELDS = ["id", "code", "name", "cache_status_type", "status.name", "responsible.name", "parent.name", "cmf_modified_at"];

export function registerPeopleTools(personClient: EvaPersonClient, projectClient: EvaProjectClient): ToolDefinition[] {
  return [
    {
      definition: {
        name: "person_search",
        description: "Find EvaTeam users by part of a name or login",
        inputSchema: zodToJsonSchema(PersonSearchSchema) as never,
      },
      handler: async (args) => {
        const { query, limit } = PersonSearchSchema.parse(args);
        return json(await personClient.search(query, limit));
      },
    },
    {
      definition: {
        name: "person_get",
        description: "Get one EvaTeam user by login, unique part of a name, or CmfPerson reference",
        inputSchema: zodToJsonSchema(PersonGetSchema) as never,
      },
      handler: async (args) => {
        const { person } = PersonGetSchema.parse(args);
        return json(await personClient.resolve(person));
      },
    },
    {
      definition: {
        name: "whoami",
        description: "Get the EvaTeam user the API token belongs to (or EVA_USER_LOGIN when set)",
        inputSchema: zodToJsonSchema(z.object({})) as never,
      },
      handler: async () => json(await personClient.getCurrentUser()),
    },
    {
      definition: {
        name: "my_tasks",
        description:
          "List open tasks of the current user (or another person): assigned to them, reported by them, or waiting for their answer",
        inputSchema: zodToJsonSchema(MyTasksSchema) as never,
      },
      handler: async (args) => {
        const input = MyTasksSchema.parse(args);
        const person = input.person ? await personClient.resolve(input.person) : await personClient.getCurrentUser();

        const filter: unknown[][] = [
          [ROLE_FIELDS[input.role], "==", person.id],
          input.statusType ? ["cache_status_type", "==", input.statusType] : ["cache_status_type", "!=", "CLOSED"],
        ];
        if (input.projectCode) {
          const project = await projectClient.getProjectByCode(input.projectCode, ["id"]);
          filter.push(["parent_id", "==", project.id]);
        }

        const tasks = await projectClient.listTasks({
          filter,
          fields: input.fields ?? DEFAULT_TASK_FIELDS,
          slice: [0, input.limit],
          order_by: ["-cmf_modified_at"],
        });
        return json({ person: personSummary(person), role: input.role, tasks });
      },
    },
  ];
}

function personSummary(person: Person) {
  return { id: person.id, name: person.name, login: person.login };
}

function json(value: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}
