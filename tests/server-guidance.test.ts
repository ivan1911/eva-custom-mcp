import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

test("MCP initialization and tool listing expose direct-call guidance and accurate schemas", async () => {
  const previousToken = process.env.EVA_API_TOKEN;
  process.env.EVA_API_TOKEN = "test-token";
  const server = await createServer().finally(() => {
    if (previousToken === undefined) delete process.env.EVA_API_TOKEN;
    else process.env.EVA_API_TOKEN = previousToken;
  });
  const client = new Client({ name: "guidance-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    assert.match(client.getInstructions() ?? "", /my_tasks/);
    assert.match(client.getInstructions() ?? "", /hasMore/);
    const { tools } = await client.listTools();
    for (const name of ["task_get", "task_search", "task_comments_list", "whoami", "person_get", "person_search", "my_tasks"]) {
      assert.equal(tools.find(tool => tool.name === name)?.annotations?.readOnlyHint, true, name);
    }
    const myTasks = tools.find(tool => tool.name === "my_tasks")!;
    assert.equal(myTasks.inputSchema.additionalProperties, false);
    const limit = myTasks.inputSchema.properties!.limit as Record<string, unknown>;
    assert.equal(limit.default, 50);
    assert.equal(limit.exclusiveMinimum, 0);
    assert.equal(limit.maximum, 200);
    for (const args of [{ task: "OPS-1994" }, {}]) {
      const result = await client.callTool({ name: "task_get", arguments: args });
      assert.equal(result.isError, true);
      assert.match(JSON.stringify(result.content), /task|code/);
    }
  } finally {
    await client.close();
    await server.close();
  }
});
