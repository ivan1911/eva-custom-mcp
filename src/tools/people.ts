import { z } from "zod";
import { zodToJsonSchema } from "../utils/zod-to-json.js";
import type { EvaPersonClient } from "../client/eva-person.js";
import type { EvaProjectClient } from "../client/eva-project.js";
import type { Person } from "../types/person.js";
import type { ToolDefinition } from "./index.js";

const PersonSchema = z.string().trim().min(1).describe("Exact EvaTeam login, unique part of a name, or CmfPerson:<uuid>. Reuse a known reference instead of searching again.");
const StatusTypeSchema = z
  .enum(["OPEN", "IN_PROGRESS", "IN_REVIEW", "CLOSED"])
  .describe("Status type (cache_status_type)");

const PersonSearchSchema = z.object({
  query: z.string().trim().min(1).describe("Part of an EvaTeam name or login, for example Petrov"),
  limit: z.number().int().positive().max(100).optional().default(20),
}).strict();

const PersonGetSchema = z.object({
  person: PersonSchema,
}).strict();

const WhoamiSchema = z.object({}).strict();

const MyTasksSchema = z.object({
  role: z
    .enum(["responsible", "owner", "waiting"])
    .optional()
    .default("responsible")
    .describe('Defaults to "responsible" (assigned tasks) for "my tasks". Use "owner" (reported by the person) or "waiting" (waiting for their answer) only when requested.'),
  person: PersonSchema.optional().describe("Omit for my tasks: uses EVA_USER_LOGIN automatically, without a preliminary whoami. For another person or an invalid configured login, pass a known login or CmfPerson:<uuid>."),
  statusType: StatusTypeSchema.optional().describe("Only tasks with this status type. Defaults to all tasks that are not CLOSED."),
  projectCode: z.string().trim().min(1).optional().describe("Only tasks from this project; resolved internally, without a preliminary project lookup"),
  limit: z.number().int().positive().max(200).optional().default(50)
    .describe("Maximum tasks to return, 1–200, default 50. Increase only if hasMore is true and more tasks are needed. A larger limit repeats the same selection from the beginning."),
  fields: z.array(z.string()).optional().describe('Task fields to return. The task description/body is "text", not "description"; include "text" explicitly when needed. Defaults include code, name, readable status, assignee, project, and modification time, but omit the body.'),
}).strict();

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
        description: "Find EvaTeam users by part of a name or login. Returns id, code, name, and login. Reuse the selected id or login in subsequent calls; no person_get is needed to confirm the same result. For my tasks, call my_tasks directly first. A configured-login error can be recovered with one search using a known name or login fragment; do not guess the current user's identity.",
        annotations: { readOnlyHint: true },
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
        description: "Read one EvaTeam user by an exact login, unique name fragment, or CmfPerson reference in person. Use whoami for the configured user, or my_tasks directly for their tasks. Reuse a person_search result if it already contains the information needed.",
        annotations: { readOnlyHint: true },
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
        description: "Read the user configured by EVA_USER_LOGIN. This does not identify the API token owner. Takes no arguments. Use for questions about the configured user's identity; my_tasks resolves that user internally and does not need whoami first. If the configured login is missing or not found, follow the error's recovery steps instead of retrying unchanged.",
        annotations: { readOnlyHint: true },
        inputSchema: zodToJsonSchema(WhoamiSchema) as never,
      },
      handler: async (args) => {
        WhoamiSchema.parse(args);
        return json(await personClient.getCurrentUser());
      },
    },
    {
      definition: {
        name: "my_tasks",
        description:
          'List non-closed tasks assigned to the configured user. For "my tasks", call directly with {}: no whoami, person_search, or project lookup is needed first. Returns person, role, tasks, and hasMore. Task descriptions are in text, not description; include "text" in fields when needed. Default role is responsible; query owner or waiting only when requested. When hasMore is false, the selection is complete; increase limit only when hasMore is true and more tasks are needed (maximum 200). Reuse returned task details instead of fetching every task again.',
        annotations: { readOnlyHint: true },
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
          slice: [0, input.limit + 1],
          order_by: ["-cmf_modified_at"],
        });
        return json({ person: personSummary(person), role: input.role, tasks: tasks.slice(0, input.limit), hasMore: tasks.length > input.limit });
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
