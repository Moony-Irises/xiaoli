import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import test from "node:test";
import { AuthService } from "../src/services/auth-service.js";

interface CapturedAuthRequest {
  method: string | undefined;
  path: string | undefined;
  contentType: string | undefined;
  userAgent: string | undefined;
  body: string;
}

interface AuthRequestBody {
  agent: {
    name: string;
    version: number;
  };
  username: string;
  password: string;
  clientToken: string;
  requestUser: boolean;
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function startAuthServer(
  status: number,
  responseBody: string
): Promise<{
  server: Server;
  baseUrl: string;
  request: Promise<CapturedAuthRequest>;
}> {
  let resolveRequest: (request: CapturedAuthRequest) => void = () => undefined;
  const captured = new Promise<CapturedAuthRequest>((resolve) => {
    resolveRequest = resolve;
  });
  const server = createServer(async (request, response) => {
    resolveRequest({
      method: request.method,
      path: request.url,
      contentType: request.headers["content-type"],
      userAgent: request.headers["user-agent"],
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
    throw new Error("Auth test server did not expose a TCP address");
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

test("AuthService sends the expected Yggdrasil request and normalizes the profile id", async () => {
  const { server, baseUrl, request } = await startAuthServer(
    200,
    JSON.stringify({
      accessToken: "access-token",
      clientToken: "client-token",
      selectedProfile: {
        id: "12345678-1234-1234-1234-123456789abc",
        name: "TestBot"
      }
    })
  );

  try {
    const result = await new AuthService().authenticate(
      `${baseUrl}/`,
      "test@example.invalid",
      "fake-password",
      "auth-contract-test"
    );
    const captured = await request;
    const body = JSON.parse(captured.body) as AuthRequestBody;

    assert.equal(captured.method, "POST");
    assert.equal(captured.path, "/authserver/authenticate");
    assert.equal(captured.contentType, "application/json");
    assert.match(captured.userAgent ?? "", /^node-yggdrasil\//);
    assert.deepEqual(body.agent, { name: "Minecraft", version: 1 });
    assert.equal(body.username, "test@example.invalid");
    assert.equal(body.password, "fake-password");
    assert.match(
      body.clientToken,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    assert.equal(body.requestUser, false);
    assert.deepEqual(result, {
      accessToken: "access-token",
      clientToken: "client-token",
      selectedProfile: {
        id: "12345678123412341234123456789abc",
        name: "TestBot"
      }
    });
  } finally {
    await closeServer(server);
  }
});

test("AuthService rejects a successful response with missing profile fields", async () => {
  const { server, baseUrl } = await startAuthServer(
    200,
    JSON.stringify({
      accessToken: "access-token",
      clientToken: "client-token",
      selectedProfile: { id: "", name: "TestBot" }
    })
  );

  try {
    await assert.rejects(
      new AuthService().authenticate(
        baseUrl,
        "test@example.invalid",
        "fake-password",
        "auth-contract-test"
      ),
      /Authentication response missing required fields/
    );
  } finally {
    await closeServer(server);
  }
});

test("AuthService preserves the authentication server error message", async () => {
  const { server, baseUrl } = await startAuthServer(
    403,
    JSON.stringify({
      error: "ForbiddenOperationException",
      errorMessage: "Invalid credentials"
    })
  );

  try {
    await assert.rejects(
      new AuthService().authenticate(
        baseUrl,
        "test@example.invalid",
        "fake-password",
        "auth-contract-test"
      ),
      /Invalid credentials/
    );
  } finally {
    await closeServer(server);
  }
});
