import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("/Users/ivkiselev/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright");

const docsUrl = "https://docs.evateam.ru/docs/DOC-000199#api";
const outputPath = join(process.cwd(), "docs", "eva-api-docs.md");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  locale: "ru-RU",
  viewport: { width: 1440, height: 1400 },
});

const network = [];
page.on("response", async (response) => {
  const url = response.url();
  if (!url.includes("docs.evateam.ru")) return;

  const item = {
    method: response.request().method(),
    status: response.status(),
    url,
    contentType: response.headers()["content-type"] ?? "",
  };

  if (
    response.status() < 400 &&
    (item.contentType.includes("json") || url.includes("/api/") || url.includes("/pub/"))
  ) {
    try {
      const body = await response.text();
      item.bodyPreview = body.slice(0, 4000);
      item.bodyLength = body.length;
    } catch (error) {
      item.bodyError = error instanceof Error ? error.message : String(error);
    }
  }

  network.push(item);
});

async function readPage(url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(4_000);

  const title = await page.title();
  const currentUrl = page.url();
  const bodyText = await page.locator("body").innerText({ timeout: 15_000 });
  const headings = await page.locator("h1,h2,h3,h4").evaluateAll((nodes) =>
    nodes
      .map((node) => ({
        level: Number(node.tagName.slice(1)),
        text: node.textContent?.trim() ?? "",
      }))
      .filter((heading) => heading.text),
  );
  const links = await page.locator("a").evaluateAll((nodes) =>
    nodes
      .map((node) => ({
        text: node.textContent?.replace(/\s+/g, " ").trim() ?? "",
        href: node.href,
      }))
      .filter((link) => link.text && link.href),
  );

  return { title, currentUrl, bodyText, headings, links };
}

const rootPage = await readPage(docsUrl);
const wantedTitles = new Set([
  "Начало работы с API",
  "Правила работы с API",
  "API Specification",
  "Дополнительные опции API запросов",
  "Справочник методов",
  "Матрица прав проектных сущностей",
  "Примеры API запросов",
]);
const childUrls = [
  ...new Map(
    rootPage.links
      .filter((link) => wantedTitles.has(link.text) && link.href.includes("DOC-"))
      .map((link) => [link.text, link.href]),
  ).entries(),
].map(([label, url]) => ({ label, url }));

const pages = [rootPage];
for (const child of childUrls) {
  pages.push({ childLabel: child.label, ...(await readPage(child.url)) });
}

await mkdir(join(process.cwd(), "docs"), { recursive: true });

const markdown = [
  "# Eva API Documentation Snapshot",
  "",
  `Source: ${docsUrl}`,
  `Captured at: ${new Date().toISOString()}`,
  "",
  "## Captured Pages",
  "",
  ...pages.map((capturedPage) => `- ${capturedPage.childLabel ?? "API"}: ${capturedPage.currentUrl}`),
  "",
  "## API Section Links",
  "",
  ...childUrls.map((link) => `- ${link.label}: ${link.url}`),
  "",
  ...pages.flatMap((capturedPage, index) => [
    `## Page ${index + 1}: ${capturedPage.childLabel ?? "API"}`,
    "",
    `Captured URL: ${capturedPage.currentUrl}`,
    `Page title: ${capturedPage.title}`,
    "",
    "### Headings",
    "",
    ...capturedPage.headings.map(
      (heading) => `${"  ".repeat(Math.max(0, heading.level - 1))}- ${heading.text}`,
    ),
    "",
    "### Page Text",
    "",
    capturedPage.bodyText,
    "",
  ]),
  "",
  "## Network Responses",
  "",
  "```json",
  JSON.stringify(network, null, 2),
  "```",
  "",
].join("\n");

await writeFile(outputPath, markdown, "utf8");
await browser.close();

console.log(
  JSON.stringify(
    {
      outputPath,
      pageCount: pages.length,
      childUrls,
      pages: pages.map((capturedPage) => ({
        label: capturedPage.childLabel ?? "API",
        currentUrl: capturedPage.currentUrl,
        textLength: capturedPage.bodyText.length,
        headingCount: capturedPage.headings.length,
        textStart: capturedPage.bodyText.slice(0, 400),
      })),
      networkCount: network.length,
    },
    null,
    2,
  ),
);
