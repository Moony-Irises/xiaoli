import assert from "node:assert/strict";
import test from "node:test";
import { selectFocusedEntity } from "../src/runtime/focus-perception.js";

const observer = {
  position: { x: 0, y: 64, z: 0 },
  eyeHeight: 1.62,
  yaw: 0,
  pitch: 0
};

test("selectFocusedEntity selects an entity near the center of view", () => {
  const candidate = { id: 1, position: { x: 0, y: 64, z: -4 } };

  assert.equal(selectFocusedEntity(observer, [candidate], 6), candidate);
});

test("selectFocusedEntity excludes entities outside the view cone or reach", () => {
  const sideCandidate = { id: 1, position: { x: 4, y: 64, z: 0 } };
  const distantCandidate = { id: 2, position: { x: 0, y: 64, z: -8 } };

  assert.equal(selectFocusedEntity(observer, [sideCandidate, distantCandidate], 6), null);
});

test("selectFocusedEntity does not select an entity hidden behind a closer cursor block", () => {
  const candidate = { id: 1, position: { x: 0, y: 64, z: -4 } };

  assert.equal(selectFocusedEntity(observer, [candidate], 6, 2), null);
  assert.equal(selectFocusedEntity(observer, [candidate], 6, 3.5), candidate);
});

test("selectFocusedEntity chooses the candidate with the best view score", () => {
  const offsetCandidate = { id: 1, position: { x: 0.45, y: 64, z: -4 } };
  const centeredCandidate = { id: 2, position: { x: 0, y: 64, z: -4.5 } };

  assert.equal(
    selectFocusedEntity(observer, [offsetCandidate, centeredCandidate], 6),
    centeredCandidate
  );
});

test("selectFocusedEntity ignores malformed non-finite positions", () => {
  const malformedCandidate = { id: 1, position: { x: Number.NaN, y: 64, z: -2 } };

  assert.equal(selectFocusedEntity(observer, [malformedCandidate], 6), null);
});
