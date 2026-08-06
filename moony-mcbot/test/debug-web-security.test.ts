import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { BotRegistry } from "../src/runtime/bot-registry.js";
import { startDebugWebServer } from "../src/debug/debug-server.js";

interface HttpResult {
  statusCode: number;
  body: string;
}

async function getFreePort(): Promise<number> {
  const probe = http.createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => resolve());
  });
  const address = probe.address();
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  if (!address || typeof address === "string") throw new Error("Could not allocate a test port");
  return address.port;
}

async function request(port: number, path: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<HttpResult> {
  return await new Promise<HttpResult>((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: options.method ?? "GET",
        headers: options.headers
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
      }
    );
    req.once("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

test("debug web API enforces token, origin, and request body limits", async () => {
  const envNames = [
    "MCBOT_DEBUG_WEB_ENABLED",
    "MCBOT_DEBUG_WEB_HOST",
    "MCBOT_DEBUG_WEB_PORT",
    "MCBOT_DEBUG_WEB_AUTH_TOKEN",
    "MCBOT_DEBUG_WEB_MAX_BODY_BYTES",
    "MCBOT_DEBUG_WEB_ALLOWED_ORIGINS"
  ];
  const previous = new Map<string, string | undefined>(envNames.map((name) => [name, process.env[name]]));
  const port = await getFreePort();
  let server: http.Server | null = null;

  try {
    process.env.MCBOT_DEBUG_WEB_ENABLED = "true";
    process.env.MCBOT_DEBUG_WEB_HOST = "127.0.0.1";
    process.env.MCBOT_DEBUG_WEB_PORT = String(port);
    process.env.MCBOT_DEBUG_WEB_AUTH_TOKEN = "test-debug-token";
    process.env.MCBOT_DEBUG_WEB_MAX_BODY_BYTES = "1024";
    process.env.MCBOT_DEBUG_WEB_ALLOWED_ORIGINS = `http://127.0.0.1:${port}`;

    server = startDebugWebServer(new BotRegistry());
    assert.ok(server);
    await new Promise<void>((resolve) => server?.once("listening", () => resolve()));

    assert.equal((await request(port, "/")).statusCode, 200);
    assert.equal((await request(port, "/api/bots")).statusCode, 401);
    assert.equal(
      (await request(port, "/api/bots", { headers: { Authorization: "Bearer test-debug-token" } })).statusCode,
      200
    );
    assert.equal(
      (
        await request(port, "/api/bots", {
          headers: {
            Authorization: "Bearer test-debug-token",
            Origin: "http://evil.example"
          }
        })
      ).statusCode,
      403
    );
    assert.equal(
      (
        await request(port, "/api/action/clear-history", {
          method: "POST",
          headers: {
            Authorization: "Bearer test-debug-token",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ payload: "x".repeat(1500) })
        })
      ).statusCode,
      413
    );

    const redactionBotId = "debug-redaction-bot";
    assert.equal(
      (
        await request(port, "/api/action/unknown-redaction-probe", {
          method: "POST",
          headers: {
            Authorization: "Bearer test-debug-token",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            botId: redactionBotId,
            nested: {
              apiKey: "redaction-debug-api-key-fixture",
              values: [{ accessToken: "redaction-debug-token-fixture" }]
            }
          })
        })
      ).statusCode,
      404
    );
    const debugSnapshot = await request(
      port,
      `/api/debug?botId=${encodeURIComponent(redactionBotId)}`,
      { headers: { Authorization: "Bearer test-debug-token" } }
    );
    assert.equal(debugSnapshot.statusCode, 200);
    const debugPayload = JSON.parse(debugSnapshot.body) as {
      actionHistory?: Array<{ payload?: Record<string, unknown> }>;
    };
    assert.deepEqual(debugPayload.actionHistory?.[0]?.payload, {
      botId: redactionBotId,
      nested: {
        apiKey: "[redacted]",
        values: [{ accessToken: "[redacted]" }]
      }
    });

    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = null;
    process.env.MCBOT_DEBUG_WEB_HOST = "0.0.0.0";
    delete process.env.MCBOT_DEBUG_WEB_AUTH_TOKEN;
    assert.equal(startDebugWebServer(new BotRegistry()), null);
  } finally {
    await new Promise<void>((resolve) => {
      if (!server) {
        resolve();
        return;
      }
      server.close(() => resolve());
    });
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
