import assert from "node:assert/strict";
import test from "node:test";
import {
  defineSurfaceAppContract,
  materializationBudgetLimit,
  requireSurfaceMaterializationBudget,
  requireSurfaceModuleRole,
  surfaceAppAttachContext,
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
