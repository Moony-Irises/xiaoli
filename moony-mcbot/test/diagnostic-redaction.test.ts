import assert from "node:assert/strict";
import test from "node:test";
import {
  projectDiagnosticValue,
  redactDiagnosticText
} from "../src/utils/diagnostic-redaction.js";

test("projectDiagnosticValue recursively redacts secrets without mutating input", () => {
  const input = {
    safe: "visible",
    nested: {
      plannerApiKey: "redaction-api-key-fixture",
      values: [
        {
          accessToken: "redaction-access-token-fixture",
          keyboardLayout: "us"
        }
      ]
    }
  };

  const projected = projectDiagnosticValue(input);

  assert.deepEqual(projected, {
    safe: "visible",
    nested: {
      plannerApiKey: "[redacted]",
      values: [
        {
          accessToken: "[redacted]",
          keyboardLayout: "us"
        }
      ]
    }
  });
  assert.equal(input.nested.plannerApiKey, "redaction-api-key-fixture");
  assert.notEqual(projected, input);
});

test("redactDiagnosticText masks assignments and bearer credentials", () => {
  const projected = redactDiagnosticText(
    'password=redaction-password-fixture, "clientToken":"redaction-token-fixture", Bearer redaction-bearer-fixture, Authorization: Bearer redaction-authorization-fixture, monkey=safe'
  );

  assert.doesNotMatch(
    projected,
    /redaction-password-fixture|redaction-token-fixture|redaction-bearer-fixture|redaction-authorization-fixture/
  );
  assert.match(projected, /password=\[redacted\]/);
  assert.match(projected, /"clientToken":"\[redacted\]"/);
  assert.match(projected, /Bearer \[redacted\]/);
  assert.match(projected, /monkey=safe/);
});

test("projectDiagnosticValue handles cycles and can clone without redaction", () => {
  const cyclic: Record<string, unknown> = {
    apiKey: "redaction-cycle-fixture"
  };
  cyclic.self = cyclic;

  assert.deepEqual(projectDiagnosticValue(cyclic), {
    apiKey: "[redacted]",
    self: "[circular]"
  });
  assert.deepEqual(projectDiagnosticValue(cyclic, { redactSecrets: false }), {
    apiKey: "redaction-cycle-fixture",
    self: "[circular]"
  });
});
