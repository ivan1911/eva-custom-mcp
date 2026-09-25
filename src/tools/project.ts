import { z } from "zod";
import { zodToJsonSchema } from "../utils/zod-to-json.js";
import type { EvaPersonClient } from "../client/eva-person.js";
import type { EvaProjectClient } from "../client/eva-project.js";
import type { TaskQuery } from "../types/project.js";
import type { EvaWikiClient } from "../client/eva-wiki.js";
import type { ToolDefinition } from "./index.js";

const FilterSchema = z.array(z.unknown()).describe('EvaTeam BQL filter, for example ["code", "==", "PRJ"]');
const FieldsSchema = z.array(z.string()).describe('Fields to return. Use ["*"], ["**"], ["***"], or explicit fields.');
const SliceSchema = z.tuple([z.number(), z.number()]).describe("Result slice, for example [0, 20]");
const OrderBySchema = z.array(z.string()).describe('Sort fields, for example ["-cmf_created_at"]');
const PersonSchema = z.string().describe("Person login, unique part of a name, or CmfPerson:<uuid>");

const QuerySchema = z.object({
  filter: FilterSchema.optional(),
  fields: FieldsSchema.optional(),
  slice: SliceSchema.optional(),
  orderBy: OrderBySchema.optional(),
  includeArchived: z.boolean().optional(),
});

const ProjectGetByCodeSchema = z.object({
  projectCode: z.string().describe("Project code, for example DEV"),
  fields: FieldsSchema.optional(),
});

const TaskSearchSchema = QuerySchema.extend({
  projectCode: z.string().optional().describe("Optional project code to scope search"),
  query: z.string().optional().describe("Optional text/code search for task name or code"),
  status: z.string().optional().describe("Optional task status code"),
  responsible: z.string().optional().describe("Optional responsible person id/login/code"),
  limit: z.number().optional().default(20),
});

const TaskGetSchema = z.object({
  code: z.string().optional().describe("Task code, for example DEV-000003"),
  taskRef: z.string().optional().describe("Task object reference, for example CmfTask:<uuid>"),
  fields: FieldsSchema.optional(),
});

const TaskCreateSchema = z.object({
  projectCode: z.string().optional().describe("Project code used as parent"),
  name: z.string().describe("Task title"),
  text: z.string().optional().describe("Task description/body"),
  responsible: PersonSchema.optional().describe("Assignee: login, unique part of a name, or CmfPerson:<uuid>"),
  owner: PersonSchema.optional().describe("Reporter (cmf_owner): login, unique part of a name, or CmfPerson:<uuid>"),
  status: z.string().optional(),
  logicType: z.string().optional().describe("Eva task logic_type"),
  sprintCode: z.string().optional().describe("Sprint code to put the task into, for example SPR-000006"),
  extra: z.record(z.unknown()).optional().describe("Additional CmfTask.create kwargs"),
});

const TaskUpdateSchema = z.object({
  taskRef: z.string().describe("Task object reference, for example CmfTask:<uuid>"),
  name: z.string().optional(),
  text: z.string().optional(),
  responsible: PersonSchema.optional().describe("Assignee: login, unique part of a name, or CmfPerson:<uuid>"),
  owner: PersonSchema.optional().describe("Reporter (cmf_owner): login, unique part of a name, or CmfPerson:<uuid>"),
  status: z.string().optional(),
  extra: z.record(z.unknown()).optional().describe("Additional CmfTask.update kwargs"),
});

const TaskDeleteSchema = z.object({
  taskRef: z.string().describe("Task object reference, for example CmfTask:<uuid>"),
});

const TaskTransitionSchema = z.object({
  taskRef: z.string(),
  status: z.string().describe("Target status code or reference"),
});

const TaskCommentAddSchema = z.object({
  taskRef: z.string().describe("Task object reference, for example CmfTask:<uuid>"),
  text: z.string(),
});

const TaskCommentsListSchema = z.object({
  code: z.string().describe("Task code, for example DEV-000003"),
});

const TaskAssignSchema = z.object({
  taskRef: z.string().describe("Task object reference, for example CmfTask:<uuid>"),
  person: PersonSchema,
  waitingFor: z.boolean().optional().describe('Also set "waiting for answer" (waiting_for) to this person'),
  status: z.string().optional().describe("Status code to switch to at the same time, for example STC-000002"),
});

const TaskLinkCreateSchema = z.object({
  outTaskCode: z.string().describe("Source task code"),
  inTaskCode: z.string().describe("Target task code"),
  relationType: z.string().optional().default("system.link"),
});

const TaskTimeLogSchema = z.object({
  taskRef: z.string(),
  timeSpent: z.number().describe("Spent time in minutes"),
  remainingEstimate: z.number().optional().describe("Remaining estimate in minutes. Omit to keep the current estimate."),
  text: z.string().optional(),
  date: z.string().optional().describe("ISO date/time. Defaults to now on Eva side if omitted."),
});

const TaskCreateFromTemplateSchema = z.object({
  templateRef: z.string().describe("Template task object reference"),
  projectCode: z.string(),
  params: z.record(z.unknown()).optional(),
});

const ProjectFindEverythingSchema = z.object({
  projectCode: z.string(),
  query: z.string().optional(),
  limit: z.number().optional().default(10),
  taskFields: FieldsSchema.optional(),
  documentFields: FieldsSchema.optional(),
});

export function registerProjectTools(
  projectClient: EvaProjectClient,
  personClient: EvaPersonClient,
  wikiClient?: EvaWikiClient,
): ToolDefinition[] {
  const personRef = (person?: string) => (person ? personClient.resolveRef(person) : Promise.resolve(undefined));

  return [
    {
      definition: {
        name: "project_list",
        description: "List EvaTeam projects with optional raw filter, fields, slice, and sort order",
        inputSchema: zodToJsonSchema(QuerySchema) as never,
      },
      handler: async (args) => {
        const projects = await projectClient.listProjects(toApiQuery(QuerySchema.parse(args)));
        return json(projects);
      },
    },
    {
      definition: {
        name: "project_get_by_code",
        description: "Resolve an EvaTeam project by code",
        inputSchema: zodToJsonSchema(ProjectGetByCodeSchema) as never,
      },
      handler: async (args) => {
        const { projectCode, fields } = ProjectGetByCodeSchema.parse(args);
        return json(await projectClient.getProjectByCode(projectCode, fields));
      },
    },
    {
      definition: {
        name: "task_search",
        description: "Search EvaTeam tasks, optionally scoped by project code",
        inputSchema: zodToJsonSchema(TaskSearchSchema) as never,
      },
      handler: async (args) => {
        const input = TaskSearchSchema.parse(args);
        const query = await buildTaskQuery(projectClient, input);
        return json(await projectClient.listTasks(query));
      },
    },
    {
      definition: {
        name: "task_get",
        description: "Get an EvaTeam task by code or object reference",
        inputSchema: zodToJsonSchema(TaskGetSchema) as never,
      },
      handler: async (args) => {
        const { code, taskRef, fields } = TaskGetSchema.parse(args);
        if (!code && !taskRef) throw new Error("Either code or taskRef is required");
        return json(taskRef ? await projectClient.getTaskById(taskRef, fields) : await projectClient.getTaskByCode(code as string, fields));
      },
    },
    {
      definition: {
        name: "task_create",
        description: "Create an EvaTeam task via CmfTask.create",
        inputSchema: zodToJsonSchema(TaskCreateSchema) as never,
      },
      handler: async (args) => {
        const input = TaskCreateSchema.parse(args);
        return json(
          await projectClient.createTask({
            name: input.name,
            text: input.text,
            parent: input.projectCode,
            responsible: await personRef(input.responsible),
            cmf_owner: await personRef(input.owner),
            status: input.status,
            logic_type: input.logicType,
            lists: input.sprintCode ? [input.sprintCode] : undefined,
            ...(input.extra ?? {}),
          }),
        );
      },
    },
    {
      definition: {
        name: "task_update",
        description: "Update an EvaTeam task via CmfTask.update",
        inputSchema: zodToJsonSchema(TaskUpdateSchema) as never,
      },
      handler: async (args) => {
        const { taskRef, ...input } = TaskUpdateSchema.parse(args);
        return json(
          await projectClient.updateTask(taskRef, {
            name: input.name,
            text: input.text,
            responsible: await personRef(input.responsible),
            cmf_owner: await personRef(input.owner),
            status: input.status,
            ...(input.extra ?? {}),
          }),
        );
      },
    },
    {
      definition: {
        name: "task_delete",
        description: "Delete an EvaTeam task via CmfTask.delete",
        inputSchema: zodToJsonSchema(TaskDeleteSchema) as never,
      },
      handler: async (args) => {
        const { taskRef } = TaskDeleteSchema.parse(args);
        return json(await projectClient.deleteTask(taskRef));
      },
    },
    {
      definition: {
        name: "task_transition",
        description: "Change an EvaTeam task status via CmfTask.update",
        inputSchema: zodToJsonSchema(TaskTransitionSchema) as never,
      },
      handler: async (args) => {
        const { taskRef, status } = TaskTransitionSchema.parse(args);
        return json(await projectClient.updateTask(taskRef, { status }));
      },
    },
    {
      definition: {
        name: "task_comment_add",
        description: "Add a comment to an EvaTeam task",
        inputSchema: zodToJsonSchema(TaskCommentAddSchema) as never,
      },
      handler: async (args) => {
        const { taskRef, text } = TaskCommentAddSchema.parse(args);
        return json(await projectClient.addTaskComment(taskRef, text));
      },
    },
    {
      definition: {
        name: "task_comments_list",
        description: "List task comments by loading CmfTask.get with comments.*",
        inputSchema: zodToJsonSchema(TaskCommentsListSchema) as never,
      },
      handler: async (args) => {
        const { code } = TaskCommentsListSchema.parse(args);
        return json(await projectClient.getTaskComments(code));
      },
    },
    {
      definition: {
        name: "task_assign",
        description: "Assign an EvaTeam task to a person by login, name, or reference; optionally set waiting-for and status",
        inputSchema: zodToJsonSchema(TaskAssignSchema) as never,
      },
      handler: async (args) => {
        const { taskRef, person, waitingFor, status } = TaskAssignSchema.parse(args);
        const { id } = await personClient.resolveRef(person);
        return json(await projectClient.assignTask(taskRef, id, { status, waitingFor }));
      },
    },
    {
      definition: {
        name: "task_link_create",
        description: "Create a relation between two tasks via CmfRelationOption.create",
        inputSchema: zodToJsonSchema(TaskLinkCreateSchema) as never,
      },
      handler: async (args) => {
        const { outTaskCode, inTaskCode, relationType } = TaskLinkCreateSchema.parse(args);
        return json(await projectClient.createTaskLink(outTaskCode, inTaskCode, relationType));
      },
    },
    {
      definition: {
        name: "task_time_log",
        description: "Log spent time on an EvaTeam task via CmfTask.timetracker_change_time",
        inputSchema: zodToJsonSchema(TaskTimeLogSchema) as never,
      },
      handler: async (args) => {
        const { taskRef, timeSpent, remainingEstimate, text, date } = TaskTimeLogSchema.parse(args);
        return json(
          await projectClient.logTaskTime(taskRef, {
            time_spent: timeSpent,
            remaining_estimate: remainingEstimate,
            text,
            date,
          }),
        );
      },
    },
    {
      definition: {
        name: "task_create_from_template",
        description: "Create an EvaTeam task from a template task",
        inputSchema: zodToJsonSchema(TaskCreateFromTemplateSchema) as never,
      },
      handler: async (args) => {
        const { templateRef, projectCode, params } = TaskCreateFromTemplateSchema.parse(args);
        return json(await projectClient.createTaskFromTemplate(templateRef, projectCode, params));
      },
    },
    {
      definition: {
        name: "project_find_everything",
        description: "Find tasks and wiki documents in a project with one query",
        inputSchema: zodToJsonSchema(ProjectFindEverythingSchema) as never,
      },
      handler: async (args) => {
        if (!wikiClient) throw new Error("project_find_everything requires EvaWiki client");
        const { projectCode, query, limit, taskFields, documentFields } = ProjectFindEverythingSchema.parse(args);
        const project = await projectClient.getProjectByCode(projectCode, ["id", "code", "name"]);
        const projectId = project.id;
        const tasks = await projectClient.listTasks({
          filter: projectScopedFilter(projectId, query),
          fields: taskFields ?? ["id", "code", "name", "status", "responsible", "cmf_created_at", "cmf_modified_at"],
          slice: [0, limit],
        });
        const documents = await wikiClient.listPages({
          filter: documentProjectScopedFilter(projectId, query),
          fields: documentFields ?? ["id", "code", "name", "tree_parent", "cmf_created_at", "cmf_modified_at"],
          slice: [0, limit],
        });
        return json({ project, tasks, documents });
      },
    },
  ];
}

async function buildTaskQuery(
  projectClient: EvaProjectClient,
  input: z.infer<typeof TaskSearchSchema>,
): Promise<TaskQuery> {
  const filters: Array<unknown[] | undefined> = [];
  if (input.projectCode) {
    const project = await projectClient.getProjectByCode(input.projectCode, ["id", "code", "name"]);
    filters.push(["parent_id", "==", project.id]);
  }
  if (input.status) filters.push(["status", "==", input.status]);
  if (input.responsible) filters.push(["responsible", "==", input.responsible]);
  if (input.query) filters.push(searchFilter(input.query));
  if (input.filter) filters.push(input.filter);

  return {
    filter: mergeFilters(filters),
    fields: input.fields,
    slice: input.slice ?? [0, input.limit],
    order_by: input.orderBy,
    include_archived: input.includeArchived,
  };
}

function projectScopedFilter(projectId: string, query?: string): unknown[] | undefined {
  return mergeFilters([["parent_id", "==", projectId], query ? searchFilter(query) : undefined]);
}

function documentProjectScopedFilter(projectId: string, query?: string): unknown[] | undefined {
  return mergeFilters([
    ["OR", ["project_id", "==", projectId], ["project", "==", projectId], ["parent", "==", projectId]],
    query ? searchFilter(query) : undefined,
  ]);
}

function searchFilter(query: string): unknown[] {
  return ["OR", ["code", "ILIKE", `${query}%`], ["name", "ILIKE", `%${query}%`]];
}

function mergeFilters(filters: Array<unknown[] | undefined>): unknown[] | undefined {
  const compact = filters.filter((filter): filter is unknown[] => Boolean(filter));
  if (compact.length === 0) return undefined;
  if (compact.length === 1) return compact[0];
  return compact;
}

function toApiQuery(input: z.infer<typeof QuerySchema>): TaskQuery {
  return {
    filter: input.filter,
    fields: input.fields,
    slice: input.slice,
    order_by: input.orderBy,
    include_archived: input.includeArchived,
  };
}

function json(value: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}
