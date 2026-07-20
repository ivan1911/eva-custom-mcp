# Eva MCP Recommendations

Source snapshot: `docs/eva-api-docs.md`

## API Shape

Eva API uses JSON-RPC over a single endpoint:

```text
POST https://{your-domain}/api/
Authorization: Bearer {token}
Content-Type: application/json
```

Request body:

```json
{
  "jsonrpc": "2.2",
  "method": "CmfTask.list",
  "args": [],
  "kwargs": {
    "filter": ["code", "==", "DEV-000003"],
    "fields": ["*"]
  },
  "callid": "optional-id"
}
```

Useful shared options:

- `fields`: `["*"]`, `["**"]`, `["***"]` for progressively richer object fields.
- `filter`: BQL filter array.
- `slice`: list slicing/pagination.
- `no_meta`: omit metadata in response.

## Current Code Gap

The current clients in `src/client/eva-project.ts` and `src/client/eva-wiki.ts` call Jira/Confluence-like REST endpoints:

- `/rest/api/2/project`
- `/rest/api/2/search`
- `/rest/api/content`
- `/rest/agile/1.0/...`

The docs show Eva should instead use JSON-RPC methods:

- `CmfTask.get/list/create/update/delete`
- `CmfProject.get/list/create/update/delete`
- `CmfDocument.get/list/create/update/delete/rename`
- additional task/document methods from examples, such as `CmfTask.create_task_from_template`, `CmfTask.timetracker_change_time`, `CmfDocument.do_publish`, `CmfDocument.download_all_attachment`.

## Recommended MCP Tools

Prioritize tools for the user's main workflows: pages/wiki and tasks by project.

### Generic Safe Foundation

- `eva_rpc_call`: low-level JSON-RPC escape hatch for power users.
- `eva_model_get`: wrapper for `{class}.get`.
- `eva_model_list`: wrapper for `{class}.list`.

These make the MCP useful even before all domain tools are hand-modeled.

### Projects

- `project_get_by_code`: `CmfProject.get` with `filter: ["code", "==", projectCode]`.
- `project_list`: `CmfProject.list`, with optional search/filter.

### Tasks

- `task_get`: `CmfTask.get` by code or id.
- `task_search`: `CmfTask.list` scoped by project id/code, plus optional BQL filters.
- `task_create`: `CmfTask.create` with parent project, name, description/text, responsible, type.
- `task_update`: `CmfTask.update` by id/code.
- `task_comment_add`: likely via comment API or task-specific method from examples.
- `task_time_log`: `CmfTask.timetracker_change_time`.
- `task_create_from_template`: `CmfTask.create_task_from_template`.

### Wiki/Documents

- `document_get`: `CmfDocument.get` by code or id, fields include text.
- `document_search`: `CmfDocument.list` scoped by project, name/code/text filters.
- `document_create`: `CmfDocument.create` with parent/project/name/text.
- `document_update_text`: `CmfDocument.update`.
- `document_publish`: `CmfDocument.do_publish`.
- `document_rename`: `CmfDocument.rename`.
- `document_attachment_list/download`: `CmfAttachment.list` and `CmfDocument.download_all_attachment`.

## Implementation Plan

1. Replace REST client assumptions with an `EvaRpcClient`.
2. Keep `EVA_BASE_URL` and `EVA_API_TOKEN`; call `${EVA_BASE_URL}/api/`.
3. Return the JSON-RPC `result` field from the client and throw useful errors from `error.message`.
4. Add typed tools for project/task/document workflows, built on top of the generic RPC call.
5. Keep `eva_rpc_call` for methods not yet wrapped.
6. Add smoke tests with mocked `fetch` for request shape and error handling.

