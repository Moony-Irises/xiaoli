import assert from "node:assert/strict";
import test from "node:test";
import { ClientMovementEvent } from "../src/runtime/client-adapter.js";
import { getCurrentMovementFailure } from "../src/runtime/movement-event-routing.js";

const event: ClientMovementEvent = {
  type: "movement_failed",
  movementId: "follow:42:current",
  action: "pursue_entity",
  reason: "no_path",
  detail: "safe path no_path: continuous route is unavailable or unsafe"
};

test("movement event routing accepts only the current correlated action", () => {
  assert.equal(getCurrentMovementFailure(event, "follow:42:current", "pursue_entity"), event);
  assert.equal(getCurrentMovementFailure(event, "follow:42:old", "pursue_entity"), null);
  assert.equal(getCurrentMovementFailure(event, "follow:42:current", "move_to_position"), null);
  assert.equal(getCurrentMovementFailure(event, undefined, "pursue_entity"), null);
});
