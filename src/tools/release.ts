import { z } from "zod";
import { zodToJsonSchema } from "../utils/zod-to-json.js";
import type { EvaProjectClient } from "../client/eva-project.js";
import type { ToolDefinition } from "./index.js";

const STATUS_TYPES = ["OPEN", "IN_PROGRESS", "IN_REVIEW", "CLOSED"] as const;
const StatusTypeSchema = z.enum(STATUS_TYPES).describe("Status type (cache_status_type)");

const ReleaseListSchema = z.object({
  projectCode: z.string().optional().describe("Only releases of this project"),
  query: z.string().optional().describe("Part of the release name"),
  codePrefix: z
    .string()
    .optional()
    .default("REL-")
    .describe("Code prefix. Releases and sprints are both CmfList objects: use REL- for releases, SPR- for sprints."),
  includeArchived: z.boolean().optional(),
  limit: z.number().int().positive().max(200).optional().default(50),
  fields: z.array(z.string()).optional().describe('Fields to return. Defaults to ["*"].'),
});

const ReleaseTasksSchema = z.object({
  releaseCode: z.string().describe("Release code, for example REL-000092"),
  statusType: StatusTypeSchema.optional().describe("Only tasks with this status type"),
  includeArchived: z.boolean().optional().default(true).describe("Include archived tasks"),
  limit: z.number().int().positive().max(500).optional().default(200),
  fields: z.array(z.string()).optional().describe("Task fields to return"),
});

const TaskAddReleaseSchema = z.object({
  task: z.string().describe("Task code (DEV-000003) or CmfTask:<uuid>"),
  releaseCode: z.string().describe("Release code, for example REL-000092"),
});

const DEFAULT_TASK_FIELDS = ["id", "code", "name", "cache_status_type", "status.name", "responsible.name"];

export function registerReleaseTools(projectClient: EvaProjectClient): ToolDefinition[] {
  return [
    {
      definition: {
        name: "release_list",
        description: "List EvaTeam releases (or sprints with codePrefix SPR-), optionally by project and name",
        inputSchema: zodToJsonSchema(ReleaseListSchema) as never,
      },
      handler: async (args) => {
        const input = ReleaseListSchema.parse(args);
        const filter: unknown[][] = [["code", "ILIKE", `${input.codePrefix}%`]];
        if (input.projectCode) {
          const project = await projectClient.getProjectByCode(input.projectCode, ["id"]);
          filter.push(["parent_id", "==", project.id]);
        }
        if (input.query) filter.push(["name", "ILIKE", `%${input.query}%`]);

        return json(
          await projectClient.listLists({
            filter: filter.length === 1 ? filter[0] : filter,
            fields: input.fields ?? ["*"],
            slice: [0, input.limit],
            order_by: ["-cmf_created_at"],
            include_archived: input.includeArchived,
          }),
        );
      },
    },
    {
      definition: {
        name: "release_tasks",
        description: "List tasks in an EvaTeam release with an exact count per status type (release readiness)",
        inputSchema: zodToJsonSchema(ReleaseTasksSchema) as never,
      },
      handler: async (args) => {
        const input = ReleaseTasksSchema.parse(args);
        const release = await projectClient.getListByCode(input.releaseCode, ["id", "code", "name"]);
        const inRelease = ["fix_versions", "IN", [release.id]];
        const withStatus = (statusType: string) => [inRelease, ["cache_status_type", "==", statusType]];
        const includeArchived = input.includeArchived;

        const [tasks, total, ...statusCounts] = await Promise.all([
          projectClient.listTasks({
            filter: input.statusType ? withStatus(input.statusType) : inRelease,
            fields: input.fields ?? DEFAULT_TASK_FIELDS,
            slice: [0, input.limit],
            order_by: ["cache_status_type", "code"],
            include_archived: includeArchived,
          }),
          projectClient.countTasks({ filter: inRelease, include_archived: includeArchived }),
          ...STATUS_TYPES.map((statusType) =>
            projectClient.countTasks({ filter: withStatus(statusType), include_archived: includeArchived }),
          ),
        ]);

        const summary = Object.fromEntries(STATUS_TYPES.map((statusType, index) => [statusType, statusCounts[index]]));
        return json({
          release: { id: release.id, code: release.code, name: release.name },
          total,
          summary,
          ...(tasks.length < (input.statusType ? summary[input.statusType] ?? 0 : total)
            ? { note: `Showing ${tasks.length} tasks; increase limit to see the rest.` }
            : {}),
          tasks,
        });
      },
    },
    {
      definition: {
        name: "task_add_release",
        description: "Add a release to a task's fix versions; releases already set on the task are kept",
        inputSchema: zodToJsonSchema(TaskAddReleaseSchema) as never,
      },
      handler: async (args) => {
        const { task, releaseCode } = TaskAddReleaseSchema.parse(args);
        const taskRef = task.startsWith("CmfTask:") ? task : (await projectClient.getTaskByCode(task, ["id"]))?.id;
        if (!taskRef) throw new Error(`Task not found: ${task}`);
        const release = await projectClient.getListByCode(releaseCode, ["id", "code", "name"]);
        const result = await projectClient.addTaskToRelease(taskRef, release.id);
        return json({ task, release: { code: release.code, name: release.name }, result });
      },
    },
  ];
}

function json(value: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}
