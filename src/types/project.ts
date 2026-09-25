import type { EvaApiQuery } from "./wiki.js";

export interface Project {
  id: string;
  code?: string;
  key: string;
  name: string;
  description?: string;
  lead?: string;
  [key: string]: unknown;
}

export interface Task {
  id: string;
  code?: string;
  name?: string;
  summary?: string;
  description?: string;
  text?: string;
  status?: unknown;
  responsible?: unknown;
  assignee?: string;
  priority?: string;
  parent?: unknown;
  parent_id?: string;
  project?: unknown;
  cmf_created_at?: string;
  cmf_modified_at?: string;
  comments?: unknown[];
  [key: string]: unknown;
}

export interface TaskMutation {
  name?: string;
  text?: string;
  description?: string;
  parent?: string | { id: string };
  status?: string | { id: string };
  responsible?: string | { id: string };
  cmf_owner?: string | { id: string };
  waiting_for?: string | { id: string };
  lists?: string[];
  priority?: string | { id: string };
  logic_type?: string;
  type?: string;
  [key: string]: unknown;
}

export interface EvaList {
  id: string;
  code?: string;
  name?: string;
  [key: string]: unknown;
}

export interface Sprint {
  id: string;
  name: string;
  state: "active" | "future" | "closed";
  startDate?: string;
  endDate?: string;
}

export type ProjectQuery = EvaApiQuery;
export type TaskQuery = EvaApiQuery;
export type Issue = Task;
