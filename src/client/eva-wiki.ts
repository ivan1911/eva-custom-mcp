import { basename } from "node:path";
import { readFile } from "node:fs/promises";
import { EvaTeamClient } from "./index.js";
import type { EvaApiQuery, WikiAttachment, WikiDocument, WikiDocumentMutation } from "../types/wiki.js";

export class EvaWikiClient {
  constructor(private client: EvaTeamClient) {}

  async listPages(query: EvaApiQuery = {}): Promise<WikiDocument[]> {
    return this.client.rpc<WikiDocument[]>("CmfDocument.list", { kwargs: compactQuery(query) });
  }

  async countPages(query: EvaApiQuery = {}): Promise<number> {
    return this.client.rpc<number>("CmfDocument.count", { kwargs: compactQuery(query) });
  }

  async getPageByCode(code: string, fields?: string[]): Promise<WikiDocument> {
    return this.client.rpc<WikiDocument>("CmfDocument.get", {
      kwargs: compactQuery({ filter: ["code", "==", code], fields }),
    });
  }

  async getPageByRef(documentRef: string, fields?: string[]): Promise<WikiDocument> {
    return this.client.rpc<WikiDocument>("CmfDocument.get", {
      args: [documentRef],
      kwargs: fields ? { fields } : undefined,
    });
  }

  async createPage(input: WikiDocumentMutation & { name: string; text_draft: string }): Promise<WikiDocument> {
    return this.client.rpc<WikiDocument>("CmfDocument.create", { kwargs: compactObject(input) });
  }

  async updatePage(documentRef: string, input: WikiDocumentMutation): Promise<WikiDocument> {
    return this.client.rpc<WikiDocument>("CmfDocument.update", {
      args: [documentRef],
      kwargs: compactObject(input),
    });
  }

  async renamePage(documentRef: string, name: string): Promise<unknown> {
    return this.client.rpc<unknown>("CmfDocument.rename", {
      args: [documentRef],
      kwargs: { name },
    });
  }

  async listChildren(parentRefOrCode: string, query: EvaApiQuery = {}): Promise<WikiDocument[]> {
    return this.listPages({
      ...query,
      filter: mergeFilters([["tree_parent", "==", parentRefOrCode], query.filter]),
    });
  }

  async getDocumentTree(projectRefOrCode: string, query: EvaApiQuery = {}): Promise<WikiDocument[]> {
    return this.listPages({
      ...query,
      filter: mergeFilters([
        ["OR", ["project_id", "==", projectRefOrCode], ["project", "==", projectRefOrCode], ["parent", "==", projectRefOrCode]],
        query.filter,
      ]),
      order_by: query.order_by ?? ["orderno", "name"],
    });
  }

  async publishPage(documentRef: string): Promise<unknown> {
    return this.client.rpc<unknown>("CmfDocument.do_publish", { args: [documentRef] });
  }

  async downloadAllAttachments(documentRef: string): Promise<unknown> {
    return this.client.rpc<unknown>("CmfDocument.download_all_attachment", { args: [documentRef] });
  }

  async listAttachments(query: EvaApiQuery = {}): Promise<WikiAttachment[]> {
    return this.client.rpc<WikiAttachment[]>("CmfAttachment.list", { kwargs: compactQuery(query) });
  }

  async getAttachmentByCode(code: string, fields?: string[]): Promise<WikiAttachment> {
    return this.client.rpc<WikiAttachment>("CmfAttachment.get", {
      kwargs: compactQuery({ filter: ["code", "==", code], fields }),
    });
  }

  async createAttachment(name: string, parent: string): Promise<WikiAttachment> {
    return this.client.rpc<WikiAttachment>("CmfAttachment.create", { kwargs: { name, parent } });
  }

  async updateAttachment(attachmentRef: string, input: { name?: string; parent?: string }): Promise<WikiAttachment> {
    return this.client.rpc<WikiAttachment>("CmfAttachment.update", {
      args: [attachmentRef],
      kwargs: compactObject(input),
    });
  }

  async uploadAttachmentFile(parentRef: string, filePath: string, name?: string): Promise<unknown> {
    const attachment = await this.createAttachment(name ?? basename(filePath), parentRef);
    const attachmentRef = String(attachment.id ?? attachment);
    const attachmentWithUrl = await this.client.rpc<WikiAttachment>("CmfAttachment.get", {
      kwargs: compactQuery({ filter: ["id", "==", attachmentRef], fields: ["url"] }),
    });
    if (!attachmentWithUrl.url || typeof attachmentWithUrl.url !== "string") {
      throw new Error("CmfAttachment.get did not return an upload url");
    }

    const data = await readFile(filePath);
    const form = new FormData();
    form.append("file", new Blob([data]), name ?? basename(filePath));
    const uploadResult = await this.client.postForm(attachmentWithUrl.url, form);

    return { attachment, uploadUrl: this.client.resolveUrl(attachmentWithUrl.url), uploadResult };
  }
}

function compactQuery(query: EvaApiQuery): Record<string, unknown> {
  return compactObject(query as Record<string, unknown>);
}

function compactObject<T extends object>(object: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function mergeFilters(filters: Array<unknown[] | undefined>): unknown[] | undefined {
  const compact = filters.filter((filter): filter is unknown[] => Boolean(filter));
  if (compact.length === 0) return undefined;
  if (compact.length === 1) return compact[0];
  return compact;
}
