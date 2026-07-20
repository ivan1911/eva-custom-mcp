import { EvaTeamClient } from "./index.js";
import type { GlossaryArticle } from "../types/glossary.js";

const DEFAULT_GLOSSARY_PATH = "/glossary";

export class EvaGlossaryClient {
  constructor(private client: EvaTeamClient) {}

  async getArticle(slugOrUrl: string): Promise<GlossaryArticle> {
    const path = glossaryPath(slugOrUrl);
    const html = await this.client.getText(path);
    return parseGlossaryArticle(html, new URL(path, this.client.origin).toString());
  }

  async search(query: string): Promise<GlossaryArticle[]> {
    const article = await this.getArticle(query);
    return [article];
  }
}

function glossaryPath(slugOrUrl: string): string {
  const value = slugOrUrl.trim();
  if (!value) {
    throw new Error("Glossary slug or URL is required");
  }

  try {
    const url = new URL(value);
    if (!url.pathname.startsWith(DEFAULT_GLOSSARY_PATH)) {
      throw new Error(`URL must point to ${DEFAULT_GLOSSARY_PATH}`);
    }
    return normalizePath(url.pathname);
  } catch (error) {
    if (error instanceof TypeError) {
      return normalizePath(`${DEFAULT_GLOSSARY_PATH}/${value}`);
    }
    throw error;
  }
}

function normalizePath(path: string): string {
  const normalized = path.replace(/\/+$/, "");
  return `${normalized || DEFAULT_GLOSSARY_PATH}/`;
}

function parseGlossaryArticle(html: string, url: string): GlossaryArticle {
  const main = articleSlice(html);
  const title = firstMatch(main, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ?? "EvaTeam glossary article";
  const publishedAt =
    firstMatch(main, /Опубликовано:\s*([0-9]{2}-[0-9]{2}-[0-9]{4})/i) ??
    firstMatch(main, /([А-Яа-яA-Za-z]+\s+\d{1,2},\s+\d{4})/i);
  const headings = [...main.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((match) =>
    cleanText(match[1] ?? ""),
  );
  const text = cleanText(
    main
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/(h1|h2|h3|p|li|div|section)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, " "),
  );

  return {
    title: cleanText(title),
    slug: new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "",
    url,
    ...(publishedAt ? { publishedAt: cleanText(publishedAt) } : {}),
    headings,
    text,
  };
}

function articleSlice(html: string): string {
  const h1Index = html.search(/<h1[^>]*>/i);
  if (h1Index === -1) return html;

  const footerIndex = html.indexOf("Опубликовано:", h1Index);
  if (footerIndex === -1) return html.slice(h1Index);

  const afterPublished = html.indexOf("</", footerIndex);
  return html.slice(h1Index, afterPublished === -1 ? undefined : afterPublished + 8);
}

function firstMatch(value: string, pattern: RegExp): string | undefined {
  return value.match(pattern)?.[1];
}

function cleanText(value: string): string {
  return decodeHtml(value)
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
