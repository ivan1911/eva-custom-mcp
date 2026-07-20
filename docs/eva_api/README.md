# EvaTeam API Notes

Collected from EvaTeam documentation on 2026-07-17.

Sources:
- API index: https://docs.evateam.ru/docs/DOC-000199#api
- Getting started: https://docs.evateam.ru/docs/docs/DOC-000200#nachalo-raboty-s-api
- API rules: https://docs.evateam.ru/docs/docs/DOC-000201#pravila-raboty-s-api
- API options: https://docs.evateam.ru/docs/docs/DOC-000695#dopolnitelnye-opczii-api-zaprosov
- OpenAPI spec page: https://docs.evateam.ru/docs/docs/DOC-001729#api-specification
- Local OpenAPI copy: `oas_evateam_v1_9_22.json`

## Protocol

EvaTeam API uses JSON-RPC-style POST requests:

```http
POST https://{your-domain}/api/?m=CmfDocument.list
Content-Type: application/json
Authorization: Bearer {token}
```

Request body:

```json
{
  "jsonrpc": "2.2",
  "method": "CmfDocument.list",
  "callid": "uuid",
  "args": [],
  "kwargs": {
    "filter": ["code", "==", "DOC-000066"],
    "fields": ["*"],
    "slice": [0, 20],
    "order_by": ["-cmf_created_at"]
  }
}
```

Success response shape:

```json
{
  "jsonrpc": "2.2",
  "result": {},
  "meta": {},
  "callid": "uuid"
}
```

Error response shape:

```json
{
  "jsonrpc": "2.2",
  "error": { "code": "code", "message": "message" },
  "callid": "uuid"
}
```

Useful query options:
- `fields`: `["*"]` loads simple fields, `["**"]` also loads relation fields, `["***"]` also loads m2m fields.
- `slice`: two-number range, for example `[0, 20]`.
- `filter`: simple or compound EvaTeam filter expression.
- `order_by`: sort fields, prefix with `-` for descending order.
- `include_archived`: include archived records where supported.

## Wiki-Relevant Methods

Pages are `CmfDocument` objects:
- `CmfDocument.list`: search/list pages.
- `CmfDocument.count`: count pages.
- `CmfDocument.get`: get a page by filter, commonly `["code", "==", "DOC-..."]`.
- `CmfDocument.create`: create a page draft. Important fields: `name`, `text_draft`, `tree_parent`, `parent`.
- `CmfDocument.update`: update a page by object reference, for example `CmfDocument:<uuid>`.
- `CmfDocument.do_publish`: publish a document draft.
- `CmfDocument.download_all_attachment`: request/download all attachments for a document.

Attachments are `CmfAttachment` objects:
- `CmfAttachment.list`: search/list attachment metadata.
- `CmfAttachment.count`: count attachment metadata.
- `CmfAttachment.get`: get attachment metadata by filter.
- `CmfAttachment.create`: create attachment metadata with `name` and `parent`.
- `CmfAttachment.update`: update attachment metadata by `CmfAttachment:<uuid>`.

## MCP Tool Recommendations

Good initial tools:
- `wiki_page_search`: simple title search over `CmfDocument.list`.
- `wiki_page_list`: raw filter/list for advanced queries.
- `wiki_page_get`: get by document code.
- `wiki_page_create`: create HTML draft page.
- `wiki_page_update`: update draft/title/metadata by object reference.
- `wiki_page_publish`: publish draft after create/update.
- `wiki_attachment_list` and `wiki_attachment_get`: inspect attachment metadata.
- `wiki_attachment_create` and `wiki_attachment_update`: create/update attachment metadata.
- `wiki_attachment_download_all`: expose the documented bulk attachment method.

Open question:
- The OpenAPI v1.9.22 spec documents attachment metadata methods, but does not document binary upload content or multipart upload. A true `wiki_attachment_upload_file` tool should be added only after confirming the file-content upload endpoint or response workflow from EvaTeam.
