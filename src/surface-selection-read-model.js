import {
  assertServiceManagerOperationPosture,
  assertServiceManagerProofDigest,
  assertServiceManagerSecretBoundary,
  assertSurfaceAppAuthorityAccessPosture,
  assertSurfaceAppBootstrapContract,
  assertSurfaceAppFulfillmentIdentityPosture,
  assertSurfaceAppInstancePosture,
  assertSurfaceAppRuntimeSelectionPosture,
  assertSurfaceAppRunnerPlan,
  assertSurfaceAppServiceManagerActionability,
} from "../../constitute-protocol/src/index.js";
import {
  defineSurfaceAppContract,
  surfaceAppAttachContext,
  surfaceAppAuthorityAccessPosture,
  surfaceAppBootstrapPosture,
  surfaceAppFulfillmentIdentityPosture,
  surfaceAppInstancePosture,
  surfaceAppRuntimeSelectionPosture,
  surfaceAppRunnerPlan,
  surfaceAppServiceManagerActionability,
  surfaceServiceManagerOperationPosture,
  surfaceServiceManagerProofDigest,
} from "./surface-app-contract.js";
import {
  surfaceAppModuleBindings,
  surfaceAppModuleImplementations,
} from "./surface-module-registry.js";

export function surfaceAppSelectionReadModel(options = {}) {
  const issuedAt = Number(options.issuedAt || Date.now());
  const surfaceApp = asSurfaceApp(options.surfaceApp || options.surfaceAppContract || options.contract);
  const manifest = options.manifest;
  const candidates = normalizeCandidates(options.surfaceAppsOrContracts, surfaceApp);
  const runtimeSelectionPosture = assertSurfaceAppRuntimeSelectionPosture(
    options.runtimeSelectionPosture || surfaceAppRuntimeSelectionPosture(
      manifest,
      candidates,
      {
        ...(isObject(options.runtimeSelectionOptions) ? options.runtimeSelectionOptions : {}),
        runtimeVersion: options.runtimeVersion || options.runtimeSelectionOptions?.runtimeVersion,
        issuedAt,
      },
    ),
  );
  const moduleBindings = options.moduleBindings || options.moduleBindingPosture || resolveModuleBindings({
    moduleRegistry: options.moduleRegistry,
    runtimeSelectionPosture,
    moduleRoles: options.moduleRoles,
    moduleBindingMode: options.moduleBindingMode,
  });
  const runnerPlan = assertSurfaceAppRunnerPlan(
    options.runnerPlan || surfaceAppRunnerPlan(surfaceApp, {
      ...(isObject(options.runnerPlanOptions) ? options.runnerPlanOptions : {}),
      issuedAt,
    }),
  );
  const serviceManagerSecretBoundary = assertServiceManagerSecretBoundary(
    options.serviceManagerSecretBoundary || runnerPlan.secretBoundary,
  );
  const bootstrapContract = assertSurfaceAppBootstrapContract(
    options.bootstrapContract || runnerPlan.bootstrapContract,
  );
  const bootstrapPosture = options.bootstrapPosture || surfaceAppBootstrapPosture(surfaceApp, {
    ...(isObject(options.bootstrapPostureOptions) ? options.bootstrapPostureOptions : {}),
    runnerPlan,
    bootstrapContract,
    releaseContract: options.bootstrapPostureOptions?.releaseContract || runnerPlan.releaseContract,
    secretBoundary: options.bootstrapPostureOptions?.secretBoundary || serviceManagerSecretBoundary,
    labProof: options.bootstrapPostureOptions?.labProof || runnerPlan.labProof,
    proofDigest: options.bootstrapPostureOptions?.proofDigest || runnerPlan.proofDigest,
    trainDigest: options.bootstrapPostureOptions?.trainDigest || runnerPlan.trainDigest,
    issuedAt,
  });
  const serviceManagerOperationPosture = assertServiceManagerOperationPosture(
    options.serviceManagerOperationPosture || surfaceServiceManagerOperationPosture(surfaceApp, {
      ...(isObject(options.serviceManagerOperationOptions) ? options.serviceManagerOperationOptions : {}),
      requestedAt: options.serviceManagerOperationOptions?.requestedAt || issuedAt,
    }),
  );
  const serviceManagerProofDigest = assertServiceManagerProofDigest(
    options.serviceManagerProofDigest || surfaceServiceManagerProofDigest(surfaceApp, {
      ...(isObject(options.serviceManagerProofDigestOptions) ? options.serviceManagerProofDigestOptions : {}),
      operationPosture: options.serviceManagerProofDigestOptions?.operationPosture || serviceManagerOperationPosture,
      observedAt: options.serviceManagerProofDigestOptions?.observedAt || issuedAt,
    }),
  );
  const serviceManagerActionability = assertSurfaceAppServiceManagerActionability(
    options.serviceManagerActionability || runtimeSelectionPosture.serviceManagerActionability || surfaceAppServiceManagerActionability(surfaceApp, {
      ...(isObject(options.serviceManagerActionabilityOptions) ? options.serviceManagerActionabilityOptions : {}),
      runnerPlan,
      serviceManagerPosture: options.serviceManagerActionabilityOptions?.serviceManagerPosture || surfaceApp.contract.serviceManagerPosture,
      operationPostures: [
        serviceManagerOperationPosture,
        ...normalizeArray(options.serviceManagerActionabilityOptions?.operationPostures).filter(isObject),
      ],
      proofDigest: serviceManagerProofDigest,
      issuedAt,
    }),
  );
  const fulfillmentIdentityPosture = assertSurfaceAppFulfillmentIdentityPosture(
    options.fulfillmentIdentityPosture || surfaceAppFulfillmentIdentityPosture(surfaceApp, {
      ...(isObject(options.fulfillmentIdentityOptions) ? options.fulfillmentIdentityOptions : {}),
      serviceManagerPosture: options.fulfillmentIdentityOptions?.serviceManagerPosture || surfaceApp.contract.serviceManagerPosture,
      issuedAt,
    }),
  );
  const authorityAccessPosture = assertSurfaceAppAuthorityAccessPosture(
    options.authorityAccessPosture || surfaceAppAuthorityAccessPosture(surfaceApp, {
      ...(isObject(options.authorityAccessOptions) ? options.authorityAccessOptions : {}),
      runtimeSelectionPosture,
      fulfillmentIdentityPosture,
      secretBoundary: options.authorityAccessOptions?.secretBoundary || serviceManagerSecretBoundary,
      serviceManagerPosture: options.authorityAccessOptions?.serviceManagerPosture || surfaceApp.contract.serviceManagerPosture,
      issuedAt,
    }),
  );
  const appInstancePosture = assertSurfaceAppInstancePosture(
    options.appInstancePosture || surfaceAppInstancePosture(surfaceApp, {
      ...(isObject(options.appInstanceOptions) ? options.appInstanceOptions : {}),
      runtimeSelectionPosture,
      moduleBindings,
      runnerPlan,
      bootstrapContract,
      bootstrapPosture,
      runnerFulfillmentReport: options.runnerFulfillmentReport,
      fulfillmentIdentityPosture,
      authorityAccessPosture,
      serviceManagerOperationPosture,
      serviceManagerProofDigest,
      serviceManagerActionability,
      issuedAt,
    }),
  );
  const attachContext = surfaceAppAttachContext(surfaceApp, {
    productSurface: options.productSurface || surfaceApp.contract.appId || "",
    ...(isObject(options.attachContextOptions) ? options.attachContextOptions : {}),
    runtimeSelectionPosture,
    runnerPlan,
    appInstancePosture,
    bootstrapContract,
    serviceManagerSecretBoundary,
    bootstrapPosture,
    fulfillmentIdentityPosture,
    authorityAccessPosture,
    serviceManagerActionability,
    serviceManagerOperationPosture,
    serviceManagerProofDigest,
  });
  const blockedReasons = uniqueStrings([
    ...normalizeStringArray(runtimeSelectionPosture.blockedReasons),
    ...normalizeStringArray(moduleBindings?.blockedReasons),
    ...normalizeStringArray(runnerPlan.blockedReasons),
    ...normalizeStringArray(fulfillmentIdentityPosture.blockedReasons),
    ...normalizeStringArray(authorityAccessPosture.blockedReasons),
    ...normalizeStringArray(bootstrapPosture.blockedReasons),
    ...normalizeStringArray(serviceManagerActionability.blockedReasons),
    ...normalizeStringArray(serviceManagerOperationPosture.blockedReasons),
    ...normalizeStringArray(serviceManagerProofDigest.blockedReasons),
    ...normalizeStringArray(appInstancePosture.blockedReasons),
  ]);
  const state = blockedReasons.length
    ? "blocked"
    : ([runtimeSelectionPosture, appInstancePosture].some((record) => String(record?.state || "") === "degraded")
      ? "degraded"
      : "ready");
  return deepFreeze({
    kind: "surface.app.selection.readModel",
    state,
    blockedReasons,
    contractId: String(surfaceApp.contract.contractId || ""),
    appId: String(surfaceApp.contract.appId || ""),
    appRef: String(surfaceApp.contract.appRef || runtimeSelectionPosture.pinnedAppContractRef || ""),
    serviceRef: String(surfaceApp.contract.serviceRef || ""),
    surfaceRef: String(surfaceApp.contract.surfaceRef || ""),
    productSurface: String(options.productSurface || surfaceApp.contract.appId || ""),
    manifestId: String(runtimeSelectionPosture.manifestId || ""),
    pinnedAppContractRef: String(runtimeSelectionPosture.pinnedAppContractRef || ""),
    pinnedVersion: String(runtimeSelectionPosture.pinnedVersion || ""),
    sourceMode: String(runtimeSelectionPosture.sourceMode || ""),
    runtimeSelectionPosture,
    moduleBindings: moduleBindings || null,
    runnerPlan,
    runnerFulfillmentLifecycle: appInstancePosture.runnerFulfillmentLifecycle || null,
    runnerFulfillmentReadiness: appInstancePosture.runnerFulfillmentReadiness || null,
    fulfillmentIdentityPosture,
    authorityAccessPosture,
    serviceManagerSecretBoundary,
    serviceManagerActionability,
    bootstrapContract,
    bootstrapPosture,
    serviceManagerOperationPosture,
    serviceManagerProofDigest,
    appInstancePosture,
    attachContext,
    materializationBudgetRefs: appInstancePosture.materializationBudgetRefs || [],
    moduleRefs: appInstancePosture.moduleRefs || [],
    issuedAt,
    expiresAt: options.expiresAt || appInstancePosture.expiresAt || runtimeSelectionPosture.expiresAt,
  });
}

function asSurfaceApp(value) {
  if (!value) throw new Error("surface app is required");
  if (value.contract && value.modulesByRole) return value;
  return defineSurfaceAppContract(value);
}

function normalizeCandidates(value, surfaceApp) {
  if (Array.isArray(value) && value.length) return value;
  if (isObject(value) && Object.keys(value).length) return value;
  return [surfaceApp];
}

function resolveModuleBindings({
  moduleRegistry,
  runtimeSelectionPosture,
  moduleRoles,
  moduleBindingMode,
}) {
  if (!moduleRegistry) return null;
  if (String(moduleBindingMode || "") === "implementations") {
    return surfaceAppModuleImplementations(moduleRegistry, runtimeSelectionPosture, moduleRoles);
  }
  return surfaceAppModuleBindings(moduleRegistry, runtimeSelectionPosture, moduleRoles);
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item !== null && item !== undefined && item !== "")
    .map((item) => String(item));
}

function normalizeArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return Object.freeze(out);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}
