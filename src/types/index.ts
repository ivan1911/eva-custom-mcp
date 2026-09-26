export interface EvaProjectConfig {
  baseUrl: string;
  apiToken?: string;
}

export interface EvaWikiConfig {
  baseUrl: string;
  apiToken?: string;
}

export type { GlossaryArticle } from "./glossary.js";
export type { EvaList, Project, Issue, Sprint } from "./project.js";
export type { Person } from "./person.js";
export type { EvaApiFilter, EvaApiQuery, EvaApiSlice, WikiAttachment, WikiDocument, WikiDocumentMutation } from "./wiki.js";
