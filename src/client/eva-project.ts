import { EvaTeamClient } from "./index.js";
import type { Project, Sprint, Task, TaskMutation, TaskQuery } from "../types/project.js";

export class EvaProjectClient {
  constructor(private client: EvaTeamClient) {}

  async getProjects(): Promise<Project[]> {
    return this.client.rpc<Project[]>("CmfProject.list", { kwargs: {} });
  }

  async listProjects(query: TaskQuery = {}): Promise<Project[]> {
    return this.client.rpc<Project[]>("CmfProject.list", { kwargs: compactQuery(query) });
  }

  async getProjectByCode(projectCode: string, fields?: string[]): Promise<Project> {
    return this.client.rpc<Project>("CmfProject.get", {
      kwargs: compactQuery({ filter: ["code", "==", projectCode], fields }),
    });
  }

  async listTasks(query: TaskQuery = {}): Promise<Task[]> {
    return this.client.rpc<Task[]>("CmfTask.list", { kwargs: compactQuery(query) });
  }

  async getTaskByCode(code: string, fields?: string[]): Promise<Task> {
    return this.client.rpc<Task>("CmfTask.get", {
      kwargs: compactQuery({ filter: ["code", "==", code], fields }),
    });
  }

  async getTaskById(taskRef: string, fields?: string[]): Promise<Task> {
    return this.client.rpc<Task>("CmfTask.get", {
      args: [taskRef],
      kwargs: fields ? { fields } : undefined,
    });
  }

  async createTask(input: TaskMutation): Promise<Task> {
    return this.client.rpc<Task>("CmfTask.create", { kwargs: compactObject(input) });
  }

  async updateTask(taskRef: string, input: TaskMutation): Promise<Task> {
    return this.client.rpc<Task>("CmfTask.update", {
      args: [taskRef],
      kwargs: compactObject(input),
    });
  }

  async deleteTask(taskRef: string): Promise<unknown> {
    return this.client.rpc<unknown>("CmfTask.delete", { args: [taskRef] });
  }

  async getTaskComments(code: string): Promise<unknown[]> {
    const task = await this.getTaskByCode(code, ["comments.*"]);
    return task.comments ?? [];
  }

  async addTaskComment(taskRef: string, text: string): Promise<unknown> {
    return this.client.rpc<unknown>("CmfComment.create", {
      kwargs: { parent: taskRef, text },
    });
  }

  async assignTask(taskRef: string, personRef: string, status?: string): Promise<Task> {
    return this.updateTask(taskRef, {
      responsible: { id: personRef },
      ...(status ? { status } : {}),
    });
  }

  async createTaskLink(outTaskCode: string, inTaskCode: string, relationType = "system.link"): Promise<unknown> {
    return this.client.rpc<unknown>("CmfRelationOption.create", {
      kwargs: {
        out_link: outTaskCode,
        in_link: inTaskCode,
        relation_type: relationType,
      },
    });
  }

  async logTaskTime(taskRef: string, input: { time_spent: number; remaining_estimate?: number; text?: string; date?: string }): Promise<unknown> {
    return this.client.rpc<unknown>("CmfTask.timetracker_change_time", {
      args: [taskRef],
      kwargs: compactObject(input),
    });
  }

  async createTaskFromTemplate(templateRef: string, projectCode: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return this.client.rpc<unknown>("CmfTask.create_task_from_template", {
      args: [templateRef],
      kwargs: { params: { parent: projectCode, ...params } },
    });
  }

  async getSprints(boardId: number): Promise<Sprint[]> {
    return this.client.rpc<Sprint[]>("CmfSprint.list", { kwargs: { filter: ["board_id", "==", boardId] } });
  }
}

function compactQuery(query: TaskQuery): Record<string, unknown> {
  return compactObject({
    filter: query.filter,
    fields: query.fields,
    slice: query.slice,
    order_by: query.order_by,
    include_archived: query.include_archived,
  });
}

function compactObject<T extends object>(object: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}
