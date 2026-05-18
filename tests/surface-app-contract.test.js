import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRunnerOperation,
  assertServiceManagerOperationPosture,
  assertSurfaceAppAuthorityAccessPosture,
  assertSurfaceAppFulfillmentIdentityPosture,
  assertSurfaceAppInstancePosture,
  assertSurfaceAppManifestRunnerPlan,
  assertSurfaceAppManifestSelection,
  assertSurfaceAppRuntimeSelectionPosture,
  assertSurfaceAppRunnerPlan,
} from "../../constitute-protocol/src/index.js";
import {
  SURFACE_ADAPTER_TAXONOMY,
  defineSurfaceAppContract,
  materializationBudgetRecord,
  materializationEnforcementPosture,
  materializationEventReplayPosture,
  materializationBudgetLimit,
  materializationBudgetUsage,
  materializationConsumerFloorRecord,
  requireSurfaceMaterializationBudget,
  requireSurfaceModuleRole,
  surfaceAppBootstrapContract,
  surfaceAppAttachContext,
  surfaceAppAuthorityAccessPosture,
  surfaceAppBootstrapPosture,
  surfaceAppContractPosture,
  surfaceAppFulfillmentIdentityPosture,
  surfaceAppInstancePosture,
  surfaceAppManifestSelection,
  surfaceAppRuntimeSelectionPosture,
  surfaceAppRunnerPlan,
  surfaceAppRunnerPlanFromManifest,
  surfaceMaterializationBudgetPosture,
  surfaceServiceManagerLabProof,
  surfaceServiceManagerOperationPosture,
  surfaceServiceManagerProofDigest,
  surfaceRunnerOperation,
  surfaceServiceManagerReleaseContract,
  surfaceServiceManagerSecretBoundary,
  surfaceServiceManagerTrainDigest,
  surfaceAdapterTaxonomyPosture,
  surfaceModuleRolePosture,
  surfaceModuleTaxonomyPosture,
} from "../src/surface-app-contract.js";
import { surfaceAppSelectionReadModel } from "../src/surface-selection-read-model.js";
import { createSurfaceModuleRegistry } from "../src/surface-module-registry.js";

const RESOLVED_RUNNER_REF = "4a29ff60c5c3837e9e20555bfeb2a046be3eb140818144628691fcf7efb1d2f1";

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

test("surface app helper reduces service manager operation and proof digest posture", () => {
  const surfaceApp = defineSurfaceAppContract(makeContract({
    serviceRef: "service:logging",
    appRef: "surface-app:logging-ui",
    surfaceRef: "surface:logging-ui",
    serviceManagerPosture: {
      managerId: "manager:logging-local",
      managerRef: "member:logging-manager",
      runnerRef: RESOLVED_RUNNER_REF,
      hostRef: "host:operator-lab",
      state: "ready",
      serviceRefs: ["service:logging"],
      capabilityRefs: ["service.manage"],
      grantRefs: ["authority-grant:service-manager:logging"],
      resourceBudget: { maxMemoryMiB: 256, maxCpuPct: 25 },
      evidenceRefs: ["host:manual"],
    },
    releasePosture: {
      state: "releaseReady",
      releaseRef: "release:logging-ui:local",
      rollbackRef: "rollback:logging-ui:previous",
      evidenceRefs: ["build:logging-ui:local"],
    },
    secretBoundary: {
      state: "notRequired",
    },
  }));
  const operation = surfaceServiceManagerOperationPosture(surfaceApp, {
    operation: "promote",
    operationId: "operation:logging-ui:promote",
    requesterRef: "identity:operator",
    state: "succeeded",
    proofRefs: ["proof:logging-ui:browser"],
    requestedAt: 1234,
    completedAt: 1240,
  });

  assert.equal(operation.kind, "service.manager.operation.posture");
  assert.equal(operation.state, "succeeded");
  assert.equal(operation.subjectRef, "service:logging");
  assert.equal(operation.managerRef, "member:logging-manager");
  assert.equal(operation.releaseRef, "release:logging-ui:local");
  assert.equal(operation.runnerRef, RESOLVED_RUNNER_REF);
  assert.equal(operation.hostRef, "host:operator-lab");
  assert.deepEqual(operation.grantRefs, ["authority-grant:service-manager:logging"]);
  assert.deepEqual(operation.resourceBudget, { maxMemoryMiB: 256, maxCpuPct: 25 });
  assert.deepEqual(operation.blockedReasons, []);
  assert.deepEqual(operation.evidenceRefs, ["host:manual", "build:logging-ui:local"]);
  assert.equal(assertServiceManagerOperationPosture(operation), operation);

  const digest = surfaceServiceManagerProofDigest(surfaceApp, {
    operationPosture: operation,
    state: "proved",
    digestId: "proof-digest:logging-ui:promote",
    artifactRefs: ["artifact:browser-smoke"],
    proofRefs: ["proof:logging-ui:browser"],
    metricsRefs: ["metrics:logging-ui"],
    observedAt: 1250,
  });
  assert.equal(digest.kind, "service.manager.proof.digest");
  assert.equal(digest.state, "proved");
  assert.equal(digest.operationId, operation.operationId);
  assert.deepEqual(digest.serviceRefs, ["service:logging"]);

  const blockedRollback = surfaceServiceManagerOperationPosture(surfaceApp, {
    operation: "rollback",
    requestedAt: 1234,
    releasePosture: { state: "releaseReady" },
  });
  assert.equal(blockedRollback.state, "blocked");
  assert.deepEqual(blockedRollback.blockedReasons, ["missingRollbackRef"]);

  const blockedDigest = surfaceServiceManagerProofDigest(surfaceApp, {
    operationPosture: operation,
    state: "proved",
    observedAt: 1250,
  });
  assert.equal(blockedDigest.state, "blocked");
  assert.deepEqual(blockedDigest.blockedReasons, ["missingProofRefs"]);
});

test("surface app helper composes execution-bound runner operations", () => {
  const surfaceApp = defineSurfaceAppContract(makeContract({
    serviceRef: "service:logging",
    serviceContractRef: "service:logging",
    serviceRouteRefs: ["route:service:logging"],
    appRef: "surface-app:logging-ui",
    surfaceRef: "surface:logging-ui",
    serviceManagerPosture: {
      managerId: "manager:logging-local",
      managerRef: "member:logging-manager",
      runnerId: "runner:logging-local",
      runnerRef: RESOLVED_RUNNER_REF,
      hostRef: "host:operator-lab",
      state: "ready",
      serviceRefs: ["service:logging"],
      capabilityRefs: ["service.manage"],
      grantRefs: ["authority-grant:service-manager:logging"],
      resourceBudget: { maxMemoryMiB: 256, maxCpuPct: 25 },
      evidenceRefs: ["host:manual"],
    },
    releasePosture: {
      state: "releaseReady",
      releaseRef: "release:logging-ui:local",
      rollbackRef: "rollback:logging-ui:previous",
      evidenceRefs: ["build:logging-ui:local"],
    },
    secretBoundary: {
      state: "notRequired",
    },
  }));
  const operationPosture = surfaceServiceManagerOperationPosture(surfaceApp, {
    operation: "healthCheck",
    operationId: "operation:logging-ui:health",
    requesterRef: "identity:operator",
    state: "accepted",
    requestedAt: 1234,
    acceptedAt: 1235,
  });
  const runnerOperation = surfaceRunnerOperation(surfaceApp, {
    operationPosture,
    inputRefs: ["surface-app:logging-ui@0.1.0"],
    outputRefs: ["proof:logging-ui:health"],
    requestedAt: 1234,
  });

  assert.equal(runnerOperation.kind, "runner.operation");
  assert.equal(runnerOperation.operation, "healthCheck");
  assert.equal(runnerOperation.state, "accepted");
  assert.equal(runnerOperation.runnerRef, RESOLVED_RUNNER_REF);
  assert.equal(runnerOperation.hostRef, "host:operator-lab");
  assert.deepEqual(runnerOperation.grantRefs, ["authority-grant:service-manager:logging"]);
  assert.deepEqual(runnerOperation.resourceBudget, { maxMemoryMiB: 256, maxCpuPct: 25 });
  assert.equal(assertRunnerOperation(runnerOperation), runnerOperation);

  assert.throws(() => surfaceRunnerOperation(surfaceApp, {
    operationPosture,
    runnerRef: "member:unresolved",
    grantRefs: ["authority-grant:service-manager:logging"],
    resourceBudget: { maxMemoryMiB: 256 },
  }), /requires resolved member ref/);

  const noGrantSurfaceApp = defineSurfaceAppContract(makeContract({
    serviceManagerPosture: {
      managerId: "manager:logging-local",
      runnerRef: RESOLVED_RUNNER_REF,
      state: "ready",
      resourceBudget: { maxMemoryMiB: 256 },
    },
  }));
  assert.throws(() => surfaceRunnerOperation(noGrantSurfaceApp, {
    resourceBudget: { maxMemoryMiB: 256 },
  }), /requires grantRefs/);
});

test("surface app helper separates app, service, host, runner, and route identity", () => {
  const surfaceApp = defineSurfaceAppContract(makeContract({
    serviceContractRef: "service:logging",
    serviceRef: "service:logging",
    serviceRouteRefs: ["route:service:logging"],
    hostRefs: ["host:operator-lab"],
    rootRefs: ["root:aux"],
    deviceRefs: ["device:aux-browser"],
    grantRefs: ["grant:app:logging-ui:run"],
    accessGroupRefs: ["access-group:logging-ui:events"],
    requiredContentClasses: ["uiProjection"],
    appRef: "surface-app:logging-ui",
    surfaceRef: "surface:logging-ui",
    serviceManagerPosture: {
      managerId: "manager:logging-local",
      managerRef: "member:logging-manager",
      runnerRef: RESOLVED_RUNNER_REF,
      hostRef: "host:operator-lab",
      state: "ready",
      serviceRefs: ["service:logging"],
      capabilityRefs: ["service.manage"],
      grantRefs: ["authority-grant:service-manager:logging"],
      evidenceRefs: ["host:manual"],
    },
  }));
  const posture = surfaceAppFulfillmentIdentityPosture(surfaceApp, { issuedAt: 1234 });

  assert.equal(posture.kind, "surface.app.fulfillment.identity.posture");
  assert.equal(posture.state, "ready");
  assert.equal(posture.appContractRef, "surface-app:logging-ui");
  assert.equal(posture.serviceContractRef, "service:logging");
  assert.deepEqual(posture.serviceRouteRefs, ["service:logging", "route:service:logging"]);
  assert.deepEqual(posture.hostRefs, ["host:operator-lab"]);
  assert.deepEqual(posture.runnerRefs, [RESOLVED_RUNNER_REF]);
  assert.deepEqual(posture.memberRefs, [RESOLVED_RUNNER_REF]);
  assert.equal(assertSurfaceAppFulfillmentIdentityPosture(posture).state, "ready");

  const blocked = surfaceAppFulfillmentIdentityPosture(surfaceApp, {
    serviceRef: "service:logging-route-only",
    runnerRef: "member:unresolved",
    issuedAt: 1234,
  });
  assert.equal(blocked.state, "blocked");
  assert(blocked.blockedReasons.includes("serviceRefMismatch"));
  assert(blocked.blockedReasons.includes("unresolvedRunnerRef"));
  assert.equal(assertSurfaceAppFulfillmentIdentityPosture(blocked).state, "blocked");

  const authorityAccess = surfaceAppAuthorityAccessPosture(surfaceApp, {
    fulfillmentIdentityPosture: posture,
    issuedAt: 1234,
  });
  assert.equal(authorityAccess.kind, "surface.app.authority.access.posture");
  assert.equal(authorityAccess.state, "ready");
  assert.equal(authorityAccess.actionRequired, true);
  assert.equal(authorityAccess.accessRequired, true);
  assert.deepEqual(authorityAccess.rootRefs, ["root:aux"]);
  assert.deepEqual(authorityAccess.deviceRefs, ["device:aux-browser"]);
  assert.deepEqual(authorityAccess.grantRefs, ["grant:app:logging-ui:run", "authority-grant:service-manager:logging"]);
  assert.deepEqual(authorityAccess.accessGroupRefs, ["access-group:logging-ui:events"]);
  assert.deepEqual(authorityAccess.requiredContentClasses, ["uiProjection"]);
  assert.equal(assertSurfaceAppAuthorityAccessPosture(authorityAccess).state, "ready");

  const missingGrant = surfaceAppAuthorityAccessPosture(makeContract(), {
    actionRequired: true,
    grantRefs: [],
    fulfillmentIdentityPosture: { grantRefs: [] },
    serviceManagerPosture: { grantRefs: [] },
    issuedAt: 1234,
  });
  assert.equal(missingGrant.state, "blocked");
  assert(missingGrant.blockedReasons.includes("missingActionGrant"));
  assert.equal(assertSurfaceAppAuthorityAccessPosture(missingGrant).state, "blocked");

  const missingAccess = surfaceAppAuthorityAccessPosture(makeContract({
    requiredContentClasses: ["uiProjection"],
  }), { accessGroupRefs: [], issuedAt: 1234 });
  assert.equal(missingAccess.state, "blocked");
  assert(missingAccess.blockedReasons.includes("missingAccessGroup"));
});

test("surface app runner composes protected service manager bootstrap contracts", () => {
  const surfaceApp = defineSurfaceAppContract(makeContract({
    serviceRef: "service:logging",
    appRef: "surface-app:logging-ui",
    surfaceRef: "surface:logging-ui",
    serviceManagerPosture: {
      managerId: "manager:logging-local",
      managerRef: "member:logging-manager",
      state: "ready",
      evidenceRefs: ["host:manual"],
    },
    secretBoundary: {
      state: "resolved",
      accessGroupRefs: ["access-group:logging-ui"],
      authorityRefs: ["grant:logging-ui"],
      evidenceRefs: ["secret-boundary:operator"],
    },
  }));

  const secretBoundary = surfaceServiceManagerSecretBoundary(surfaceApp, { issuedAt: 1234 });
  assert.equal(secretBoundary.kind, "service.manager.secretBoundary");
  assert.equal(secretBoundary.state, "resolved");
  assert.deepEqual(secretBoundary.accessGroupRefs, ["access-group:logging-ui"]);
  assert.equal(secretBoundary.safeFacts, undefined);

  const releaseContract = surfaceServiceManagerReleaseContract(surfaceApp, {
    buildRef: "build:logging-ui:abc",
    releaseRef: "release:logging-ui:abc",
    rollbackRequired: false,
    secretBoundaryRecord: secretBoundary,
    issuedAt: 1234,
  });
  assert.equal(releaseContract.kind, "service.manager.release.contract");
  assert.equal(releaseContract.state, "ready");
  assert.equal(releaseContract.secretBoundaryRefs[0], secretBoundary.boundaryId);
  assert.deepEqual(releaseContract.blockedReasons, []);

  const labProof = surfaceServiceManagerLabProof(surfaceApp, {
    state: "proved",
    profile: "surfaceLandscape",
    artifactRefs: ["artifact:surface-landscape"],
    metricsRefs: ["metrics:surface-landscape"],
    startedAt: 1234,
  });
  assert.equal(labProof.kind, "service.manager.labProof");
  assert.equal(labProof.state, "proved");

  const trainDigest = surfaceServiceManagerTrainDigest(surfaceApp, {
    state: "proved",
    releaseContractRefs: [releaseContract.contractId],
    labProofRefs: [labProof.proofId],
    observedAt: 1234,
  });
  assert.equal(trainDigest.kind, "service.manager.train.digest");
  assert.equal(trainDigest.state, "proved");

  const bootstrapContract = surfaceAppBootstrapContract(surfaceApp, {
    releaseContract,
    secretBoundaryRecord: secretBoundary,
    trainDigestRef: trainDigest.trainId,
    issuedAt: 1234,
  });
  assert.equal(bootstrapContract.kind, "surface.app.bootstrap.contract");
  assert.equal(bootstrapContract.state, "ready");
  assert.equal(bootstrapContract.releaseContractRef, releaseContract.contractId);
  assert.equal(bootstrapContract.secretBoundaryRef, secretBoundary.boundaryId);

  const plan = surfaceAppRunnerPlan(surfaceApp, {
    includeReleaseContract: true,
    releaseContractOptions: {
      buildRef: "build:logging-ui:abc",
      releaseRef: "release:logging-ui:abc",
      rollbackRequired: false,
      evidenceRefs: ["evidence:release:logging-ui"],
    },
    labProofOptions: {
      state: "proved",
      artifactRefs: ["artifact:surface-landscape"],
      metricsRefs: ["metrics:surface-landscape"],
      evidenceRefs: ["evidence:lab:logging-ui"],
      startedAt: 1234,
    },
    trainDigestOptions: {
      state: "proved",
      evidenceRefs: ["evidence:train:logging-ui"],
      observedAt: 1234,
    },
    issuedAt: 1234,
  });
  assert.equal(plan.kind, "surface.app.runner.plan");
  assert.equal(plan.state, "ready");
  assert.equal(plan.bootstrapContract.state, "ready");
  assert.equal(plan.releaseContract.state, "ready");
  assert.equal(plan.labProof.state, "proved");
  assert.equal(plan.trainDigest.state, "proved");
  assert.deepEqual(plan.blockedReasons, []);

  const posture = surfaceAppBootstrapPosture(surfaceApp, {
    runnerPlan: plan,
    issuedAt: 1234,
  });
  assert.equal(posture.kind, "surface.app.bootstrap.posture");
  assert.equal(posture.state, "ready");
  assert.equal(posture.bootstrapContractRef, plan.bootstrapContract.bootstrapContractId);
  assert.equal(posture.releaseContractRef, plan.releaseContract.contractId);
  assert.equal(posture.secretBoundaryRef, plan.secretBoundary.boundaryId);
  assert.equal(posture.trainDigestRef, plan.trainDigest.trainId);
  assert.deepEqual(posture.labProofRefs, [plan.labProof.proofId]);
  assert(posture.evidenceRefs.includes("evidence:release:logging-ui"));
  assert(posture.evidenceRefs.includes("evidence:lab:logging-ui"));
  assert(posture.evidenceRefs.includes("evidence:train:logging-ui"));
  assert.deepEqual(posture.blockedReasons, []);
});

test("surface app runner blocks non-bundled bootstrap without protected release contract", () => {
  const contract = makeContract({
    modules: makeContract().modules.map((module) => ({
      ...module,
      fulfillmentMode: "swarmPackage",
    })),
  });

  const bootstrap = surfaceAppBootstrapContract(contract, {
    sourceMode: "swarmPackage",
    issuedAt: 1234,
  });
  assert.equal(bootstrap.state, "blocked");
  assert.deepEqual(bootstrap.blockedReasons, ["missingReleaseContractRef"]);

  const plan = surfaceAppRunnerPlan(contract, {
    sourceMode: "swarmPackage",
    issuedAt: 1234,
  });
  assert.equal(plan.state, "blocked");
  assert(plan.blockedReasons.includes("release:missingBuildRef"));
  assert(plan.blockedReasons.includes("release:missingReleaseRef"));
  assert(plan.blockedReasons.includes("release:missingRollbackRef"));

  const posture = surfaceAppBootstrapPosture(contract, {
    sourceMode: "swarmPackage",
    issuedAt: 1234,
  });
  assert.equal(posture.state, "blocked");
  assert(posture.blockedReasons.includes("missingBootstrapContract"));
  assert(posture.blockedReasons.includes("missingReleaseContractRef"));
});

test("surface app runner blocks unresolved required secret boundary", () => {
  const plan = surfaceAppRunnerPlan(makeContract(), {
    secretBoundaryRequired: true,
    issuedAt: 1234,
  });
  assert.equal(plan.secretBoundary.kind, "service.manager.secretBoundary");
  assert.equal(plan.secretBoundary.state, "blocked");
  assert.deepEqual(plan.secretBoundary.blockedReasons, ["missingSecretOrAccessGroupRef"]);
  assert(plan.blockedReasons.includes("secretBoundary:missingSecretOrAccessGroupRef"));
});

test("surface app manifest selection pins bundled app contracts by version", () => {
  const contract = makeContract({
    contractId: "surface-app:logging-ui@0.1.0",
  });
  const manifest = {
    kind: "surface.app.manifest",
    manifestId: "manifest:logging-ui",
    appId: "constitute-logging-ui",
    currentAppContractRef: "surface-app:logging-ui@0.1.0",
    currentVersion: "0.1.0",
    defaultSourceMode: "bundled",
    versions: [
      {
        appContractRef: "surface-app:logging-ui@0.1.0",
        version: "0.1.0",
        state: "current",
        sourceMode: "bundled",
        requiredModuleRoles: ["runtimeClient", "productView"],
        compatibilityWindow: {
          minVersion: "0.1.0",
          maxVersion: "0.1.x",
          protocolRef: "protocol:surface-app:v1",
        },
        bundledSourceRefs: ["bundle:logging-ui@0.1.0"],
        grantRefs: ["grant:app:logging-ui:run"],
        runnerRequirementRefs: ["runner:req:logging-ui"],
        serviceManagerRequirementRefs: ["service-manager:req:logging-ui"],
        compatibilityRefs: ["protocol:surface-app:v1"],
      },
    ],
    requiredModuleRoles: ["runtimeClient"],
    bundledSourceRefs: ["bundle:logging-ui@0.1.0"],
    issuedAt: 1234,
  };

  const selection = surfaceAppManifestSelection(manifest, [contract], { issuedAt: 1234 });
  assert.equal(selection.kind, "surface.app.manifest.selection");
  assert.equal(selection.state, "ready");
  assert.equal(selection.contract.contractId, "surface-app:logging-ui@0.1.0");
  assert.equal(Object.prototype.propertyIsEnumerable.call(selection, "contract"), false);
  assert.equal(Object.prototype.propertyIsEnumerable.call(selection, "surfaceApp"), false);
  assert.equal(assertSurfaceAppManifestSelection(selection), selection);
  assert.deepEqual(selection.requiredModuleRoles, ["runtimeClient", "productView"]);
  assert.deepEqual(selection.bundledSourceRefs, ["bundle:logging-ui@0.1.0"]);
  assert.deepEqual(selection.runnerRequirementRefs, ["runner:req:logging-ui"]);
  assert.deepEqual(selection.blockedReasons, []);

  const plan = surfaceAppRunnerPlanFromManifest(manifest, [contract], { issuedAt: 1234 });
  assert.equal(plan.kind, "surface.app.manifest.runner.plan");
  assert.equal(plan.state, "ready");
  assert.equal(plan.runnerPlan.state, "ready");
  assert.equal(plan.runnerPlan.bootstrapContract.appContractRef, "surface-app:logging-ui@0.1.0");
  assert.equal(assertSurfaceAppManifestRunnerPlan(plan), plan);
});

test("surface app runtime selection posture reduces manifest runner and module readiness", () => {
  const contract = makeContract({
    contractId: "surface-app:logging-ui@0.1.0",
  });
  const manifest = {
    kind: "surface.app.manifest",
    manifestId: "manifest:logging-ui",
    appId: "constitute-logging-ui",
    currentAppContractRef: "surface-app:logging-ui@0.1.0",
    currentVersion: "0.1.0",
    defaultSourceMode: "bundled",
    versions: [
      {
        appContractRef: "surface-app:logging-ui@0.1.0",
        version: "0.1.0",
        state: "current",
        sourceMode: "bundled",
        requiredModuleRoles: ["runtimeClient", "productView"],
        compatibilityWindow: {
          minVersion: "0.1.0",
          maxVersion: "0.1.x",
          protocolRef: "protocol:surface-app:v1",
        },
        bundledSourceRefs: ["bundle:logging-ui@0.1.0"],
        runnerRequirementRefs: ["runner:req:logging-ui"],
        serviceManagerRequirementRefs: ["service-manager:req:logging-ui"],
      },
    ],
    issuedAt: 1234,
  };

  const posture = surfaceAppRuntimeSelectionPosture(manifest, [contract], {
    runtimeVersion: "0.1.0",
    issuedAt: 1234,
  });

  assert.equal(posture.kind, "surface.app.runtime.selection.posture");
  assert.equal(posture.state, "ready");
  assert.equal(posture.requestedAppRef, "surface-app:logging-ui@0.1.0");
  assert.equal(posture.pinnedVersion, "0.1.0");
  assert.equal(posture.compatibilityResult.state, "ready");
  assert.equal(posture.sourceTrustResult.state, "ready");
  assert.equal(posture.runnerReadiness.state, "ready");
  assert.equal(posture.serviceManagerReadiness.state, "unknown");
  assert.deepEqual(posture.requiredModuleRoles, ["runtimeClient", "productView", "projectionModel"]);
  assert.equal(posture.modulePostures.every((entry) => entry.state === "ready"), true);
  assert.deepEqual(posture.blockedReasons, []);
  assert.equal(Object.prototype.propertyIsEnumerable.call(posture.manifestSelection, "surfaceApp"), false);
  assert.equal(Object.prototype.propertyIsEnumerable.call(posture.manifestSelection, "contract"), false);
  assert.equal(assertSurfaceAppRuntimeSelectionPosture(posture), posture);
});

test("surface app instance posture composes runtime, runner, module, and bootstrap posture", () => {
  const contract = defineSurfaceAppContract(makeContract({
    contractId: "surface-app:logging-ui@0.1.0",
    appRef: "surface-app:logging-ui@0.1.0",
  }));
  const manifest = {
    kind: "surface.app.manifest",
    manifestId: "manifest:logging-ui",
    appId: "constitute-logging-ui",
    currentAppContractRef: "surface-app:logging-ui@0.1.0",
    currentVersion: "0.1.0",
    defaultSourceMode: "bundled",
    versions: [
      {
        appContractRef: "surface-app:logging-ui@0.1.0",
        version: "0.1.0",
        state: "current",
        sourceMode: "bundled",
        compatibilityWindow: {
          minVersion: "0.1.0",
          maxVersion: "0.1.x",
          protocolRef: "protocol:surface-app:v1",
        },
        bundledSourceRefs: ["bundle:logging-ui@0.1.0"],
      },
    ],
    issuedAt: 1234,
  };
  const runtimeSelectionPosture = surfaceAppRuntimeSelectionPosture(manifest, [contract], {
    runtimeVersion: "0.1.0",
    issuedAt: 1234,
  });
  const runnerPlan = surfaceAppRunnerPlan(contract, { issuedAt: 1234 });
  const instance = surfaceAppInstancePosture(contract, {
    runtimeSelectionPosture,
    runnerPlan,
    bootstrapContract: runnerPlan.bootstrapContract,
    bootstrapPosture: surfaceAppBootstrapPosture(contract, { issuedAt: 1234 }),
    moduleBindings: {
      kind: "surface.app.module.bindings",
      state: "ready",
      roles: ["runtimeClient", "projectionModel", "productView"],
      keys: ["runtimeClient", "projectionModel", "productView"],
      bindings: [
        { state: "ready", role: "runtimeClient", moduleRef: "constitute-ui/runtime-surface-client@0.1.0" },
      ],
    },
    issuedAt: 1234,
  });

  assert.equal(instance.kind, "surface.app.instance.posture");
  assert.equal(instance.state, "ready");
  assert.equal(instance.appId, "constitute-logging-ui");
  assert.equal(instance.manifestId, "manifest:logging-ui");
  assert.equal(instance.pinnedAppContractRef, "surface-app:logging-ui@0.1.0");
  assert.equal(instance.runnerPlanRef, runnerPlan.planId);
  assert.equal(instance.bootstrapContractRef, runnerPlan.bootstrapContract.bootstrapContractId);
  assert.equal(instance.moduleBindingPosture.state, "ready");
  assert.equal(instance.fulfillmentIdentityPosture.state, "ready");
  assert.equal(instance.fulfillmentIdentityPosture.appContractRef, "surface-app:logging-ui@0.1.0");
  assert.deepEqual(instance.blockedReasons, []);
  assert.equal(assertSurfaceAppRunnerPlan(runnerPlan), runnerPlan);
  assert.equal(assertSurfaceAppInstancePosture(instance), instance);
});

test("surface app selection read model composes selection, modules, runner, and attach context", () => {
  const surfaceApp = defineSurfaceAppContract(makeContract({
    contractId: "surface-app:logging-ui@0.1.0",
    appRef: "surface-app:logging-ui@0.1.0",
  }));
  const manifest = {
    kind: "surface.app.manifest",
    manifestId: "manifest:logging-ui",
    appId: "constitute-logging-ui",
    currentAppContractRef: "surface-app:logging-ui@0.1.0",
    currentVersion: "0.1.0",
    defaultSourceMode: "bundled",
    versions: [
      {
        appContractRef: "surface-app:logging-ui@0.1.0",
        version: "0.1.0",
        state: "current",
        sourceMode: "bundled",
        compatibilityWindow: {
          minVersion: "0.1.0",
          maxVersion: "0.1.x",
          protocolRef: "protocol:surface-app:v1",
        },
        bundledSourceRefs: ["bundle:logging-ui@0.1.0"],
      },
    ],
    issuedAt: 1234,
  };
  const moduleRegistry = createSurfaceModuleRegistry(surfaceApp.modules.map((module) => ({
    moduleRef: module.moduleRef,
    role: module.role,
    version: module.version,
    primitiveRefs: module.primitiveRefs,
    implementation: { moduleRef: module.moduleRef },
  })));

  const readModel = surfaceAppSelectionReadModel({
    surfaceApp,
    manifest,
    moduleRegistry,
    moduleRoles: {
      runtimeClient: "runtimeClient",
      projectionModel: "projectionModel",
      productView: "productView",
    },
    productSurface: "constitute-logging-ui",
    runtimeVersion: "0.1.0",
    issuedAt: 1234,
    serviceManagerOperationOptions: {
      operation: "healthCheck",
      operationId: "operation:logging-ui:bootstrap-health",
      requestedAt: 1234,
    },
    runnerPlanOptions: {
      includeReleaseContract: true,
      releaseContractOptions: {
        buildRef: "build:logging-ui:abc",
        releaseRef: "release:logging-ui:abc",
        rollbackRequired: false,
      },
      labProofOptions: {
        state: "proved",
        artifactRefs: ["artifact:surface-landscape"],
        metricsRefs: ["metrics:surface-landscape"],
        startedAt: 1234,
      },
      trainDigestOptions: {
        state: "proved",
        observedAt: 1234,
      },
    },
    serviceManagerProofDigestOptions: {
      digestId: "proof-digest:logging-ui:bootstrap",
      observedAt: 1234,
    },
  });

  assert.equal(readModel.kind, "surface.app.selection.readModel");
  assert.equal(readModel.state, "ready");
  assert.equal(readModel.runtimeSelectionPosture.kind, "surface.app.runtime.selection.posture");
  assert.equal(readModel.moduleBindings.state, "ready");
  assert.equal(readModel.runnerPlan.kind, "surface.app.runner.plan");
  assert.equal(readModel.fulfillmentIdentityPosture.kind, "surface.app.fulfillment.identity.posture");
  assert.equal(readModel.authorityAccessPosture.kind, "surface.app.authority.access.posture");
  assert.equal(readModel.attachContext.fulfillmentIdentityPosture, readModel.fulfillmentIdentityPosture);
  assert.equal(readModel.attachContext.authorityAccessPosture, readModel.authorityAccessPosture);
  assert.equal(readModel.appInstancePosture.kind, "surface.app.instance.posture");
  assert.equal(readModel.appInstancePosture.authorityAccessPosture, readModel.authorityAccessPosture);
  assert.equal(readModel.attachContext.appInstancePosture, readModel.appInstancePosture);
  assert.equal(readModel.attachContext.runtimeSelectionPosture, readModel.runtimeSelectionPosture);
  assert.equal(readModel.attachContext.runnerPlan, readModel.runnerPlan);
  assert.equal(readModel.bootstrapPosture.bootstrapContractRef, readModel.runnerPlan.bootstrapContract.bootstrapContractId);
  assert.equal(readModel.bootstrapPosture.releaseContractRef, readModel.runnerPlan.releaseContract.contractId);
  assert.equal(readModel.bootstrapPosture.secretBoundaryRef, readModel.runnerPlan.secretBoundary.boundaryId);
  assert.equal(readModel.bootstrapPosture.trainDigestRef, readModel.runnerPlan.trainDigest.trainId);
  assert.deepEqual(readModel.blockedReasons, []);
});

test("surface app manifest selection blocks missing bundles and unproven remote sources", () => {
  const manifest = {
    kind: "surface.app.manifest",
    manifestId: "manifest:logging-ui",
    appId: "constitute-logging-ui",
    currentAppContractRef: "surface-app:logging-ui@0.2.0",
    currentVersion: "0.2.0",
    defaultSourceMode: "swarmPackage",
    versions: [
      {
        appContractRef: "surface-app:logging-ui@0.2.0",
        version: "0.2.0",
        state: "current",
        sourceMode: "swarmPackage",
      },
    ],
    issuedAt: 1234,
  };

  const selection = surfaceAppManifestSelection(manifest, [makeContract()], { issuedAt: 1234 });
  assert.equal(selection.state, "blocked");
  assert(selection.blockedReasons.includes("missingBundledContract"));
  assert(selection.blockedReasons.includes("missingReleaseContractRef"));
  assert(selection.blockedReasons.includes("missingRemoteSourceRef"));

  const plan = surfaceAppRunnerPlanFromManifest(manifest, [makeContract()], { issuedAt: 1234 });
  assert.equal(plan.state, "blocked");
  assert.equal(plan.runnerPlan, null);

  const posture = surfaceAppRuntimeSelectionPosture(manifest, [makeContract()], {
    runtimeVersion: "0.1.0",
    issuedAt: 1234,
  });
  assert.equal(posture.state, "blocked");
  assert(posture.blockedReasons.includes("manifest:missingRemoteSourceRef"));
  assert(posture.blockedReasons.includes("source:missingRemoteSourceRef"));
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

test("surface app helper emits shared module taxonomy posture", () => {
  const surfaceApp = defineSurfaceAppContract(makeContract({
    requiredModuleRoles: [
      "runtimeClient",
      "projectionModel",
      "platformAdapter",
      "serviceSurfaceAdapter",
      "serviceEdgeAdapter",
      "productView",
    ],
    releasePosture: {
      state: "releaseReady",
      buildRef: "build:logging-ui",
      releaseRef: "release:logging-ui",
    },
    modules: [
      ...makeContract().modules,
      {
        moduleRef: "constitute-ui/media-webrtc-adapter@0.1.0",
        role: "platformAdapter",
        participantSide: "window",
        fulfillmentMode: "bundled",
        version: "0.1.0",
        primitiveRefs: ["media.transport.path"],
        outputs: ["media.transport.observation"],
        materializationBudgetRefs: ["logging-ui.event-table"],
      },
      {
        moduleRef: "constitute-logging-ui/service-surface-adapter@0.1.0",
        role: "serviceSurfaceAdapter",
        participantSide: "window",
        fulfillmentMode: "bundled",
        version: "0.1.0",
        primitiveRefs: ["logging.events.intent"],
        outputs: ["runtime.intent"],
      },
      {
        moduleRef: "constitute-logging/service-edge-adapter@0.1.0",
        role: "serviceEdgeAdapter",
        participantSide: "service",
        fulfillmentMode: "nativeInstalled",
        version: "0.1.0",
        primitiveRefs: ["service.admission", "projection.delta"],
        outputs: ["service.accepted", "projection.delta"],
        releaseRefs: ["release:logging-service"],
      },
    ],
  }));

  const posture = surfaceModuleTaxonomyPosture(surfaceApp, { issuedAt: 1700000001 });

  assert.equal(posture.kind, "surface.module.taxonomy.posture");
  assert.equal(posture.state, "ready");
  assert.equal(posture.byRole.serviceEdgeAdapter.taxonomyKey, "serviceEdgeAdapter");
  assert.deepEqual(posture.byRole.serviceEdgeAdapter.participantSides, ["service"]);
  assert(posture.byRole.platformAdapter.evidenceChannels.includes("media.transport.observation"));
  assert(posture.materializationBudgetRefs.includes("logging-ui.event-table"));
  assert(posture.releaseRefs.includes("release:logging-ui"));
  assert(posture.releaseRefs.includes("release:logging-service"));
  assert.equal(surfaceAdapterTaxonomyPosture(surfaceApp).byRole.runtimeClient.taxonomyKey, "surfaceClient");
  assert.equal(SURFACE_ADAPTER_TAXONOMY.serviceEdgeAdapter.role, "serviceEdgeAdapter");
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

test("surface app helper composes materialization enforcement posture", () => {
  const surfaceApp = defineSurfaceAppContract(makeContract());
  const budget = requireSurfaceMaterializationBudget(surfaceApp, "logging-ui.event-table");
  const replayPosture = materializationEventReplayPosture(budget, {
    sourceEvents: [{ eventId: "event-1", schemaVersion: 1, observedAt: 1700000000000 }],
    materializedEvents: [{ eventId: "event-1", schemaVersion: 1, observedAt: 1700000000000 }],
    expectedSchemaVersion: 1,
    sampledAt: 1700000001000,
  });
  const enforcement = materializationEnforcementPosture(budget, {
    sourceCount: 1,
    materializedCount: 1,
    replayPosture,
    upstreamPosture: {
      state: "pressure",
      blockedReasons: ["upstreamConsumerLag"],
      consumerFloor: { floorId: "floor:upstream", lagState: "lagging" },
    },
    upstreamBudget: { budgetId: "service.events", state: "withinBudget" },
    referenceRefs: ["logging-ui.events"],
    sampledAt: 1700000001000,
  });

  assert.equal(enforcement.kind, "surface.materialization.enforcement.posture");
  assert.equal(enforcement.state, "pressure");
  assert.equal(enforcement.budgetId, "logging-ui.event-table");
  assert.equal(enforcement.usage.state, "withinBudget");
  assert.equal(enforcement.copyBoundary.state, "ready");
  assert.equal(enforcement.upstream.state, "pressure");
  assert.deepEqual(enforcement.blockedReasons, ["upstream:upstreamConsumerLag"]);
  assert.equal(enforcement.releasePosture.state, "held");
  assert.equal(enforcement.bitemporal.observedTimeFloor, 1700000000000);
});
