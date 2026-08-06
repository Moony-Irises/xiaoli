import assert from "node:assert/strict";
import test from "node:test";
import { buildDebugHtml } from "../src/debug/debug-server.js";

test("debug Set Goal dialog renders an executable browser script", () => {
  const html = buildDebugHtml();
  const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
  const script = scriptMatch?.[1];

  assert.ok(script, "debug page should include its browser script");
  assert.match(html, /id="goal-dialog"/);
  assert.match(html, /id="command-history"/);
  assert.match(html, /命令历史 Command History/);
  assert.match(html, /示例：跟随 Judy/);
  assert.match(script, /goalDialog\.showModal\(\)/);
  assert.match(script, /setText\(ids\.commandHistory, data\.commandHistory\)/);
  assert.doesNotMatch(script, /const goal = prompt\(/);
  assert.doesNotThrow(() => new Function(script));
});
