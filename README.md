# eva-custom-mcp

Custom MCP server for EvaTeam glossary pages, project tasks, and wiki documents.

## Local usage

```bash
npm install
npm run build
npm start
```

Glossary tools always read public pages from `https://www.evateam.ru` (override with `EVA_GLOSSARY_URL`),
without a token, so they keep working when `EVA_BASE_URL` points at your company instance.

## MCP client config

```json
{
  "mcpServers": {
    "eva": {
      "command": "npx",
      "args": ["-y", "eva-custom-mcp"],
      "env": {
        "EVA_BASE_URL": "https://yourcompany.evateam.ru",
        "EVA_API_TOKEN": "your-token"
      }
    }
  }
}
```

For local development before publishing:

```json
{
  "mcpServers": {
    "eva": {
      "command": "node",
      "args": ["/absolute/path/to/eva-custom-mcp/dist/index.js"]
    }
  }
}
```

## Tools

- `glossary_article_get`: fetch a glossary article by slug or URL, for example `api`.
- `glossary_search`: resolve a glossary term to an article.

EvaTeam project/task/document tools are enabled when `EVA_API_TOKEN` is set.

```bash
EVA_BASE_URL=https://yourcompany.evateam.ru
EVA_API_TOKEN=your-token
# Optional: enables document_attachment_upload for files inside this directory only.
EVA_UPLOAD_ROOT=/absolute/path/to/uploads
```

EvaTeam tools use JSON-RPC API methods documented in `docs/eva_api` and
`docs/eva-api-docs.md`.

Project/search tools:

- `project_list`: list projects.
- `project_get_by_code`: resolve a project by code.
- `project_find_everything`: search tasks and wiki documents in one project.

Task tools:

- `task_search`: search tasks, optionally scoped by project.
- `task_get`: get a task by code or object reference.
- `task_create`: create a task.
- `task_update`: update a task.
- `task_delete`: delete a task.
- `task_transition`: change task status.
- `task_comment_add`: add a task comment.
- `task_comments_list`: list task comments.
- `task_assign`: assign a task to a person reference.
- `task_link_create`: create a relation between two tasks.
- `task_time_log`: log spent time.
- `task_create_from_template`: create a task from a template.

Document tools:

- `document_search`: search wiki documents by title.
- `document_get`: get a document by code or object reference.
- `document_create`: create a document.
- `document_update_text`: update document draft/title/metadata.
- `document_publish`: publish a document draft.
- `document_rename`: rename a document.
- `document_children_list`: list child documents.
- `document_tree`: list project documents as a flat tree source.
- `document_attachments_list`: list attachment metadata.
- `document_attachment_download`: request/download all document attachments.
- `document_attachment_upload`: create attachment metadata and upload a file with multipart POST.
  Available only when `EVA_UPLOAD_ROOT` is set; files outside that directory (including via symlinks) are rejected.

## Recommended Agent Prompts

### Short Prompt

```text
Use EVA MCP as the source of truth for project tasks and wiki documents.
Prefer compact high-level tools: `project_find_everything`, `task_search`, `task_get`, `task_create`, `task_update`, `task_comment_add`, `task_time_log`, `document_search`, `document_get`, `document_create`, `document_update_text`, `document_publish`.
Always resolve project codes with `project_get_by_code`.
Before mutating an object, fetch it first and summarize the intended change.
Never delete or publish without explicit user confirmation.
Return EVA object codes in user-facing responses.
```

### Full Prompt

```text
You work with EvaTeam through the `eva-custom-mcp` MCP server.

Main rules:
- Always start with `project_get_by_code` when the user provides a project code.
- Use `project_find_everything` for broad project searches.
- For tasks:
  - use `task_search` to find tasks;
  - use `task_get` when a task code is known;
  - use `task_create` to create tasks;
  - use `task_update` to change task fields, status, or assignee;
  - use `task_comment_add` to add comments;
  - use `task_time_log` to log spent time.
- For wiki documents:
  - use `document_search` to find pages/documents;
  - use `document_get` when a document code is known;
  - use `document_create` to create a document;
  - use `document_update_text` to change content;
  - use `document_publish` to publish changes.
- Do not delete tasks or documents without explicit user confirmation.
- Do not publish documents without explicit user confirmation.
- Before changing a task or document, fetch the current object first with `task_get` or `document_get`.
- If the API returns multiple similar results, ask the user which object is intended.
- In user-facing responses, include EVA object codes such as `ABC-000123` for tasks and `DOC-000123` for documents.
- Never reveal API tokens and do not ask the user to paste tokens into chat.

Typical workflows:
1. "Find everything about X in project PRJ"
   - call `project_get_by_code`
   - call `project_find_everything`
   - summarize results grouped into tasks and documents

2. "Create a task in project PRJ"
   - call `project_get_by_code`
   - ask for missing title/description if needed
   - call `task_create`
   - return the created task code

3. "Update a wiki page"
   - find the page with `document_search` or `document_get`
   - summarize the intended change
   - after confirmation, call `document_update_text`
   - if publishing is needed, ask for separate confirmation before `document_publish`

4. "Add a comment to a task"
   - call `task_get`
   - call `task_comment_add`
   - confirm that the comment was added
```
