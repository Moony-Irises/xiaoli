import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import test from "node:test";
import {
  buildOpenAiChatCompletionsEndpoint,
  postOpenAiChatCompletions
} from "../src/runtime/openai-compatible-client.js";

interface CapturedRequest {
  method: string | undefined;
  path: string | undefined;
  authorization: string | undefined;
  contentType: string | undefined;
  body: string;
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function startCaptureServer(
  status = 200,
  responseBody = '{"choices":[{"message":{"content":"ok"}}]}'
): Promise<{
  server: Server;
  baseUrl: string;
  request: Promise<CapturedRequest>;
}> {
  let resolveRequest: (request: CapturedRequest) => void = () => undefined;
  const captured = new Promise<CapturedRequest>((resolve) => {
    resolveRequest = resolve;
  });
  const server = createServer(async (request, response) => {
    resolveRequest({
      method: request.method,
      path: request.url,
      authorization: request.headers.authorization,
      contentType: request.headers["content-type"],
      body: await readRequestBody(request)
    });
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(responseBody);
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
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    request: captured
  };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

test("buildOpenAiChatCompletionsEndpoint preserves existing normalization rules", () => {
  assert.equal(buildOpenAiChatCompletionsEndpoint(""), "https://api.openai.com/v1/chat/completions");
  assert.equal(
    buildOpenAiChatCompletionsEndpoint("https://example.test/v1"),
    "https://example.test/v1/chat/completions"
  );
  assert.equal(
    buildOpenAiChatCompletionsEndpoint("https://example.test/api"),
    "https://example.test/api/v1/chat/completions"
  );
  assert.equal(
    buildOpenAiChatCompletionsEndpoint("https://example.test/v1/chat/completions/"),
    "https://example.test/v1/chat/completions"
  );
  assert.equal(buildOpenAiChatCompletionsEndpoint("relative-base"), "relative-base/chat/completions");
});

test("postOpenAiChatCompletions sends bearer-authenticated JSON and returns raw response", async () => {
  const { server, baseUrl, request } = await startCaptureServer();
  try {
    const body = {
      model: "test-model",
      messages: [{ role: "user", content: "hello" }]
    };
    const result = await postOpenAiChatCompletions({
      apiBaseUrl: `${baseUrl}/v1`,
      apiKey: "test-key",
      body,
      timeoutMs: 1000
    });
    const captured = await request;

    assert.equal(result.endpoint, `${baseUrl}/v1/chat/completions`);
    assert.equal(result.response.status, 200);
    assert.equal(result.rawBody, '{"choices":[{"message":{"content":"ok"}}]}');
    assert.deepEqual(captured, {
      method: "POST",
      path: "/v1/chat/completions",
      authorization: "Bearer test-key",
      contentType: "application/json",
      body: JSON.stringify(body)
    });
  } finally {
    await closeServer(server);
  }
});

test("postOpenAiChatCompletions leaves non-success response handling to the caller", async () => {
  const { server, baseUrl } = await startCaptureServer(429, '{"error":"rate limited"}');
  try {
    const result = await postOpenAiChatCompletions({
      apiBaseUrl: baseUrl,
      apiKey: "test-key",
      body: { model: "test-model", messages: [] },
      timeoutMs: 1000
    });

    assert.equal(result.response.status, 429);
    assert.equal(result.rawBody, '{"error":"rate limited"}');
  } finally {
    await closeServer(server);
  }
});
