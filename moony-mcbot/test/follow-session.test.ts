import assert from "node:assert/strict";
import test from "node:test";
import { decideFollowMovement, getFollowPursuitFailure } from "../src/runtime/follow-session.js";
import { SafePathError } from "../src/runtime/mining-approach.js";

const config = {
  minDistance: 2.5,
  maxDistance: 24
};

test("decideFollowMovement separates missing, out-of-range, approach, and hold states", () => {
  assert.equal(decideFollowMovement(config, { targetVisible: false }), "search");
  assert.equal(decideFollowMovement(config, { targetVisible: true }), "search");
  assert.equal(decideFollowMovement(config, { targetVisible: true, horizontalDistance: Number.NaN }), "search");
  assert.equal(decideFollowMovement(config, { targetVisible: true, horizontalDistance: -1 }), "search");
  assert.equal(decideFollowMovement(config, { targetVisible: true, horizontalDistance: 24.01 }), "out_of_range");
  assert.equal(decideFollowMovement(config, { targetVisible: true, horizontalDistance: 24 }), "approach");
  assert.equal(decideFollowMovement(config, { targetVisible: true, horizontalDistance: 2.51 }), "approach");
  assert.equal(decideFollowMovement(config, { targetVisible: true, horizontalDistance: 2.5 }), "hold");
  assert.equal(decideFollowMovement(config, { targetVisible: true, horizontalDistance: 0 }), "hold");
});

test("decideFollowMovement rejects invalid distance configuration", () => {
  assert.throws(() => decideFollowMovement({ minDistance: 0, maxDistance: 24 }, {
    targetVisible: true,
    horizontalDistance: 3
  }), /minDistance/);
  assert.throws(() => decideFollowMovement({ minDistance: 5, maxDistance: 4 }, {
    targetVisible: true,
    horizontalDistance: 3
  }), /maxDistance/);
});

test("follow pursuit failure maps only safe path errors to one player-facing report", () => {
  assert.deepEqual(getFollowPursuitFailure(new SafePathError("no_path", "initial route failed")), {
    detail: "cannot safely follow (no_path)",
    chatMessage: "我跟不上你啦"
  });
  assert.deepEqual(getFollowPursuitFailure(new SafePathError("detour_too_long", "initial route failed")), {
    detail: "cannot safely follow (detour_too_long)",
    chatMessage: "我跟不上你啦"
  });
  assert.deepEqual(getFollowPursuitFailure(new SafePathError("pathfinder_unavailable", "setup failed")), {
    detail: "cannot safely follow (pathfinder_unavailable)",
    chatMessage: "我跟不上你啦"
  });
  assert.equal(getFollowPursuitFailure(new Error("temporary entity lookup failed")), null);
});
