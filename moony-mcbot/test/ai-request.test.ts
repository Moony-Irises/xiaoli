import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { fetchTextWithTimeout } from "../src/runtime/ai-request.js";

async function startHangingServer(): Promise<{ server: Server; url: string }> {
  const server = createServer(() => {
    // Keep the response open so the request helper must enforce cancellation.
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Test server did not expose a TCP address");
  }
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

test("fetchTextWithTimeout aborts a request that exceeds its timeout", async () => {
  const { server, url } = await startHangingServer();
  try {
    await assert.rejects(
      fetchTextWithTimeout(url, {}, { timeoutMs: 30 }),
      (error: unknown) => error instanceof Error && "kind" in error && error.kind === "timeout"
    );
  } finally {
    await closeServer(server);
  }
});

test("fetchTextWithTimeout respects an external abort signal", async () => {
  const { server, url } = await startHangingServer();
  const controller = new AbortController();
  try {
    const request = fetchTextWithTimeout(url, {}, { timeoutMs: 1000, signal: controller.signal });
    setTimeout(() => controller.abort(), 10);
    await assert.rejects(
      request,
      (error: unknown) => error instanceof Error && "kind" in error && error.kind === "cancelled"
    );
  } finally {
    await closeServer(server);
  }
});
