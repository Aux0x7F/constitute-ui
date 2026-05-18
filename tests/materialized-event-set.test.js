import assert from "node:assert/strict";
import test from "node:test";
import { materializeEventSet } from "../src/materialized-event-set.js";

const budget = Object.freeze({
  kind: "materialization.budget",
  budgetId: "logging-ui.event-table",
  sourceAuthority: "runtime",
  consumerRef: "logging-ui",
  payloadClass: "projection",
  copyRole: "buffer",
  transferMode: "referenceOnly",
  privacyTier: "safeFacts",
  limits: {
    maxItems: 2,
    maxSourceItems: 3,
    maxSafeFactKeys: 8,
    maxLabelValues: 8,
  },
});

function event(id, severity = "info", ts = 1, facts = {}) {
  return {
    eventId: id,
    severity,
    occurredAt: ts,
    observedAt: ts + 1,
    schemaVersion: "v1",
    safeFacts: facts,
  };
}

test("materialized event set merges, caps, and reports materialization posture", () => {
  const result = materializeEventSet({
    existingEvents: [
      event("a", "info", 1, { first: true }),
      event("b", "warn", 2),
    ],
    incomingEvents: [
      event("a", "error", 3, { second: true }),
      event("c", "info", 4),
    ],
    budget,
    expectedSchemaVersion: "v1",
    floorId: "floor:logging-ui.event-table",
    consumerRef: "logging-ui.events",
    subjectRef: "logging.events",
    referenceRefs: ["logging-ui.events"],
    sampledAt: 10_000,
  });

  assert.deepEqual(result.events.map((entry) => entry.eventId), ["c", "a"]);
  assert.equal(result.merge.received, 2);
  assert.equal(result.merge.added, 1);
  assert.equal(result.merge.updated, 1);
  assert.equal(result.merge.dropped, 1);
  assert.equal(result.events[1].safeFacts.first, true);
  assert.equal(result.events[1].safeFacts.second, true);
  assert.equal(result.replayPosture.kind, "surface.event.replay.posture");
  assert.equal(result.consumerFloor.kind, "consumer.floor");
  assert.equal(result.enforcementPosture.kind, "surface.materialization.enforcement.posture");
  assert.equal(result.materializationBudget.state, "pressure");
  assert.equal(result.materializationBudget.limits.droppedCount, 1);
});

test("materialized event set replace reports removed entries and schema pressure", () => {
  const result = materializeEventSet({
    existingEvents: [
      event("a", "info", 1),
      event("b", "warn", 2),
    ],
    incomingEvents: [
      event("b", "warn", 3),
    ],
    sourceEvents: [
      event("b", "warn", 3),
    ],
    replace: true,
    budget,
    schemaVersion: () => "v2",
    expectedSchemaVersion: "v1",
    sampledAt: 10_000,
  });

  assert.deepEqual(result.events.map((entry) => entry.eventId), ["b"]);
  assert.equal(result.merge.removed, 1);
  assert.equal(result.replayPosture.schema.state, "quarantined");
  assert.equal(result.enforcementPosture.state, "blocked");
  assert(result.enforcementPosture.blockedReasons.includes("schemaPostureQuarantined"));
});
