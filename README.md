# eva-custom-mcp

[![npm](https://img.shields.io/npm/v/eva-custom-mcp)](https://www.npmjs.com/package/eva-custom-mcp)

MCP server that connects AI assistants (Claude Desktop, Claude Code, Cursor, and other MCP clients) to
[EvaTeam](https://evateam.ru): search and edit tasks, work with wiki documents, and read the public EvaTeam glossary.

## Requirements

- [Node.js](https://nodejs.org) 18 or newer (check with `node -v`). `npx` comes with Node.js.
- For project, task, and wiki tools: your EvaTeam address (for example `https://yourcompany.evateam.ru`)
  and an API token.

Without a token the server still starts, but only the glossary tools are available.

### Getting an API token

In EvaTeam, open your personal profile card, go to the **Security** section, and generate an API token.
The token has the same permissions as your account, so keep it private.

## Installation

You don't need to download or build anything: the MCP client starts the server from npm with `npx`.
Add it to your client using one of the options below, then restart the client.

### Claude Desktop

Open **Settings → Developer → Edit Config**, or edit the file directly:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

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

If the file already has other servers, add `"eva": { ... }` inside the existing `mcpServers` object.

On Windows, if the server fails to start with `npx` not found, use `"command": "cmd"` and
`"args": ["/c", "npx", "-y", "eva-custom-mcp"]`.

### Claude Code

```bash
claude mcp add --transport stdio --scope user \
  --env EVA_BASE_URL=https://yourcompany.evateam.ru \
  --env EVA_API_TOKEN=your-token \
  eva -- npx -y eva-custom-mcp
```

Check the connection with `claude mcp list` or `/mcp` inside Claude Code.

### Cursor and other MCP clients

Use the same JSON as for Claude Desktop. In Cursor it goes into `~/.cursor/mcp.json`
(all projects) or `.cursor/mcp.json` (one project).

### Global install (optional)

If you prefer not to use `npx`:

```bash
npm install -g eva-custom-mcp
```

Then use `"command": "eva-custom-mcp"` with no `args` in the client config.

### Updating

`npx` can keep using a cached copy. To always start the newest version, use
`"args": ["-y", "eva-custom-mcp@latest"]`, or pin a version such as `eva-custom-mcp@0.1.2`.
With a global install, run `npm install -g eva-custom-mcp@latest`.

## Configuration

All settings are environment variables, passed through the `env` block of the client config.

| Variable | Required | Description |
| --- | --- | --- |
| `EVA_BASE_URL` | For EvaTeam tools | Your EvaTeam address, for example `https://yourcompany.evateam.ru`. |
| `EVA_API_TOKEN` | For EvaTeam tools | API token. Enables project, task, and document tools. |
| `EVA_UPLOAD_ROOT` | No | Absolute path to a folder. Enables `document_attachment_upload` for files inside this folder only. Uploads are off when unset. |
| `EVA_GLOSSARY_URL` | No | Site for the glossary tools. Defaults to `https://www.evateam.ru`; the token is never sent there. |

## Checking that it works

After restarting the client, ask the assistant something like *"Show my EvaTeam projects"*.
It should call `project_list`.

To test the server without an AI client, use the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector \
  -e EVA_BASE_URL=https://yourcompany.evateam.ru -e EVA_API_TOKEN=your-token \
  npx -y eva-custom-mcp
```

## Troubleshooting

- **Only `glossary_*` tools are listed**: `EVA_API_TOKEN` is not set or not passed to the server.
  Check the `env` block and restart the client.
- **`401`/`403` errors**: the token is wrong, expired, or belongs to another EvaTeam instance. Check `EVA_BASE_URL`.
- **Server does not start**: check that `node -v` is 18 or newer, and that `npx` works in a terminal.
- **`document_attachment_upload` is missing**: set `EVA_UPLOAD_ROOT`. Uploads are limited to that folder.

## Tools

Glossary tools:

- `glossary_article_get`: fetch a glossary article by slug or URL, for example `api`.
- `glossary_search`: resolve a glossary term to an article.

Glossary tools are always available. The project, task, and document tools below appear only when
`EVA_API_TOKEN` is set.

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

## Development

```bash
git clone https://github.com/ivan1911/eva-custom-mcp.git
cd eva-custom-mcp
npm install
npm run build
```

To run a local build from an MCP client, point it at the compiled entry point:

```json
{
  "mcpServers": {
    "eva": {
      "command": "node",
      "args": ["/absolute/path/to/eva-custom-mcp/dist/index.js"],
      "env": {
        "EVA_BASE_URL": "https://yourcompany.evateam.ru",
        "EVA_API_TOKEN": "your-token"
      }
    }
  }
}
```

Other commands: `npm run dev` (watch mode), `npm run typecheck`, `make publish-dry-run`, and `make publish`
(needs `NODE_AUTH_TOKEN`).

The server calls EvaTeam JSON-RPC methods; API notes and the OpenAPI spec are in `docs/eva_api`.
