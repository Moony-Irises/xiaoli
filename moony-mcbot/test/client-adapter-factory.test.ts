import assert from "node:assert/strict";
import test from "node:test";
import { McClientService } from "../src/services/mc-client-service.js";
import {
  createClientAdapter,
  createDefaultClientAdapterFactory
} from "../src/runtime/client-adapter-factory.js";

test("adapter factory creates the Mineflayer adapter without connecting", () => {
  const adapter = createClientAdapter("mineflayer", {
    mcClientService: new McClientService()
  });

  assert.equal(adapter.kind, "mineflayer");
  assert.equal(adapter.getConnectionState().connected, false);
});

test("adapter factory fails explicitly for the unimplemented modded client", () => {
  assert.throws(
    () =>
      createClientAdapter("modded-client", {
        mcClientService: new McClientService()
      }),
    /modded-client.*not implemented/i
  );
});

test("default adapter factory captures Mineflayer dependencies without changing kind behavior", () => {
  const factory = createDefaultClientAdapterFactory({
    mcClientService: new McClientService()
  });

  assert.equal(factory.create("mineflayer").kind, "mineflayer");
  assert.throws(
    () => factory.create("modded-client"),
    /modded-client.*not implemented/i
  );
});
