import assert from "node:assert/strict";
import test from "node:test";
import {
  defineSurfaceAppContract,
  materializationBudgetRecord,
  materializationEventReplayPosture,
  materializationBudgetLimit,
  materializationBudgetUsage,
  materializationConsumerFloorRecord,
  requireSurfaceMaterializationBudget,
  requireSurfaceModuleRole,
  surfaceAppAttachContext,
  surfaceAppBootstrapPosture,
  surfaceAppContractPosture,
  surfaceMaterializationBudgetPosture,
  surfaceModuleRolePosture,
} from "../src/surface-app-contract.js";

function makeContract(overrides = {}) {
  return {
    contractId: "surface-app:logging-ui",
    appId: "constitute-logging-ui",
    version: "0.1.0",
    displayName: "Logging",
    requiredModuleRoles: ["runtimeClient", "projectionModel", "productView"],
    modules: [
      {
        moduleRef: "constitute-ui/runtime-surface-client@0.1.0",
        role: "runtimeClient",
        participantSide: "window",
        fulfillmentMode: "bundled",
        version: "0.1.0",
        primitiveRefs: ["runtime.attach"],
      },
      {
        moduleRef: "constitute-logging-ui/projection-model@0.1.0",
        role: "projectionModel",
        participantSide: "window",
        fulfillmentMode: "bundled",
        version: "0.1.0",
        primitiveRefs: ["projection.materialization"],
      },
      {
        moduleRef: "constitute-logging-ui/product-view@0.1.0",
        role: "productView",
        participantSide: "window",
        fulfillmentMode: "bundled",
        version: "0.1.0",
        primitiveRefs: ["runtime.posture.render"],
      },
    ],
    materializationBudgets: [
      {
        kind: "materialization.budget",
        budgetId: "logging-ui.event-table",
        payloadClass: "projection",
        copyRole: "projection",
        transferMode: "referenceOnly",
        limits: { maxItems: 2500 },
      },
    ],
    issuedAt: 1700000000,
    ...overrides,
  };
}

test("surface app helper indexes modules and emits attach context", () => {
  let validated = 0;
  const surfaceApp = defineSurfaceAppContract(makeContract(), {
    validate(contract) {
      validated += 1;
      return contract;
    },
  });

  assert.equal(validated, 1);
  assert.equal(surfaceApp.posture.state, "ready");
  assert.equal(surfaceApp.hasRole("runtimeClient"), true);
  assert.equal(surfaceApp.moduleForRole("runtimeClient").moduleRef, "constitute-ui/runtime-surface-client@0.1.0");
  assert.equal(surfaceApp.modulesForRole("productView").length, 1);

  const attachContext = surfaceAppAttachContext(surfaceApp, { clientId: "logging-ui" });
  assert.equal(attachContext.kind, "surface.app.attachContext");
  assert.equal(attachContext.appId, "constitute-logging-ui");
  assert.equal(attachContext.clientId, "logging-ui");
  assert.deepEqual(attachContext.requiredModuleRoles, ["runtimeClient", "projectionModel", "productView"]);
  assert.equal(attachContext.moduleRefs.length, 3);
  assert.deepEqual(attachContext.materializationBudgetRefs, ["logging-ui.event-table"]);
});

test("surface app helper reports missing required module roles", () => {
  const contract = makeContract({
    modules: makeContract().modules.filter((module) => module.role !== "projectionModel"),
  });
  const posture = surfaceAppContractPosture(contract);
  assert.equal(posture.state, "blocked");
  assert.equal(posture.blockedReason, "missingModuleRole");
  assert.deepEqual(posture.missingRoles, ["projectionModel"]);
});

test("surface app helper reduces bootstrap posture from service manager and release contracts", () => {
  const surfaceApp = defineSurfaceAppContract(makeContract({
    bootstrapPosture: {
      bootstrapId: "bootstrap:logging-ui",
      state: "ready",
      sourceMode: "bundled",
      evidenceRefs: ["build:logging-ui:local"],
    },
    serviceManagerPosture: {
      managerId: "manager:logging-local",
      state: "ready",
      evidenceRefs: ["host:manual"],
    },
    secretBoundary: { state: "notRequired" },
    releasePosture: { state: "static" },
  }));
  const posture = surfaceAppBootstrapPosture(surfaceApp, { issuedAt: 1234 });

  assert.equal(posture.kind, "surface.app.bootstrap.posture");
  assert.equal(posture.state, "ready");
  assert.equal(posture.sourceMode, "bundled");
  assert.equal(posture.serviceManagerRef, "manager:logging-local");
  assert.equal(posture.moduleRefs.length, 3);
  assert.deepEqual(posture.blockedReasons, []);
  assert.deepEqual(posture.evidenceRefs, ["build:logging-ui:local", "host:manual"]);

  const blocked = surfaceAppBootstrapPosture(makeContract({
    modules: makeContract().modules.filter((module) => module.role !== "projectionModel"),
    serviceManagerPosture: {
      managerId: "manager:blocked",
      state: "blocked",
      blockedReasons: ["missingRollback"],
    },
    releasePosture: {
      state: "blocked",
      blockedReasons: ["missingBuild"],
    },
  }));
  assert.equal(blocked.state, "blocked");
  assert.deepEqual(blocked.blockedReasons, [
    "missingModuleRole:projectionModel",
    "serviceManager:missingRollback",
    "release:missingBuild",
  ]);
});

test("surface app helper gates bundled module roles by contract", () => {
  const surfaceApp = defineSurfaceAppContract(makeContract());
  const posture = surfaceModuleRolePosture(surfaceApp, "runtimeClient", {
    moduleRef: "constitute-ui/runtime-surface-client@0.1.0",
    primitiveRef: "runtime.attach",
  });

  assert.equal(posture.state, "ready");
  assert.equal(posture.moduleCount, 1);
  assert.equal(requireSurfaceModuleRole(surfaceApp, "runtimeClient", {
    moduleRef: "constitute-ui/runtime-surface-client@0.1.0",
  }).role, "runtimeClient");

  const missing = surfaceModuleRolePosture(surfaceApp, "platformAdapter");
  assert.equal(missing.state, "blocked");
  assert.equal(missing.blockedReason, "missingModuleRole");
  assert.throws(
    () => requireSurfaceModuleRole(surfaceApp, "runtimeClient", { moduleRef: "missing/module@0.1.0" }),
    /missingModuleRef/
  );
});

test("surface app helper gates materialization budgets by contract", () => {
  const surfaceApp = defineSurfaceAppContract(makeContract());
  const posture = surfaceMaterializationBudgetPosture(surfaceApp, "logging-ui.event-table", {
    payloadClass: "projection",
    copyRole: "projection",
    transferMode: "referenceOnly",
  });

  assert.equal(posture.state, "ready");
  assert.equal(posture.budget?.budgetId, "logging-ui.event-table");
  assert.equal(materializationBudgetLimit(posture.budget, "maxItems", 0), 2500);
  assert.equal(requireSurfaceMaterializationBudget(surfaceApp, "logging-ui.event-table").budgetId, "logging-ui.event-table");

  assert.equal(
    surfaceMaterializationBudgetPosture(surfaceApp, "logging-ui.event-table", { payloadClass: "media" }).blockedReason,
    "payloadClassMismatch",
  );
  assert.throws(
    () => requireSurfaceMaterializationBudget(surfaceApp, "missing-budget"),
    /missingMaterializationBudget/,
  );
});

test("surface app helper reduces materialization budget usage and consumer floors", () => {
  const surfaceApp = defineSurfaceAppContract(makeContract());
  const budget = requireSurfaceMaterializationBudget(surfaceApp, "logging-ui.event-table");
  const usage = materializationBudgetUsage(budget, {
    sourceCount: 3000,
    materializedCount: 2500,
    blockedReason: "eventTablePressure",
    sampledAt: 1234,
  });

  assert.equal(usage.state, "pressure");
  assert.equal(usage.overBudget, true);
  assert.deepEqual(usage.blockedReasons, ["eventTablePressure"]);

  const floor = materializationConsumerFloorRecord(budget, {
    consumerRef: "logging-ui.events-view",
    subjectRef: "logging.events.ui-table",
    sourceCount: 3000,
    materializedCount: 2500,
    cursor: "event-1",
    sampledAt: 1234,
  });
  assert.equal(floor.kind, "consumer.floor");
  assert.equal(floor.lagState, "lagging");
  assert.equal(floor.ackFloor, "2500");
  assert.equal(floor.compactionFloor, "2500");

  const record = materializationBudgetRecord(budget, {
    sourceCount: 12,
    materializedCount: 8,
    limits: { renderedCount: 8 },
    consumerFloor: floor,
    sampledAt: 1234,
  });
  assert.equal(record.kind, "materialization.budget");
  assert.equal(record.state, "withinBudget");
  assert.equal(record.limits.sourceCount, 12);
  assert.equal(record.limits.renderedCount, 8);
  assert.equal(record.consumerFloor, floor);
});

test("surface app helper reduces event replay privacy and bitemporal posture", () => {
  const surfaceApp = defineSurfaceAppContract(makeContract({
    materializationBudgets: [
      {
        kind: "materialization.budget",
        budgetId: "logging-ui.event-table",
        payloadClass: "projection",
        copyRole: "referenceOnly",
        transferMode: "referenceOnly",
        consumerRef: "logging-ui.events-view",
        limits: {
          maxItems: 2,
          maxSourceItems: 2,
          maxSafeFactKeys: 2,
          maxLabelValues: 1,
          maxEncryptedDetailRefs: 2,
        },
      },
    ],
  }));
  const budget = requireSurfaceMaterializationBudget(surfaceApp, "logging-ui.event-table");
  const posture = materializationEventReplayPosture(budget, {
    sourceEvents: [
      {
        eventId: "event-1",
        schemaVersion: 1,
        occurredAt: 1700000000,
        observedAt: 1700000001000,
        tags: ["route"],
        safeFacts: { route: "ok" },
      },
      {
        eventId: "event-2",
        schemaVersion: 2,
        occurredAt: 1700000010,
        observedAt: 1700000011000,
        tags: ["route", "diagnostic"],
        safeFacts: { route: "ok", extra: true },
        encryptedDetailRefs: [{ objectId: "detail-1" }],
      },
    ],
    materializedEvents: [
      {
        eventId: "event-2",
        schemaVersion: 2,
        occurredAt: 1700000010,
        observedAt: 1700000011000,
        tags: ["route", "diagnostic"],
        safeFacts: { route: "ok", extra: true },
        encryptedDetailRefs: [{ objectId: "detail-1" }],
      },
    ],
    expectedSchemaVersion: 1,
    sampledAt: 1700000020000,
  });

  assert.equal(posture.kind, "surface.event.replay.posture");
  assert.equal(posture.state, "blocked");
  assert.equal(posture.schema.state, "quarantined");
  assert.equal(posture.schema.unsupportedCount, 1);
  assert.deepEqual(posture.privacy.tiers, ["safeFacts", "encryptedDetail"]);
  assert.equal(posture.cardinality.state, "pressure");
  assert.equal(posture.bitemporal.eventTimeFloor, 1700000010000);
  assert.equal(posture.bitemporal.observedTimeFloor, 1700000011000);
  assert.equal(posture.consumerFloor.kind, "consumer.floor");
  assert.equal(posture.consumerFloor.lagState, "caughtUp");
  assert.deepEqual(posture.blockedReasons, ["schemaPostureQuarantined", "labelCardinalityPressure"]);
});
