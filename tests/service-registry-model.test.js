import assert from "node:assert/strict";
import test from "node:test";
import { preparedServiceRegistry } from "../src/service-registry-model.js";

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
