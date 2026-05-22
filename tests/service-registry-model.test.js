import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareServiceHostFabricPosture,
  prepareServiceLaunchPosture,
  preparedServiceRegistry,
} from "../src/service-registry-model.js";

test("service registry helper prefers materialized registry posture", () => {
  const registry = preparedServiceRegistry({
    serviceCatalog: {
      updatedAt: 1710000000000,
      services: [{ service: "legacy", servicePk: "legacy-pk" }],
      registry: {
        kind: "service.registry.materialization",
        registryId: "service-registry:runtime",
        state: "ready",
        issuedAt: 1710000000100,
        claimRefs: ["claim:nvr"],
        participantRefs: ["gateway-pk"],
        entries: [{ memberPk: "gateway-pk" }],
        services: [{
          service: "nvr",
          servicePk: "nvr-pk",
          hostGatewayPk: "gateway-pk",
          label: "Security Cameras",
          health: { status: "ready" },
        }],
      },
    },
  });

  assert.equal(registry.source, "serviceRegistry");
  assert.equal(registry.state, "ready");
  assert.equal(registry.serviceCount, 1);
  assert.equal(registry.claimCount, 1);
  assert.equal(registry.entryCount, 1);
  assert.equal(registry.services[0].service, "nvr");
  assert.equal(registry.services[0].__registrySource, "serviceRegistry");
});

test("service registry helper falls back to plain catalog services", () => {
  const registry = preparedServiceRegistry({
    serviceCatalog: {
      updatedAt: 1710000000000,
      services: [{
        service: "logging",
        servicePk: "logging-pk",
        hostGatewayPk: "gateway-pk",
      }],
    },
  });

  assert.equal(registry.source, "serviceCatalog");
  assert.equal(registry.state, "ready");
  assert.equal(registry.serviceCount, 1);
  assert.equal(registry.services[0].service, "logging");
});

test("service registry helper carries materialization posture", () => {
  const registry = preparedServiceRegistry({
    serviceCatalog: {
      services: [{ service: "gateway", servicePk: "gateway-pk" }],
    },
    runtimeEvents: [{ eventId: "runtime-event-a" }],
  }, {
    clientId: "gateway-ui",
    surface: "constitute-gateway-ui",
    materializationBudget: {
      kind: "materialization.budget",
      budgetId: "budget:gateway-ui:runtime-snapshot",
      state: "withinBudget",
      payloadClass: "projection",
      copyRole: "projection",
      privacyTier: "safeProjection",
      limits: { replayLimit: 1, estimatedSnapshotBytes: 1024 },
      consumerFloor: {
        kind: "consumer.floor",
        floorId: "floor:gateway-ui:runtime-snapshot",
        lagState: "current",
      },
    },
  });

  assert.equal(registry.materializationPosture.kind, "runtime.materialization.posture");
  assert.equal(registry.materializationPosture.state, "withinBudget");
  assert.equal(registry.materializationPosture.budgetId, "budget:gateway-ui:runtime-snapshot");
  assert.equal(registry.materializationPosture.consumerFloorId, "floor:gateway-ui:runtime-snapshot");
});

test("service host-fabric helper prepares shared launch posture", () => {
  const fabric = prepareServiceHostFabricPosture({
    state: "ready",
    associationHandoffRef: "handoff:gateway:abcdef1234567890:initial-owner",
    blockedReasons: [],
  });

  assert.equal(fabric.kind, "service.host-fabric.read-model");
  assert.equal(fabric.ready, true);
  assert.equal(fabric.blocked, false);
  assert.equal(fabric.handoffRef, "handoff:gateway:abcdef1234567890:initial-owner");
  assert.equal(fabric.label.includes("ready"), true);

  const launch = prepareServiceLaunchPosture({
    __source: "serviceRegistry",
    hostFabric: fabric,
  });

  assert.equal(launch.kind, "service.launch.read-model");
  assert.equal(launch.ready, true);
  assert.equal(launch.state, "ready");
});

test("service launch helper blocks legacy and non-registry sources", () => {
  assert.equal(prepareServiceLaunchPosture({
    __source: "browserStorageCache",
    hostFabric: { state: "ready", blockedReasons: [] },
  }).reason, "service is projected from browserStorageCache, not service registry");

  assert.equal(prepareServiceLaunchPosture({
    __source: "serviceRegistry",
    hostFabric: { state: "ready", blockedReasons: [] },
    legacyPathFallback: {
      reason: "retained hosted-service cache used",
    },
  }).reason, "retained hosted-service cache used");

  assert.equal(prepareServiceLaunchPosture({
    __source: "serviceRegistry",
    hostFabric: { state: "blocked", blockedReasons: ["association missing"] },
  }).reason, "association missing");
});
