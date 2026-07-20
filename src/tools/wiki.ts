import { z } from "zod";
import { zodToJsonSchema } from "../utils/zod-to-json.js";
import type { EvaWikiClient } from "../client/eva-wiki.js";
import type { EvaApiQuery, WikiDocumentMutation } from "../types/wiki.js";
import type { ToolDefinition } from "./index.js";

const FilterSchema = z.array(z.unknown()).describe('EvaTeam filter, for example ["code", "==", "DOC-000001"]');
const FieldsSchema = z.array(z.string()).describe('Fields to return. Use ["*"], ["**"], or explicit field names.');
const SliceSchema = z.tuple([z.number(), z.number()]).describe("Result slice, for example [0, 20]");
const OrderBySchema = z.array(z.string()).describe('Sort fields, for example ["-cmf_created_at"]');

const QuerySchema = z.object({
  filter: FilterSchema.optional(),
  fields: FieldsSchema.optional(),
  slice: SliceSchema.optional(),
  orderBy: OrderBySchema.optional(),
  includeArchived: z.boolean().optional(),
});

const PageSearchSchema = z.object({
  query: z.string().describe("Text to search in page title"),
  fields: FieldsSchema.optional(),
  limit: z.number().optional().default(20),
});

const DocumentGetSchema = z.object({
  code: z.string().optional().describe("Document code, for example DOC-000066"),
  documentRef: z.string().optional().describe("Document object reference, for example CmfDocument:<uuid>"),
  fields: FieldsSchema.optional(),
});

const PageCreateSchema = z.object({
  name: z.string().describe("Page title"),
  textDraft: z.string().describe("HTML draft content"),
  treeParent: z.string().optional().describe("Parent section/document code, for example DOC-ROOT"),
  parent: z.string().optional().describe("Owner project code, for example PRJ-001"),
  cmfOwner: z.string().optional(),
  responsible: z.string().optional(),
  executors: z.array(z.string()).optional(),
  spectators: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  fullScreen: z.boolean().optional(),
  categories: z.array(z.string()).optional(),
});

const PageUpdateSchema = PageCreateSchema.partial().extend({
  documentRef: z.string().describe("Document object reference, for example CmfDocument:<uuid>"),
});

const DocumentRefSchema = z.object({
  documentRef: z.string().describe("Document object reference, for example CmfDocument:<uuid>"),
});

const DocumentRenameSchema = DocumentRefSchema.extend({
  name: z.string().describe("New document title"),
});

const DocumentChildrenSchema = z.object({
  parentRefOrCode: z.string().describe("Parent document/project reference or code"),
  filter: FilterSchema.optional(),
  fields: FieldsSchema.optional(),
  slice: SliceSchema.optional(),
  orderBy: OrderBySchema.optional(),
});

const DocumentTreeSchema = z.object({
  projectRefOrCode: z.string().describe("Project reference or code"),
  filter: FilterSchema.optional(),
  fields: FieldsSchema.optional(),
  slice: SliceSchema.optional(),
  orderBy: OrderBySchema.optional(),
});

const AttachmentUploadSchema = z.object({
  parentRef: z.string().describe("Document/task object reference or code that will own the attachment"),
  filePath: z.string().describe("Local file path to upload"),
  name: z.string().optional().describe("Attachment name. Defaults to file basename."),
});

export function registerWikiTools(client: EvaWikiClient): ToolDefinition[] {
  return [
    {
      definition: {
        name: "document_search",
        description: "Search EvaWiki documents by title using CmfDocument.list",
        inputSchema: zodToJsonSchema(PageSearchSchema) as never,
      },
      handler: async (args) => {
        const { query, fields, limit } = PageSearchSchema.parse(args);
        const documents = await client.listPages({
          filter: ["name", "LIKE", `%${query}%`],
          fields,
          slice: [0, limit],
          order_by: ["name"],
        });
        return json(documents);
      },
    },
    {
      definition: {
        name: "document_get",
        description: "Get an EvaWiki document by code or object reference",
        inputSchema: zodToJsonSchema(DocumentGetSchema) as never,
      },
      handler: async (args) => {
        const { code, documentRef, fields } = DocumentGetSchema.parse(args);
        if (!code && !documentRef) throw new Error("Either code or documentRef is required");
        const document = documentRef ? await client.getPageByRef(documentRef, fields) : await client.getPageByCode(code as string, fields);
        return json(document);
      },
    },
    {
      definition: {
        name: "document_create",
        description: "Create an EvaWiki document as CmfDocument with HTML draft content",
        inputSchema: zodToJsonSchema(PageCreateSchema) as never,
      },
      handler: async (args) => {
        const input = toDocumentMutation(PageCreateSchema.parse(args));
        const document = await client.createPage(input as WikiDocumentMutation & { name: string; text_draft: string });
        return json(document);
      },
    },
    {
      definition: {
        name: "document_update_text",
        description: "Update EvaWiki document title, HTML draft text, or metadata by CmfDocument object reference",
        inputSchema: zodToJsonSchema(PageUpdateSchema) as never,
      },
      handler: async (args) => {
        const { documentRef, ...input } = PageUpdateSchema.parse(args);
        const document = await client.updatePage(documentRef, toDocumentMutation(input));
        return json(document);
      },
    },
    {
      definition: {
        name: "document_publish",
        description: "Publish an EvaWiki document draft by CmfDocument object reference",
        inputSchema: zodToJsonSchema(DocumentRefSchema) as never,
      },
      handler: async (args) => {
        const { documentRef } = DocumentRefSchema.parse(args);
        return json(await client.publishPage(documentRef));
      },
    },
    {
      definition: {
        name: "document_rename",
        description: "Rename an EvaWiki document via CmfDocument.rename",
        inputSchema: zodToJsonSchema(DocumentRenameSchema) as never,
      },
      handler: async (args) => {
        const { documentRef, name } = DocumentRenameSchema.parse(args);
        return json(await client.renamePage(documentRef, name));
      },
    },
    {
      definition: {
        name: "document_children_list",
        description: "List child EvaWiki documents for a parent document/project",
        inputSchema: zodToJsonSchema(DocumentChildrenSchema) as never,
      },
      handler: async (args) => {
        const { parentRefOrCode, ...query } = DocumentChildrenSchema.parse(args);
        return json(await client.listChildren(parentRefOrCode, toApiQuery(query)));
      },
    },
    {
      definition: {
        name: "document_tree",
        description: "List EvaWiki documents for a project as a flat tree source",
        inputSchema: zodToJsonSchema(DocumentTreeSchema) as never,
      },
      handler: async (args) => {
        const { projectRefOrCode, ...query } = DocumentTreeSchema.parse(args);
        return json(await client.getDocumentTree(projectRefOrCode, toApiQuery(query)));
      },
    },
    {
      definition: {
        name: "document_attachments_list",
        description: "List EvaTeam attachments with a raw CmfAttachment filter",
        inputSchema: zodToJsonSchema(QuerySchema) as never,
      },
      handler: async (args) => {
        const query = toApiQuery(QuerySchema.parse(args));
        return json(await client.listAttachments(query));
      },
    },
    {
      definition: {
        name: "document_attachment_download",
        description: "Request/download all attachments for a document via CmfDocument.download_all_attachment",
        inputSchema: zodToJsonSchema(DocumentRefSchema) as never,
      },
      handler: async (args) => {
        const { documentRef } = DocumentRefSchema.parse(args);
        return json(await client.downloadAllAttachments(documentRef));
      },
    },
    {
      definition: {
        name: "document_attachment_upload",
        description: "Upload a local file as an EvaTeam attachment: CmfAttachment.create, CmfAttachment.get(url), multipart POST",
        inputSchema: zodToJsonSchema(AttachmentUploadSchema) as never,
      },
      handler: async (args) => {
        const { parentRef, filePath, name } = AttachmentUploadSchema.parse(args);
        return json(await client.uploadAttachmentFile(parentRef, filePath, name));
      },
    },
  ];
}

function toApiQuery(input: z.infer<typeof QuerySchema>): EvaApiQuery {
  return {
    filter: input.filter,
    fields: input.fields,
    slice: input.slice,
    order_by: input.orderBy,
    include_archived: input.includeArchived,
  };
}

function toDocumentMutation(input: z.infer<typeof PageCreateSchema> | Omit<z.infer<typeof PageUpdateSchema>, "documentRef">): WikiDocumentMutation {
  return {
    name: input.name,
    text_draft: input.textDraft,
    tree_parent: input.treeParent,
    parent: input.parent,
    cmf_owner: input.cmfOwner,
    responsible: input.responsible,
    executors: input.executors,
    spectators: input.spectators,
    tags: input.tags,
    full_screen: input.fullScreen,
    categories: input.categories,
  };
}

function json(value: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}
