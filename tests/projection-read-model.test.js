import test from "node:test";
import assert from "node:assert/strict";
import {
  projectionCoverage,
  projectionDeltaFor,
  projectionForNode,
  projectionNodePath,
  projectionPostureSummary,
  projectionRepairFor,
  projectionRuntimeKey,
  selectProjectionForNode,
} from "../src/projection-read-model.js";

test("projection read model selects exact policy before latest fallback", () => {
  const projections = {
    old: {
      channelId: "logging.events",
      payload: { nodePath: "events", policy: { policyId: "old" } },
      retainedAt: 10,
    },
    latest: {
      channelId: "logging.events",
      payload: { nodePath: "events", policy: { policyId: "latest" } },
      retainedAt: 30,
    },
    exact: {
      projectionId: "logging.events.exact",
      channelId: "logging.events",
      payload: { nodePath: "events", policy: { policyId: "target" } },
      retainedAt: 20,
    },
  };
  const selected = selectProjectionForNode(projections, "events", {
    policyId: "target",
    channelMap: { events: "logging.events" },
  });
  assert.equal(selected.examined, 3);
  assert.equal(selected.matched, 3);
  assert.equal(selected.projection?.projectionId, "logging.events.exact");
  assert.equal(
    projectionForNode(projections, "events", { channelMap: { events: "logging.events" } })?.payload?.policy?.policyId,
    "latest",
  );
});

test("projection helpers normalize node, key, delta, repair, coverage, and summary posture", () => {
  const projection = {
    projectionId: "nvr.streams",
    channelId: "nvr.streams",
    payload: {
      coverage: { materializedCount: 2, targetCount: 4, syncState: "syncing" },
      delta: { projectionId: "nvr.streams", revision: 7 },
    },
    cursor: { updatedAt: 44 },
  };
  assert.equal(projectionNodePath(projection, { channelMap: { streams: "nvr.streams" } }), "streams");
  assert.equal(projectionRuntimeKey(projection), "nvr.streams");
  assert.equal(projectionDeltaFor(projection)?.revision, 7);
  assert.equal(projectionCoverage(projection).completionRatio, 0.5);
  assert.equal(projectionRepairFor(projection, {
    nodePath: "streams",
    channelMap: { streams: "nvr.streams" },
    repairRequests: [{ repairRequest: { projectionId: "nvr.streams", targetRevision: 8 } }],
  })?.targetRevision, 8);
  assert.deepEqual(projectionPostureSummary({
    projections: { streams: projection },
    projectionCoverage: { streams: { syncState: "syncing" } },
  }), {
    projectionCount: 1,
    coverageCount: 1,
    coverageCounts: { syncing: 1 },
    stateLabel: "syncing 1",
  });
});
