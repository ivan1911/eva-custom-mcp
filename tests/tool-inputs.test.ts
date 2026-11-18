import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { EvaPersonClient } from "../src/client/eva-person.js";
import { EvaProjectClient } from "../src/client/eva-project.js";
import type { EvaTeamClient } from "../src/client/index.js";
import { registerProjectTools } from "../src/tools/project.js";
import { zodToJsonSchema } from "../src/utils/zod-to-json.js";

test("published input schemas preserve strict keys, bounds, defaults, and descriptions", () => {
  const schema = zodToJsonSchema(z.object({
    code: z.string().trim().min(1).optional().describe("Task code"),
    limit: z.number().int().positive().max(200).default(50).describe("Result limit"),
  }).strict());
  assert.deepEqual(schema, {
    type: "object",
    additionalProperties: false,
    properties: {
      code: { type: "string", minLength: 1, description: "Task code" },
      limit: { type: "integer", exclusiveMinimum: 0, maximum: 200, default: 50, description: "Result limit" },
    },
  });
  assert.equal(zodToJsonSchema(z.object({ value: z.string() })).additionalProperties, undefined);
  assert.deepEqual(zodToJsonSchema(z.number().min(1).lt(10)), { type: "number", minimum: 1, exclusiveMaximum: 10 });
});

function fixture() {
  const calls: Array<{ method: string; params: any }> = [];
  const task = { id: "CmfTask:test", code: "OPS-1994", status: { name: "In progress" }, comments: [] };
  const api = { async rpc(method: string, params: any) {
    calls.push({ method, params });
    if (method === "CmfTask.get") return task;
    throw new Error(`Unexpected RPC: ${method}`);
  } } as unknown as EvaTeamClient;
  const tools = registerProjectTools(new EvaProjectClient(api), new EvaPersonClient(api));
  return { calls, task, tool: (name: string) => tools.find(t => t.definition.name === name)! };
}

test("task_get reads status by code or reference in a single API request", async () => {
  for (const selector of [{ code: " OPS-1994 " }, { taskRef: " CmfTask:test " }]) {
    const f = fixture();
    const response = await f.tool("task_get").handler(selector);
    assert.deepEqual(JSON.parse(response.content[0].text), f.task);
    assert.equal(f.calls.length, 1);
    assert.ok(f.calls[0].params.kwargs.fields.includes("*"));
    assert.ok(f.calls[0].params.kwargs.fields.includes("status.name"));
    if ("code" in selector) assert.deepEqual(f.calls[0].params.kwargs.filter, ["code", "==", "OPS-1994"]);
    else assert.deepEqual(f.calls[0].params.args, ["CmfTask:test"]);
  }
});

test("task_get preserves explicitly requested fields", async () => {
  const f = fixture();
  await f.tool("task_get").handler({ code: "OPS-1994", fields: ["code", "text"] });
  assert.deepEqual(f.calls[0].params.kwargs.fields, ["code", "text"]);
});

test("task readers reject invented task parameters and empty identifiers before an API request", async () => {
  const f = fixture();
  for (const name of ["task_get", "task_comments_list"]) {
    assert.equal(f.tool(name).definition.inputSchema.additionalProperties, false);
    await assert.rejects(() => f.tool(name).handler({ code: "OPS-1994", task: "OPS-1994" }), /task/);
    await assert.rejects(() => f.tool(name).handler({ code: "  " }));
  }
  await assert.rejects(() => f.tool("task_get").handler({}), /code.*taskRef.*OPS-1994/);
  assert.equal(f.calls.length, 0);
  const schema = f.tool("task_get").definition.inputSchema;
  for (const keyword of ["anyOf", "oneOf", "allOf"]) assert.equal(Object.hasOwn(schema, keyword), false);
});

test("task_comments_list accepts a code directly without a preliminary task_get", async () => {
  const f = fixture();
  const response = await f.tool("task_comments_list").handler({ code: " OPS-1994 " });
  assert.deepEqual(JSON.parse(response.content[0].text), []);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0].params.kwargs.filter, ["code", "==", "OPS-1994"]);
});
