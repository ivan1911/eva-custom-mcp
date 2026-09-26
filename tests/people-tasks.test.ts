import assert from "node:assert/strict";
import test from "node:test";
import { EvaPersonClient } from "../src/client/eva-person.js";
import { EvaTeamClient } from "../src/client/index.js";
import { EvaProjectClient } from "../src/client/eva-project.js";
import { registerPeopleTools } from "../src/tools/people.js";
import { registerProjectTools } from "../src/tools/project.js";

function fixture(login?: string) {
  const calls: Array<{ method: string; params: any }> = [];
  const person = { id: "CmfPerson:test", login: "test-user", name: "Test User" };
  let tasks: Array<{ id: string }> = [];
  const api = {
    async rpc(method: string, params: any) {
      calls.push({ method, params });
      if (method === "CmfPerson.get") return person;
      if (method === "CmfTask.list") return tasks.slice(...params.kwargs.slice);
      if (method === "CmfTask.update") return { id: "CmfTask:test" };
      throw new Error(`Unexpected RPC: ${method}`);
    },
  } as unknown as EvaTeamClient;
  const people = new EvaPersonClient(api, login);
  const project = new EvaProjectClient(api);
  const tools = [...registerPeopleTools(people, project), ...registerProjectTools(project, people)];
  return {
    calls,
    people,
    tool: (name: string) => tools.find((tool) => tool.definition.name === name)!,
    setTasks: (count: number) => { tasks = Array.from({ length: count }, (_, i) => ({ id: String(i) })); },
  };
}

for (const parameter of ["person", "personRef"]) {
  test(`task_assign accepts ${parameter} and preserves assignment options`, async () => {
    const f = fixture();
    await f.tool("task_assign").handler({
      taskRef: "CmfTask:test", [parameter]: "CmfPerson:test", waitingFor: true, status: "STC-test",
    });
    assert.deepEqual(f.calls, [{ method: "CmfTask.update", params: {
      args: ["CmfTask:test"],
      kwargs: { responsible: { id: "CmfPerson:test" }, waiting_for: { id: "CmfPerson:test" }, status: "STC-test" },
    } }]);
  });
}

test("task_assign rejects missing or conflicting people before mutation", async () => {
  const f = fixture();
  await assert.rejects(() => f.tool("task_assign").handler({ taskRef: "CmfTask:test" }));
  await assert.rejects(() => f.tool("task_assign").handler({
    taskRef: "CmfTask:test", person: "CmfPerson:first", personRef: "CmfPerson:second",
  }));
  assert.equal(f.calls.length, 0);
});

test("task_assign schema advertises both accepted parameters", () => {
  const schema = fixture().tool("task_assign").definition.inputSchema;
  assert.ok(schema.properties?.person);
  assert.ok(schema.properties?.personRef);
  assert.ok(!schema.required?.includes("person"));
  assert.ok(!schema.required?.includes("personRef"));
  assert.ok(schema.required?.includes("taskRef"));
  for (const keyword of ["anyOf", "oneOf", "allOf"]) {
    assert.equal(Object.hasOwn(schema, keyword), false, `Unsupported root keyword: ${keyword}`);
  }
});

test("current user requires a configured login without making an RPC", async () => {
  const f = fixture();
  await assert.rejects(() => f.people.getCurrentUser(), /Set EVA_USER_LOGIN/);
  assert.equal(f.calls.length, 0);
});

test("configured user is resolved by login and cached", async () => {
  const f = fixture(" test-user ");
  assert.equal((await f.people.getCurrentUser()).login, "test-user");
  await f.people.getCurrentUser();
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0]?.params.kwargs.filter, ["login", "==", "test-user"]);
});

test("my_tasks can query an explicit person without EVA_USER_LOGIN", async () => {
  const f = fixture();
  f.setTasks(1);
  const response = await f.tool("my_tasks").handler({ person: "test-user", role: "waiting" });
  const body = JSON.parse((response as any).content[0].text);
  assert.equal(body.tasks.length, 1);
  assert.equal(body.hasMore, false);
  assert.deepEqual(f.calls.at(-1)?.params.kwargs.filter, [
    ["waiting_for", "==", "CmfPerson:test"], ["cache_status_type", "!=", "CLOSED"],
  ]);
});

for (const [available, hasMore] of [[0, false], [2, false], [3, true]] as const) {
  test(`my_tasks reports hasMore=${hasMore} for ${available} tasks at limit 2`, async () => {
    const f = fixture("test-user");
    f.setTasks(available);
    const response = await f.tool("my_tasks").handler({ limit: 2 });
    const body = JSON.parse((response as any).content[0].text);
    assert.equal(body.tasks.length, Math.min(available, 2));
    assert.equal(body.hasMore, hasMore);
    assert.deepEqual(f.calls.at(-1)?.params.kwargs.slice, [0, 3]);
  });
}
