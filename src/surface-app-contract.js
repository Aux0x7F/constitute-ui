export const SURFACE_CONTRACT_ROLE_ORDER = Object.freeze([
  "runtimeClient",
  "projectionModel",
  "platformAdapter",
  "serviceSurfaceAdapter",
  "serviceEdgeAdapter",
  "productView",
  "operatorHelper",
  "releaseHelper",
]);

export const SURFACE_MODULE_ROLE_TAXONOMY = Object.freeze({
  runtimeClient: freezeTaxonomyRole({
    taxonomyKey: "surfaceClient",
    role: "runtimeClient",
    participantSides: ["window"],
    evidenceChannels: ["runtime.attach", "runtime.snapshot", "runtime.intent"],
    lifecycle: { state: "surfaceSession" },
  }),
  projectionModel: freezeTaxonomyRole({
    taxonomyKey: "projectionModel",
    role: "projectionModel",
    participantSides: ["window", "runtime"],
    evidenceChannels: ["projection.materialization", "projection.delta"],
    lifecycle: { state: "readModel" },
  }),
  platformAdapter: freezeTaxonomyRole({
    taxonomyKey: "platformAdapter",
    role: "platformAdapter",
    participantSides: ["window", "native"],
    evidenceChannels: ["adapter.evidence", "media.transport.observation"],
    lifecycle: { state: "platformBinding" },
  }),
  serviceSurfaceAdapter: freezeTaxonomyRole({
    taxonomyKey: "serviceSurfaceAdapter",
    role: "serviceSurfaceAdapter",
    participantSides: ["window"],
    evidenceChannels: ["runtime.intent", "adapter.evidence"],
    lifecycle: { state: "surfaceMapping" },
  }),
  serviceEdgeAdapter: freezeTaxonomyRole({
    taxonomyKey: "serviceEdgeAdapter",
    role: "serviceEdgeAdapter",
    participantSides: ["service", "native"],
    evidenceChannels: ["service.admission", "service.response", "projection.delta"],
    lifecycle: { state: "serviceEdgeSession" },
  }),
  productView: freezeTaxonomyRole({
    taxonomyKey: "productView",
    role: "productView",
    participantSides: ["window"],
    evidenceChannels: ["product.intent", "runtime.posture.render"],
    lifecycle: { state: "viewBinding" },
  }),
  operatorHelper: freezeTaxonomyRole({
    taxonomyKey: "operatorHelper",
    role: "operatorHelper",
    participantSides: ["operator"],
    evidenceChannels: ["operator.proof", "operator.metrics"],
    lifecycle: { state: "operatorLease" },
  }),
  releaseHelper: freezeTaxonomyRole({
    taxonomyKey: "releaseHelper",
    role: "releaseHelper",
    participantSides: ["operator", "service"],
    evidenceChannels: ["service.manager.proof", "release.posture"],
    lifecycle: { state: "releaseBinding" },
  }),
});

export const SURFACE_ADAPTER_TAXONOMY = SURFACE_MODULE_ROLE_TAXONOMY;

export function defineSurfaceAppContract(contract, { validate } = {}) {
  const validated = typeof validate === "function" ? validate(contract) : contract;
  if (!isObject(validated)) throw new Error("surface app contract is required");

  const modules = normalizeModules(validated.modules);
  const activities = normalizeActivities(validated.activities);
  const activityDependencies = normalizeActivityDependencies(validated.activityDependencies || validated.dependencies);
  const requiredRoles = normalizeStringArray(validated.requiredModuleRoles);
  const modulesByRole = indexModulesByRole(modules);
  const activitiesByRef = indexActivities(activities);
  const activityDependenciesByRef = indexActivityDependencies(activityDependencies);
  const missingRoles = requiredRoles.filter((role) => !modulesByRole[role]?.length);
  const posture = Object.freeze({
    state: missingRoles.length ? "blocked" : "ready",
    blockedReason: missingRoles.length ? "missingModuleRole" : "",
    missingRoles: Object.freeze([...missingRoles]),
    moduleCount: modules.length,
  });

  const surfaceApp = {
    contract: freezeContract(validated, modules, requiredRoles, activities, activityDependencies),
    modules,
    modulesByRole,
    activities,
    activitiesByRef,
    activityDependencies,
    activityDependenciesByRef,
    requiredRoles: Object.freeze([...requiredRoles]),
    missingRoles: Object.freeze([...missingRoles]),
    posture,
    hasRole(role) {
      return Boolean(modulesByRole[String(role || "")]?.length);
    },
    moduleForRole(role) {
      return modulesByRole[String(role || "")]?.[0] || null;
    },
    modulesForRole(role) {
      return Object.freeze([...(modulesByRole[String(role || "")] || [])]);
    },
    activityFor(refOrId) {
      return activitiesByRef.get(String(refOrId || "")) || null;
    },
    activitiesForLaunchMode(launchMode) {
      const mode = String(launchMode || "");
      return Object.freeze(activities.filter((activity) => !mode || activity.launchMode === mode));
    },
    activityDependenciesFor(refOrId) {
      const ref = String(refOrId || "").trim();
      const activity = surfaceApp.activityFor(ref);
      const keys = uniqueStrings([ref, activity?.activityRef, activity?.activityId]);
      return Object.freeze(keys.flatMap((key) => activityDependenciesByRef.get(key) || []));
    },
    attachContext(extra = {}) {
      return surfaceAppAttachContext(surfaceApp, extra);
    },
  };

  return Object.freeze(surfaceApp);
}

export function surfaceAppContractPosture(surfaceAppOrContract) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  return surfaceApp.posture;
}

export function surfaceModuleTaxonomyPosture(surfaceAppOrContract, options = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const contract = surfaceApp.contract;
  const roleOrder = uniqueStrings([
    ...SURFACE_CONTRACT_ROLE_ORDER,
    ...surfaceApp.requiredRoles,
    ...surfaceApp.modules.map((module) => String(module.role || "")),
  ]);
  const rolePostures = roleOrder.map((role) => surfaceModuleTaxonomyRolePosture(surfaceApp, role, options));
  const blockedReasons = uniqueStrings(rolePostures.flatMap((posture) => posture.blockedReasons));
  const byRole = {};
  for (const posture of rolePostures) byRole[posture.role] = posture;
  const materializationBudgetRefs = uniqueStrings([
    ...(contract.materializationBudgets || []).map((budget) => budget?.budgetId),
    ...rolePostures.flatMap((posture) => posture.materializationBudgetRefs),
  ]);
  const releaseRefs = uniqueStrings([
    ...surfaceReleaseRefs(contract),
    ...rolePostures.flatMap((posture) => posture.releaseRefs),
  ]);

  return deepFreeze({
    kind: "surface.module.taxonomy.posture",
    state: blockedReasons.length ? "blocked" : "ready",
    blockedReasons,
    roleOrder,
    roles: rolePostures,
    byRole,
    moduleCount: surfaceApp.modules.length,
    materializationBudgetRefs,
    releaseRefs,
    issuedAt: Number(options.issuedAt || contract.issuedAt || Date.now()),
    expiresAt: options.expiresAt || contract.expiresAt,
  });
}

export const surfaceAdapterTaxonomyPosture = surfaceModuleTaxonomyPosture;

export function surfaceAppAttachContext(surfaceAppOrContract, extra = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const contract = surfaceApp.contract;
  const serviceManagerActionability = isObject(extra.serviceManagerActionability)
    ? extra.serviceManagerActionability
    : null;
  const fulfillmentIdentityPosture = isObject(extra.fulfillmentIdentityPosture)
    ? extra.fulfillmentIdentityPosture
    : surfaceAppFulfillmentIdentityPosture(surfaceApp, extra.identityOptions || {});
  const authorityAccessPosture = isObject(extra.authorityAccessPosture)
    ? extra.authorityAccessPosture
    : surfaceAppAuthorityAccessPosture(surfaceApp, {
      ...(isObject(extra.authorityAccessOptions) ? extra.authorityAccessOptions : {}),
      fulfillmentIdentityPosture,
      secretBoundary: extra.serviceManagerSecretBoundary || contract.secretBoundary,
      issuedAt: extra.issuedAt,
    });
  return Object.freeze({
    kind: "surface.app.attachContext",
    contractId: String(contract.contractId || ""),
    appId: String(contract.appId || ""),
    appRef: String(contract.appRef || ""),
    serviceContractRef: String(contract.serviceContractRef || contract.serviceRef || ""),
    serviceRef: String(contract.serviceRef || ""),
    surfaceRef: String(contract.surfaceRef || ""),
    version: String(contract.version || ""),
    displayName: String(contract.displayName || ""),
    fulfillmentIdentityPosture,
    authorityAccessPosture,
    serviceManagerActionability,
    posture: surfaceApp.posture,
    requiredModuleRoles: Object.freeze([...surfaceApp.requiredRoles]),
    moduleRefs: Object.freeze(surfaceApp.modules.map((module) => Object.freeze({
      moduleRef: module.moduleRef,
      role: module.role,
      participantSide: module.participantSide,
      fulfillmentMode: module.fulfillmentMode,
      version: module.version,
      buildId: module.buildId || "",
    }))),
    materializationBudgetRefs: Object.freeze((contract.materializationBudgets || [])
      .map((budget) => String(budget?.budgetId || "").trim())
      .filter(Boolean)),
    updatePosture: isObject(contract.updatePosture) ? Object.freeze({ ...contract.updatePosture }) : undefined,
    ...extra,
  });
}

export function surfaceAppBootstrapPosture(surfaceAppOrContract, options = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const contract = surfaceApp.contract;
  const runnerPlan = isObject(options.runnerPlan) ? options.runnerPlan : {};
  const bootstrapContract = isObject(options.bootstrapContract)
    ? options.bootstrapContract
    : (isObject(runnerPlan.bootstrapContract) ? runnerPlan.bootstrapContract : {});
  const releaseContract = isObject(options.releaseContract)
    ? options.releaseContract
    : (isObject(bootstrapContract.releaseContract)
      ? bootstrapContract.releaseContract
      : (isObject(runnerPlan.releaseContract) ? runnerPlan.releaseContract : {}));
  const labProof = isObject(options.labProof)
    ? options.labProof
    : (isObject(runnerPlan.labProof) ? runnerPlan.labProof : {});
  const proofDigest = isObject(options.proofDigest)
    ? options.proofDigest
    : (isObject(runnerPlan.proofDigest) ? runnerPlan.proofDigest : {});
  const trainDigest = isObject(options.trainDigest)
    ? options.trainDigest
    : (isObject(runnerPlan.trainDigest) ? runnerPlan.trainDigest : {});
  const bootstrapPosture = isObject(options.bootstrapPosture)
    ? options.bootstrapPosture
    : (isObject(contract.bootstrapPosture) ? contract.bootstrapPosture : {});
  const serviceManagerPosture = isObject(options.serviceManagerPosture)
    ? options.serviceManagerPosture
    : (isObject(contract.serviceManagerPosture) ? contract.serviceManagerPosture : {});
  const secretBoundary = isObject(options.secretBoundary)
    ? options.secretBoundary
    : (isObject(options.secretBoundaryRecord)
      ? options.secretBoundaryRecord
      : (isObject(runnerPlan.secretBoundary)
        ? runnerPlan.secretBoundary
        : (isObject(bootstrapContract.secretBoundary)
          ? bootstrapContract.secretBoundary
          : (isObject(contract.secretBoundary) ? contract.secretBoundary : {}))));
  const releasePosture = isObject(options.releasePosture)
    ? options.releasePosture
    : (isObject(releaseContract.releasePosture)
      ? releaseContract.releasePosture
      : (isObject(contract.releasePosture) ? contract.releasePosture : {}));
  const rollbackPosture = isObject(options.rollbackPosture)
    ? options.rollbackPosture
    : (isObject(releaseContract.rollbackPosture)
      ? releaseContract.rollbackPosture
      : (isObject(contract.rollbackPosture) ? contract.rollbackPosture : {}));
  const sourceMode = String(options.sourceMode
    || bootstrapPosture.sourceMode
    || bootstrapContract.sourceMode
    || runnerPlan.sourceMode
    || dominantFulfillmentMode(surfaceApp.modules)
    || "bundled");
  const bootstrapContractRef = String(options.bootstrapContractRef
    || bootstrapContract.bootstrapContractId
    || bootstrapContract.contractId
    || "").trim();
  const releaseContractRef = String(options.releaseContractRef
    || bootstrapContract.releaseContractRef
    || releaseContract.contractId
    || releasePosture.contractId
    || "").trim();
  const secretBoundaryRef = String(options.secretBoundaryRef
    || bootstrapContract.secretBoundaryRef
    || secretBoundary.boundaryId
    || "").trim();
  const trainDigestRef = String(options.trainDigestRef
    || bootstrapContract.trainDigestRef
    || trainDigest.trainId
    || "").trim();
  const labProofRefs = uniqueStrings([
    labProof.proofId,
    ...normalizeStringArray(releaseContract.labProofRefs),
    ...normalizeStringArray(options.labProofRefs),
  ]);
  const proofDigestRefs = uniqueStrings([
    proofDigest.digestId,
    ...normalizeStringArray(releaseContract.proofDigestRefs),
    ...normalizeStringArray(trainDigest.proofDigestRefs),
    ...normalizeStringArray(options.proofDigestRefs),
  ]);
  const compatibilityRefs = uniqueStrings([
    ...normalizeStringArray(releaseContract.compatibilityRefs),
    ...normalizeStringArray(options.compatibilityRefs),
  ]);
  const blockedReasons = uniqueStrings([
    ...surfaceApp.missingRoles.map((role) => `missingModuleRole:${role}`),
    ...postureBlockedReasons(bootstrapPosture, "bootstrap"),
    ...postureBlockedReasons(bootstrapContract, "bootstrapContract"),
    ...postureBlockedReasons(serviceManagerPosture, "serviceManager"),
    ...postureBlockedReasons(secretBoundary, "secretBoundary"),
    ...postureBlockedReasons(releasePosture, "release"),
    ...postureBlockedReasons(releaseContract, "releaseContract"),
    ...postureBlockedReasons(rollbackPosture, "rollback"),
    ...postureBlockedReasons(labProof, "labProof"),
    ...postureBlockedReasons(proofDigest, "proofDigest"),
    ...postureBlockedReasons(trainDigest, "trainDigest"),
    ...(nonBundledSourceMode(sourceMode) && !bootstrapContractRef ? ["missingBootstrapContract"] : []),
    ...(nonBundledSourceMode(sourceMode) && !releaseContractRef ? ["missingReleaseContractRef"] : []),
    ...(Boolean(options.requireBootstrapContract) && !bootstrapContractRef ? ["missingBootstrapContract"] : []),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const degraded = postureIsDegraded(bootstrapPosture)
    || postureIsDegraded(bootstrapContract)
    || postureIsDegraded(serviceManagerPosture)
    || postureIsDegraded(releasePosture)
    || postureIsDegraded(releaseContract)
    || postureIsDegraded(rollbackPosture)
    || postureIsDegraded(labProof)
    || postureIsDegraded(proofDigest)
    || postureIsDegraded(trainDigest);
  const moduleRefs = uniqueStrings([
    ...surfaceApp.modules.map((module) => module.moduleRef),
    ...normalizeStringArray(bootstrapPosture.moduleRefs),
    ...normalizeStringArray(bootstrapContract.moduleRefs),
    ...normalizeStringArray(options.moduleRefs),
  ]);
  const issuedAt = Number(options.issuedAt || bootstrapPosture.issuedAt || bootstrapContract.issuedAt || runnerPlan.issuedAt || contract.issuedAt || Date.now());
  const record = {
    kind: "surface.app.bootstrap.posture",
    bootstrapId: String(options.bootstrapId || bootstrapPosture.bootstrapId || `bootstrap:${contract.contractId || contract.appId || "surface-app"}`),
    contractId: String(contract.contractId || ""),
    appId: String(contract.appId || ""),
    state: blockedReasons.length ? "blocked" : (degraded ? "degraded" : "ready"),
    sourceMode,
    moduleRefs,
    secretBoundary: deepFreeze(Object.keys(secretBoundary).length ? { ...secretBoundary } : { state: "notRequired" }),
    releasePosture: deepFreeze(Object.keys(releasePosture).length ? { ...releasePosture } : { state: "static" }),
    blockedReasons,
    evidenceRefs: uniqueStrings([
      ...normalizeStringArray(bootstrapPosture.evidenceRefs),
      ...normalizeStringArray(serviceManagerPosture.evidenceRefs),
      ...normalizeStringArray(secretBoundary.evidenceRefs),
      ...normalizeStringArray(releasePosture.evidenceRefs),
      ...normalizeStringArray(releaseContract.evidenceRefs),
      ...normalizeStringArray(rollbackPosture.evidenceRefs),
      ...normalizeStringArray(bootstrapContract.evidenceRefs),
      ...normalizeStringArray(labProof.evidenceRefs),
      ...normalizeStringArray(proofDigest.evidenceRefs),
      ...normalizeStringArray(trainDigest.evidenceRefs),
      ...normalizeStringArray(options.evidenceRefs),
    ]),
    issuedAt,
    expiresAt: options.expiresAt || bootstrapPosture.expiresAt || contract.expiresAt,
  };
  assignIfPresent(record, "serviceManagerRef", options.serviceManagerRef || bootstrapPosture.serviceManagerRef || serviceManagerPosture.managerId);
  assignIfPresent(record, "bootstrapContractRef", bootstrapContractRef);
  assignIfPresent(record, "releaseContractRef", releaseContractRef);
  assignIfPresent(record, "secretBoundaryRef", secretBoundaryRef);
  assignIfPresent(record, "trainDigestRef", trainDigestRef);
  assignIfPresent(record, "labProofRefs", labProofRefs);
  assignIfPresent(record, "proofDigestRefs", proofDigestRefs);
  assignIfPresent(record, "compatibilityRefs", compatibilityRefs);
  assignObjectIfPresent(record, "serviceManagerPosture", serviceManagerPosture);
  assignObjectIfPresent(record, "rollbackPosture", rollbackPosture);
  assignObjectIfPresent(record, "bootstrapContract", bootstrapContract);
  return deepFreeze(record);
}

export function surfaceServiceManagerOperationPosture(surfaceAppOrContract, options = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const contract = surfaceApp.contract;
  const serviceManagerPosture = isObject(options.serviceManagerPosture)
    ? options.serviceManagerPosture
    : (isObject(contract.serviceManagerPosture) ? contract.serviceManagerPosture : {});
  const releasePosture = isObject(options.releasePosture)
    ? options.releasePosture
    : (isObject(contract.releasePosture) ? contract.releasePosture : {});
  const secretBoundary = isObject(options.secretBoundary)
    ? options.secretBoundary
    : (isObject(contract.secretBoundary) ? contract.secretBoundary : {});
  const operation = String(options.operation || "healthCheck");
  const subjectRef = String(options.subjectRef || contract.serviceRef || contract.appRef || `surface-app:${contract.appId || contract.contractId || "unknown"}`);
  const managerId = String(options.managerId || serviceManagerPosture.managerId || serviceManagerPosture.serviceManagerRef || `manager:${contract.appId || contract.contractId || "surface-app"}`);
  const managerRef = String(options.managerRef || serviceManagerPosture.managerRef || serviceManagerPosture.managerId || managerId);
  const requesterRef = String(options.requesterRef || contract.surfaceRef || contract.appRef || `surface-app:${contract.appId || contract.contractId || "unknown"}`);
  const operationId = String(options.operationId || `operation:${contract.contractId || contract.appId || "surface-app"}:${operation}`);
  const grantRefs = uniqueStrings([
    ...normalizeStringArray(serviceManagerPosture.grantRefs),
    ...normalizeStringArray(options.grantRefs),
  ]);
  const resourceBudget = isObject(options.resourceBudget)
    ? options.resourceBudget
    : (isObject(serviceManagerPosture.resourceBudget) ? serviceManagerPosture.resourceBudget : null);
  const resourcePosture = isObject(options.resourcePosture)
    ? options.resourcePosture
    : (isObject(serviceManagerPosture.resourcePosture) ? serviceManagerPosture.resourcePosture : null);
  const blockedReasons = uniqueStrings([
    ...surfaceApp.missingRoles.map((role) => `missingModuleRole:${role}`),
    ...postureBlockedReasons(serviceManagerPosture, "serviceManager"),
    ...postureBlockedReasons(releasePosture, "release"),
    ...postureBlockedReasons(secretBoundary, "secretBoundary"),
    ...(operation === "rollback" && !String(options.rollbackRef || releasePosture.rollbackRef || "").trim() ? ["missingRollbackRef"] : []),
    ...(operation === "release" && !String(options.releaseRef || releasePosture.releaseRef || "").trim() ? ["missingReleaseRef"] : []),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const requestedAt = Number(options.requestedAt || Date.now());
  const requestedState = String(options.state || "");
  const state = blockedReasons.length && !["blocked", "failed", "cancelled", "superseded"].includes(requestedState)
    ? "blocked"
    : (requestedState || (blockedReasons.length ? "blocked" : "requested"));
  const record = {
    kind: "service.manager.operation.posture",
    operationId,
    managerId,
    subjectRef,
    managerRef,
    requesterRef,
    operation,
    state,
    serviceRefs: uniqueStrings([
      ...normalizeStringArray(serviceManagerPosture.serviceRefs),
      ...normalizeStringArray(options.serviceRefs),
      contract.serviceRef,
    ]),
    capabilityRefs: uniqueStrings([
      ...normalizeStringArray(serviceManagerPosture.capabilityRefs),
      ...normalizeStringArray(options.capabilityRefs),
    ]),
    authorityRefs: uniqueStrings([
      ...normalizeStringArray(secretBoundary.authorityRefs),
      ...normalizeStringArray(options.authorityRefs),
    ]),
    secretBoundary: deepFreeze(Object.keys(secretBoundary).length ? { ...secretBoundary } : { state: "notRequired" }),
    releasePosture: Object.keys(releasePosture).length ? deepFreeze({ ...releasePosture }) : undefined,
    evidenceRefs: uniqueStrings([
      ...normalizeStringArray(serviceManagerPosture.evidenceRefs),
      ...normalizeStringArray(releasePosture.evidenceRefs),
      ...normalizeStringArray(options.evidenceRefs),
    ]),
    proofRefs: uniqueStrings([
      ...normalizeStringArray(options.proofRefs),
      ...normalizeStringArray(options.artifactRefs),
    ]),
    witnessRefs: uniqueStrings([
      ...normalizeStringArray(serviceManagerPosture.witnessRefs),
      ...normalizeStringArray(options.witnessRefs),
    ]),
    retentionRefs: uniqueStrings([
      ...normalizeStringArray(serviceManagerPosture.retentionRefs),
      ...normalizeStringArray(options.retentionRefs),
    ]),
    releaseWitnessRefs: uniqueStrings([
      ...normalizeStringArray(serviceManagerPosture.releaseWitnessRefs),
      ...normalizeStringArray(options.releaseWitnessRefs),
    ]),
    blockedReasons,
    safeFacts: isObject(options.safeFacts) ? deepFreeze({ ...options.safeFacts }) : undefined,
    requestedAt,
    acceptedAt: options.acceptedAt,
    startedAt: options.startedAt,
    completedAt: options.completedAt,
    observedAt: options.observedAt,
    expiresAt: options.expiresAt || serviceManagerPosture.expiresAt || contract.expiresAt,
  };
  assignIfPresent(record, "releaseRef", options.releaseRef || releasePosture.releaseRef);
  assignIfPresent(record, "rollbackRef", options.rollbackRef || releasePosture.rollbackRef);
  assignIfPresent(record, "runnerOperationRef", options.runnerOperationRef);
  const runnerRef = String(options.runnerRef || serviceManagerPosture.runnerRef || "").trim();
  if (runnerRef) record.runnerRef = requireResolvedMemberRef(runnerRef, "service manager operation runnerRef");
  assignIfPresent(record, "hostRef", options.hostRef || serviceManagerPosture.hostRef);
  if (grantRefs.length) record.grantRefs = grantRefs;
  assignObjectIfPresent(record, "resourceBudget", resourceBudget);
  assignObjectIfPresent(record, "resourcePosture", resourcePosture);
  if (isObject(options.rollbackPosture)) record.rollbackPosture = deepFreeze({ ...options.rollbackPosture });
  else if (isObject(contract.rollbackPosture)) record.rollbackPosture = deepFreeze({ ...contract.rollbackPosture });
  return deepFreeze(record);
}

export function surfaceServiceManagerProofDigest(surfaceAppOrContract, options = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const contract = surfaceApp.contract;
  const operationPosture = isObject(options.operationPosture) ? options.operationPosture : {};
  const serviceManagerPosture = isObject(options.serviceManagerPosture)
    ? options.serviceManagerPosture
    : (isObject(contract.serviceManagerPosture) ? contract.serviceManagerPosture : {});
  const operationId = String(options.operationId || operationPosture.operationId || `operation:${contract.contractId || contract.appId || "surface-app"}:proof`);
  const managerId = String(options.managerId || operationPosture.managerId || serviceManagerPosture.managerId || `manager:${contract.appId || contract.contractId || "surface-app"}`);
  const subjectRef = String(options.subjectRef || operationPosture.subjectRef || contract.serviceRef || contract.appRef || `surface-app:${contract.appId || contract.contractId || "unknown"}`);
  const artifactRefs = uniqueStrings(normalizeStringArray(options.artifactRefs));
  const proofRefs = uniqueStrings(normalizeStringArray(options.proofRefs));
  const blockedReasons = uniqueStrings([
    ...postureBlockedReasons(operationPosture, "operation"),
    ...postureBlockedReasons(serviceManagerPosture, "serviceManager"),
    ...(String(options.state || "") === "proved" && !artifactRefs.length && !proofRefs.length ? ["missingProofRefs"] : []),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const requestedState = String(options.state || "");
  const state = blockedReasons.length && !["blocked", "failed", "expired"].includes(requestedState)
    ? "blocked"
    : (requestedState || (blockedReasons.length ? "blocked" : "pending"));
  const record = {
    kind: "service.manager.proof.digest",
    digestId: String(options.digestId || `proof-digest:${contract.contractId || contract.appId || "surface-app"}:${operationId}`),
    operationId,
    managerId,
    subjectRef,
    state,
    commitRefs: uniqueStrings(normalizeStringArray(options.commitRefs)),
    artifactRefs,
    proofRefs,
    metricsRefs: uniqueStrings(normalizeStringArray(options.metricsRefs)),
    environmentRefs: uniqueStrings(normalizeStringArray(options.environmentRefs)),
    serviceRefs: uniqueStrings([
      ...normalizeStringArray(operationPosture.serviceRefs),
      ...normalizeStringArray(serviceManagerPosture.serviceRefs),
      ...normalizeStringArray(options.serviceRefs),
      contract.serviceRef,
    ]),
    evidenceRefs: uniqueStrings([
      ...normalizeStringArray(operationPosture.evidenceRefs),
      ...normalizeStringArray(serviceManagerPosture.evidenceRefs),
      ...normalizeStringArray(options.evidenceRefs),
    ]),
    blockedReasons,
    observedAt: Number(options.observedAt || Date.now()),
  };
  assignIfPresent(record, "trainRef", options.trainRef);
  assignIfPresent(record, "releaseRef", options.releaseRef || operationPosture.releaseRef);
  assignIfPresent(record, "rollbackRef", options.rollbackRef || operationPosture.rollbackRef);
  assignObjectIfPresent(record, "safeFacts", options.safeFacts);
  assignIfPresent(record, "expiresAt", options.expiresAt || operationPosture.expiresAt || contract.expiresAt);
  return deepFreeze(record);
}

export function surfaceRunnerOperation(surfaceAppOrContract, options = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const contract = surfaceApp.contract;
  const serviceManagerPosture = isObject(options.serviceManagerPosture)
    ? options.serviceManagerPosture
    : (isObject(contract.serviceManagerPosture) ? contract.serviceManagerPosture : {});
  const operationPosture = isObject(options.operationPosture)
    ? options.operationPosture
    : surfaceServiceManagerOperationPosture(surfaceApp, options);
  const runnerRef = requireResolvedMemberRef(
    options.runnerRef
      || operationPosture.runnerRef
      || serviceManagerPosture.runnerRef
      || serviceManagerPosture.memberRef,
    "surface runner operation runnerRef",
  );
  const grantRefs = uniqueStrings([
    ...normalizeStringArray(serviceManagerPosture.grantRefs),
    ...normalizeStringArray(operationPosture.grantRefs),
    ...normalizeStringArray(options.grantRefs),
  ]);
  if (!grantRefs.length) throw new Error("surface runner operation requires grantRefs");
  const resourceBudget = isObject(options.resourceBudget)
    ? options.resourceBudget
    : (isObject(operationPosture.resourceBudget)
      ? operationPosture.resourceBudget
      : (isObject(serviceManagerPosture.resourceBudget) ? serviceManagerPosture.resourceBudget : null));
  if (!isObject(resourceBudget)) throw new Error("surface runner operation requires resourceBudget");
  const runnerOperation = serviceManagerOperationToRunnerOperation(options.runnerOperation || operationPosture.operation);
  const runnerState = serviceManagerStateToRunnerState(options.runnerState || operationPosture.state, runnerOperation);
  const releasePosture = isObject(options.releasePosture)
    ? options.releasePosture
    : (isObject(operationPosture.releasePosture)
      ? operationPosture.releasePosture
      : (isObject(contract.releasePosture) ? contract.releasePosture : {}));
  const rollbackPosture = isObject(options.rollbackPosture)
    ? options.rollbackPosture
    : (isObject(operationPosture.rollbackPosture)
      ? operationPosture.rollbackPosture
      : (isObject(contract.rollbackPosture) ? contract.rollbackPosture : {}));
  const secretBoundary = isObject(options.secretBoundary)
    ? options.secretBoundary
    : (isObject(operationPosture.secretBoundary)
      ? operationPosture.secretBoundary
      : (isObject(contract.secretBoundary) ? contract.secretBoundary : { state: "notRequired" }));
  const requestedAt = Number(options.requestedAt || operationPosture.requestedAt || Date.now());
  const blockedReasons = uniqueStrings([
    ...normalizeStringArray(operationPosture.blockedReasons),
    ...postureBlockedReasons(serviceManagerPosture, "serviceManager"),
    ...postureBlockedReasons(secretBoundary, "secretBoundary"),
    ...postureBlockedReasons(releasePosture, "release"),
    ...postureBlockedReasons(rollbackPosture, "rollback"),
    ...(runnerOperation === "rollback" && !String(options.rollbackRef || operationPosture.rollbackRef || releasePosture.rollbackRef || rollbackPosture.rollbackRef || "").trim()
      ? ["missingRollbackRef"]
      : []),
    ...(runnerOperation === "release" && !String(options.releaseRef || operationPosture.releaseRef || releasePosture.releaseRef || "").trim()
      ? ["missingReleaseRef"]
      : []),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const state = blockedReasons.length && !["blocked", "failed", "rejected", "cancelled", "superseded"].includes(runnerState)
    ? "blocked"
    : runnerState;
  const record = {
    kind: "runner.operation",
    operationId: String(options.operationId || options.runnerOperationId || `runner-operation:${contract.contractId || contract.appId || "surface-app"}:${operationPosture.operationId || runnerOperation}`),
    runnerId: String(options.runnerId || serviceManagerPosture.runnerId || `runner:${serviceManagerPosture.managerId || contract.appId || contract.contractId || "surface-app"}`),
    runnerRef,
    hostRef: String(options.hostRef || operationPosture.hostRef || serviceManagerPosture.hostRef || serviceManagerPosture.managerRef || serviceManagerPosture.managerId || ""),
    requesterRef: String(options.requesterRef || operationPosture.requesterRef || contract.surfaceRef || contract.appRef || ""),
    subjectRef: String(options.subjectRef || operationPosture.subjectRef || contract.serviceRef || contract.appRef || `surface-app:${contract.appId || contract.contractId || "unknown"}`),
    contractRef: String(options.contractRef || operationPosture.contractRef || surfaceAppContractRef(contract)),
    operation: runnerOperation,
    state,
    grantRefs,
    capabilityRefs: uniqueStrings([
      ...normalizeStringArray(serviceManagerPosture.capabilityRefs),
      ...normalizeStringArray(operationPosture.capabilityRefs),
      ...normalizeStringArray(options.capabilityRefs),
    ]),
    inputRefs: uniqueStrings(normalizeStringArray(options.inputRefs)),
    outputRefs: uniqueStrings(normalizeStringArray(options.outputRefs)),
    evidenceRefs: uniqueStrings([
      ...normalizeStringArray(operationPosture.evidenceRefs),
      ...normalizeStringArray(options.evidenceRefs),
    ]),
    proofRefs: uniqueStrings([
      ...normalizeStringArray(operationPosture.proofRefs),
      ...normalizeStringArray(options.proofRefs),
      ...normalizeStringArray(options.artifactRefs),
    ]),
    releaseRefs: uniqueStrings([
      ...normalizeStringArray(operationPosture.releaseRefs),
      ...normalizeStringArray(options.releaseRefs),
    ]),
    resourceBudget: deepFreeze({ ...resourceBudget }),
    resourcePosture: isObject(options.resourcePosture)
      ? deepFreeze({ ...options.resourcePosture })
      : (isObject(operationPosture.resourcePosture) ? deepFreeze({ ...operationPosture.resourcePosture }) : undefined),
    secretBoundary: deepFreeze({ ...secretBoundary }),
    releasePosture: Object.keys(releasePosture).length ? deepFreeze({ ...releasePosture }) : undefined,
    rollbackPosture: Object.keys(rollbackPosture).length ? deepFreeze({ ...rollbackPosture }) : undefined,
    blockedReasons,
    safeFacts: isObject(options.safeFacts) ? deepFreeze({ ...options.safeFacts }) : undefined,
    requestedAt,
    acceptedAt: options.acceptedAt || operationPosture.acceptedAt,
    startedAt: options.startedAt || operationPosture.startedAt,
    completedAt: options.completedAt || operationPosture.completedAt,
    observedAt: options.observedAt || operationPosture.observedAt,
    expiresAt: options.expiresAt || operationPosture.expiresAt || serviceManagerPosture.expiresAt || contract.expiresAt,
  };
  assignIfPresent(record, "releaseRef", options.releaseRef || operationPosture.releaseRef || releasePosture.releaseRef);
  assignIfPresent(record, "rollbackRef", options.rollbackRef || operationPosture.rollbackRef || releasePosture.rollbackRef || rollbackPosture.rollbackRef);
  return deepFreeze(record);
}

export function surfaceServiceManagerSecretBoundary(surfaceAppOrContract, options = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const contract = surfaceApp.contract;
  const secretBoundary = isObject(options.secretBoundary)
    ? options.secretBoundary
    : (isObject(contract.secretBoundary) ? contract.secretBoundary : {});
  const serviceManagerPosture = isObject(options.serviceManagerPosture)
    ? options.serviceManagerPosture
    : (isObject(contract.serviceManagerPosture) ? contract.serviceManagerPosture : {});
  const secretRefs = uniqueStrings([
    ...normalizeStringArray(secretBoundary.secretRefs),
    ...normalizeStringArray(options.secretRefs),
  ]);
  const accessGroupRefs = uniqueStrings([
    ...normalizeStringArray(secretBoundary.accessGroupRefs),
    ...normalizeStringArray(options.accessGroupRefs),
  ]);
  const blockedReasons = uniqueStrings([
    ...postureBlockedReasons(secretBoundary, "secretBoundary"),
    ...normalizeStringArray(secretBoundary.blockedReasons),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const explicitState = String(options.state || secretBoundary.state || "").trim();
  const required = Boolean(options.required ?? secretBoundary.required ?? false);
  if (explicitState === "resolved" && !secretRefs.length && !accessGroupRefs.length) {
    blockedReasons.push("missingSecretOrAccessGroupRef");
  } else if (required && !secretRefs.length && !accessGroupRefs.length) {
    blockedReasons.push("missingSecretOrAccessGroupRef");
  }
  const state = blockedReasons.length
    ? "blocked"
    : (explicitState || (secretRefs.length || accessGroupRefs.length ? "resolved" : "notRequired"));
  return deepFreeze({
    kind: "service.manager.secretBoundary",
    boundaryId: String(options.boundaryId || secretBoundary.boundaryId || `secret-boundary:${contract.contractId || contract.appId || "surface-app"}`),
    managerId: String(options.managerId || serviceManagerPosture.managerId || `manager:${contract.appId || contract.contractId || "surface-app"}`),
    subjectRef: surfaceSubjectRef(contract, options.subjectRef),
    state,
    secretRefs,
    accessGroupRefs,
    authorityRefs: uniqueStrings([
      ...normalizeStringArray(secretBoundary.authorityRefs),
      ...normalizeStringArray(options.authorityRefs),
    ]),
    evidenceRefs: uniqueStrings([
      ...normalizeStringArray(secretBoundary.evidenceRefs),
      ...normalizeStringArray(options.evidenceRefs),
    ]),
    blockedReasons,
    safeFacts: isObject(options.safeFacts) ? deepFreeze({ ...options.safeFacts }) : undefined,
    issuedAt: Number(options.issuedAt || secretBoundary.issuedAt || Date.now()),
    expiresAt: options.expiresAt || secretBoundary.expiresAt || contract.expiresAt,
  });
}

export function surfaceServiceManagerReleaseContract(surfaceAppOrContract, options = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const contract = surfaceApp.contract;
  const releasePosture = isObject(options.releasePosture)
    ? options.releasePosture
    : (isObject(contract.releasePosture) ? contract.releasePosture : {});
  const rollbackPosture = isObject(options.rollbackPosture)
    ? options.rollbackPosture
    : (isObject(contract.rollbackPosture) ? contract.rollbackPosture : {});
  const serviceManagerPosture = isObject(options.serviceManagerPosture)
    ? options.serviceManagerPosture
    : (isObject(contract.serviceManagerPosture) ? contract.serviceManagerPosture : {});
  const secretBoundary = isObject(options.secretBoundaryRecord)
    ? options.secretBoundaryRecord
    : surfaceServiceManagerSecretBoundary(surfaceApp, {
      secretBoundary: isObject(options.secretBoundary) ? options.secretBoundary : contract.secretBoundary,
      serviceManagerPosture,
      required: Boolean(options.secretBoundaryRequired ?? false),
      issuedAt: options.issuedAt,
    });
  const sourceMode = String(options.sourceMode || dominantFulfillmentMode(surfaceApp.modules) || "bundled");
  const rollbackRequired = Boolean(options.rollbackRequired ?? releasePosture.rollbackRequired ?? sourceMode !== "bundled");
  const buildRef = String(options.buildRef || releasePosture.buildRef || "").trim();
  const releaseRef = String(options.releaseRef || releasePosture.releaseRef || "").trim();
  const rollbackRef = String(options.rollbackRef || rollbackPosture.rollbackRef || releasePosture.rollbackRef || "").trim();
  const blockedReasons = uniqueStrings([
    ...surfaceApp.missingRoles.map((role) => `missingModuleRole:${role}`),
    ...postureBlockedReasons(releasePosture, "release"),
    ...postureBlockedReasons(rollbackPosture, "rollback"),
    ...postureBlockedReasons(secretBoundary, "secretBoundary"),
    ...normalizeStringArray(releasePosture.blockedReasons),
    ...normalizeStringArray(rollbackPosture.blockedReasons),
    ...(!buildRef ? ["missingBuildRef"] : []),
    ...(!releaseRef ? ["missingReleaseRef"] : []),
    ...(rollbackRequired && !rollbackRef ? ["missingRollbackRef"] : []),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const explicitState = String(options.state || "").trim();
  const state = blockedReasons.length
    ? "blocked"
    : (explicitState || "ready");
  const record = {
    kind: "service.manager.release.contract",
    contractId: String(options.contractId || releasePosture.contractId || `release-contract:${contract.contractId || contract.appId || "surface-app"}`),
    managerId: String(options.managerId || serviceManagerPosture.managerId || `manager:${contract.appId || contract.contractId || "surface-app"}`),
    subjectRef: surfaceSubjectRef(contract, options.subjectRef),
    managerRef: String(options.managerRef || serviceManagerPosture.managerRef || serviceManagerPosture.managerId || serviceManagerPosture.serviceManagerRef || `manager:${contract.appId || contract.contractId || "surface-app"}`),
    state,
    appContractRef: surfaceAppContractRef(contract, options.appContractRef),
    version: String(options.version || contract.version || ""),
    rollbackRequired,
    compatibilityRefs: uniqueStrings([
      ...normalizeStringArray(releasePosture.compatibilityRefs),
      ...normalizeStringArray(options.compatibilityRefs),
    ]),
    authorityRefs: uniqueStrings([
      ...normalizeStringArray(secretBoundary.authorityRefs),
      ...normalizeStringArray(releasePosture.authorityRefs),
      ...normalizeStringArray(options.authorityRefs),
    ]),
    secretBoundaryRefs: uniqueStrings([
      secretBoundary.boundaryId,
      ...normalizeStringArray(releasePosture.secretBoundaryRefs),
      ...normalizeStringArray(options.secretBoundaryRefs),
    ]),
    proofDigestRefs: uniqueStrings([
      ...normalizeStringArray(releasePosture.proofDigestRefs),
      ...normalizeStringArray(options.proofDigestRefs),
    ]),
    labProofRefs: uniqueStrings([
      ...normalizeStringArray(releasePosture.labProofRefs),
      ...normalizeStringArray(options.labProofRefs),
    ]),
    evidenceRefs: uniqueStrings([
      ...normalizeStringArray(releasePosture.evidenceRefs),
      ...normalizeStringArray(rollbackPosture.evidenceRefs),
      ...normalizeStringArray(options.evidenceRefs),
    ]),
    blockedReasons,
    secretBoundary,
    issuedAt: Number(options.issuedAt || releasePosture.issuedAt || Date.now()),
  };
  assignIfPresent(record, "buildRef", buildRef);
  assignIfPresent(record, "releaseRef", releaseRef);
  assignIfPresent(record, "rollbackRef", rollbackRef);
  assignObjectIfPresent(record, "releasePosture", releasePosture);
  assignObjectIfPresent(record, "rollbackPosture", rollbackPosture);
  assignObjectIfPresent(record, "safeFacts", options.safeFacts);
  assignIfPresent(record, "expiresAt", options.expiresAt || releasePosture.expiresAt || contract.expiresAt);
  return deepFreeze(record);
}

export function surfaceServiceManagerLabProof(surfaceAppOrContract, options = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const contract = surfaceApp.contract;
  const serviceManagerPosture = isObject(options.serviceManagerPosture)
    ? options.serviceManagerPosture
    : (isObject(contract.serviceManagerPosture) ? contract.serviceManagerPosture : {});
  const artifactRefs = uniqueStrings(normalizeStringArray(options.artifactRefs));
  const metricsRefs = uniqueStrings(normalizeStringArray(options.metricsRefs));
  const proofRefs = uniqueStrings(normalizeStringArray(options.proofRefs));
  const blockedReasons = uniqueStrings([
    ...postureBlockedReasons(serviceManagerPosture, "serviceManager"),
    ...(String(options.state || "") === "proved" && !artifactRefs.length && !metricsRefs.length && !proofRefs.length ? ["missingProofRefs"] : []),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const state = blockedReasons.length ? "blocked" : String(options.state || "pending");
  const record = {
    kind: "service.manager.labProof",
    proofId: String(options.proofId || `lab-proof:${contract.contractId || contract.appId || "surface-app"}:${String(options.profile || "surfaceLandscape")}`),
    managerId: String(options.managerId || serviceManagerPosture.managerId || `manager:${contract.appId || contract.contractId || "surface-app"}`),
    subjectRef: surfaceSubjectRef(contract, options.subjectRef),
    profile: String(options.profile || "surfaceLandscape"),
    state,
    appContractRef: surfaceAppContractRef(contract, options.appContractRef),
    surfaceRefs: uniqueStrings([
      contract.surfaceRef,
      ...normalizeStringArray(options.surfaceRefs),
    ]),
    serviceRefs: uniqueStrings([
      contract.serviceRef,
      ...normalizeStringArray(options.serviceRefs),
    ]),
    environmentRefs: uniqueStrings(normalizeStringArray(options.environmentRefs)),
    artifactRefs,
    metricsRefs,
    proofRefs,
    evidenceRefs: uniqueStrings([
      ...normalizeStringArray(serviceManagerPosture.evidenceRefs),
      ...normalizeStringArray(options.evidenceRefs),
    ]),
    blockedReasons,
    startedAt: Number(options.startedAt || Date.now()),
  };
  assignIfPresent(record, "trainRef", options.trainRef);
  assignIfPresent(record, "releaseContractRef", options.releaseContractRef);
  assignObjectIfPresent(record, "safeFacts", options.safeFacts);
  assignIfPresent(record, "acceptedAt", options.acceptedAt);
  assignIfPresent(record, "completedAt", options.completedAt);
  assignIfPresent(record, "observedAt", options.observedAt);
  assignIfPresent(record, "expiresAt", options.expiresAt || contract.expiresAt);
  return deepFreeze(record);
}

export function surfaceServiceManagerTrainDigest(surfaceAppOrContract, options = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const contract = surfaceApp.contract;
  const serviceManagerPosture = isObject(options.serviceManagerPosture)
    ? options.serviceManagerPosture
    : (isObject(contract.serviceManagerPosture) ? contract.serviceManagerPosture : {});
  const releaseContractRefs = uniqueStrings(normalizeStringArray(options.releaseContractRefs));
  const labProofRefs = uniqueStrings(normalizeStringArray(options.labProofRefs));
  const proofDigestRefs = uniqueStrings(normalizeStringArray(options.proofDigestRefs));
  const blockedReasons = uniqueStrings([
    ...postureBlockedReasons(serviceManagerPosture, "serviceManager"),
    ...(String(options.state || "") === "proved" && !releaseContractRefs.length ? ["missingReleaseContractRefs"] : []),
    ...(String(options.state || "") === "proved" && !labProofRefs.length && !proofDigestRefs.length ? ["missingProofRefs"] : []),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const state = blockedReasons.length ? "blocked" : String(options.state || "pending");
  return deepFreeze({
    kind: "service.manager.train.digest",
    trainId: String(options.trainId || `train:${contract.contractId || contract.appId || "surface-app"}`),
    managerId: String(options.managerId || serviceManagerPosture.managerId || `manager:${contract.appId || contract.contractId || "surface-app"}`),
    subjectRef: surfaceSubjectRef(contract, options.subjectRef),
    state,
    repoRefs: uniqueStrings(normalizeStringArray(options.repoRefs)),
    commitRefs: uniqueStrings(normalizeStringArray(options.commitRefs)),
    appContractRefs: uniqueStrings([
      surfaceAppContractRef(contract, options.appContractRef),
      ...normalizeStringArray(options.appContractRefs),
    ]),
    releaseContractRefs,
    operationRefs: uniqueStrings(normalizeStringArray(options.operationRefs)),
    proofDigestRefs,
    labProofRefs,
    metricsRefs: uniqueStrings(normalizeStringArray(options.metricsRefs)),
    evidenceRefs: uniqueStrings([
      ...normalizeStringArray(serviceManagerPosture.evidenceRefs),
      ...normalizeStringArray(options.evidenceRefs),
    ]),
    blockedReasons,
    safeFacts: isObject(options.safeFacts) ? deepFreeze({ ...options.safeFacts }) : undefined,
    observedAt: Number(options.observedAt || Date.now()),
    expiresAt: options.expiresAt || contract.expiresAt,
  });
}

export function surfaceAppBootstrapContract(surfaceAppOrContract, options = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const contract = surfaceApp.contract;
  const sourceMode = String(options.sourceMode || dominantFulfillmentMode(surfaceApp.modules) || "bundled");
  const moduleRefs = uniqueStrings([
    ...surfaceApp.modules.map((module) => module.moduleRef),
    ...normalizeStringArray(options.moduleRefs),
  ]);
  const secretBoundary = isObject(options.secretBoundaryRecord)
    ? options.secretBoundaryRecord
    : surfaceServiceManagerSecretBoundary(surfaceApp, {
      secretBoundary: isObject(options.secretBoundary) ? options.secretBoundary : contract.secretBoundary,
      serviceManagerPosture: options.serviceManagerPosture,
      required: Boolean(options.secretBoundaryRequired ?? false),
      issuedAt: options.issuedAt,
    });
  const releaseContract = isObject(options.releaseContract)
    ? options.releaseContract
    : null;
  const releaseContractRef = String(options.releaseContractRef || releaseContract?.contractId || "").trim();
  const serviceManagerPosture = isObject(options.serviceManagerPosture)
    ? options.serviceManagerPosture
    : (isObject(contract.serviceManagerPosture) ? contract.serviceManagerPosture : {});
  const blockedReasons = uniqueStrings([
    ...surfaceApp.missingRoles.map((role) => `missingModuleRole:${role}`),
    ...postureBlockedReasons(secretBoundary, "secretBoundary"),
    ...(!moduleRefs.length ? ["missingModuleRefs"] : []),
    ...(nonBundledSourceMode(sourceMode) && !releaseContractRef ? ["missingReleaseContractRef"] : []),
    ...prefixedBlockedReasons(releaseContract, "release"),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const explicitState = String(options.state || "").trim();
  const state = blockedReasons.length
    ? "blocked"
    : (explicitState || "ready");
  const record = {
    kind: "surface.app.bootstrap.contract",
    bootstrapContractId: String(options.bootstrapContractId || `bootstrap-contract:${contract.contractId || contract.appId || "surface-app"}`),
    appContractRef: surfaceAppContractRef(contract, options.appContractRef),
    appId: String(contract.appId || ""),
    state,
    sourceMode,
    moduleRefs,
    labProofProfileRefs: uniqueStrings(normalizeStringArray(options.labProofProfileRefs)),
    authorityRefs: uniqueStrings([
      ...normalizeStringArray(secretBoundary.authorityRefs),
      ...normalizeStringArray(options.authorityRefs),
    ]),
    evidenceRefs: uniqueStrings([
      ...normalizeStringArray(serviceManagerPosture.evidenceRefs),
      ...normalizeStringArray(options.evidenceRefs),
    ]),
    blockedReasons,
    secretBoundary,
    issuedAt: Number(options.issuedAt || Date.now()),
  };
  assignIfPresent(record, "serviceManagerRef", options.serviceManagerRef || serviceManagerPosture.managerId || serviceManagerPosture.serviceManagerRef);
  assignIfPresent(record, "releaseContractRef", releaseContractRef);
  assignIfPresent(record, "secretBoundaryRef", options.secretBoundaryRef || secretBoundary.boundaryId);
  assignIfPresent(record, "trainDigestRef", options.trainDigestRef);
  assignObjectIfPresent(record, "releaseContract", releaseContract);
  assignObjectIfPresent(record, "safeFacts", options.safeFacts);
  assignIfPresent(record, "expiresAt", options.expiresAt || contract.expiresAt);
  return deepFreeze(record);
}

export function surfaceAppManifestSelection(manifest, surfaceAppsOrContracts, options = {}) {
  if (!isObject(manifest)) throw new Error("surface app manifest is required");
  const appsByRef = indexSurfaceApps(surfaceAppsOrContracts);
  const versions = Array.isArray(manifest.versions) ? manifest.versions.filter(isObject) : [];
  const requestedVersion = String(options.version || manifest.currentVersion || "").trim();
  const requestedRef = String(options.appContractRef || manifest.currentAppContractRef || "").trim();
  const claim = versions.find((entry) => (
    (!requestedRef || String(entry.appContractRef || "") === requestedRef)
    && (!requestedVersion || String(entry.version || "") === requestedVersion)
  )) || versions.find((entry) => requestedRef && String(entry.appContractRef || "") === requestedRef)
    || versions.find((entry) => requestedVersion && String(entry.version || "") === requestedVersion)
    || null;
  const appContractRef = String(options.appContractRef || claim?.appContractRef || manifest.currentAppContractRef || "").trim();
  const version = String(options.version || claim?.version || manifest.currentVersion || "").trim();
  const surfaceApp = appsByRef.get(appContractRef)
    || appsByRef.get(`${String(manifest.appId || "").trim()}@${version}`)
    || appsByRef.get(`${appContractRef}@${version}`)
    || null;
  const sourceMode = String(options.sourceMode || claim?.sourceMode || manifest.defaultSourceMode || (surfaceApp ? dominantFulfillmentMode(surfaceApp.modules) : "") || "bundled");
  const claimState = String(claim?.state || "").trim();
  const manifestState = String(manifest.state || "").trim();
  const releaseContractRef = String(options.releaseContractRef || claim?.releaseContractRef || "").trim();
  const sourceSnapshotRef = String(options.sourceSnapshotRef || claim?.sourceSnapshotRef || manifest.sourceSnapshotRef || "").trim();
  const bundledSourceRefs = uniqueStrings([
    ...normalizeStringArray(manifest.bundledSourceRefs),
    ...normalizeStringArray(claim?.bundledSourceRefs),
    ...normalizeStringArray(options.bundledSourceRefs),
  ]);
  const remoteSourceRefs = uniqueStrings([
    ...normalizeStringArray(manifest.remoteSourceRefs),
    ...normalizeStringArray(claim?.remoteSourceRefs),
    ...normalizeStringArray(options.remoteSourceRefs),
  ]);
  const storageObjectRefs = uniqueStrings([
    ...normalizeStringArray(manifest.storageObjectRefs),
    ...normalizeStringArray(claim?.storageObjectRefs),
    ...normalizeStringArray(options.storageObjectRefs),
  ]);
  const releaseSourceRefs = uniqueStrings([
    ...normalizeStringArray(manifest.releaseSourceRefs),
    ...normalizeStringArray(claim?.releaseSourceRefs),
    ...normalizeStringArray(options.releaseSourceRefs),
  ]);
  const swarmSourceRefs = uniqueStrings([
    ...normalizeStringArray(manifest.swarmSourceRefs),
    ...normalizeStringArray(claim?.swarmSourceRefs),
    ...normalizeStringArray(options.swarmSourceRefs),
  ]);
  const proofDigestRefs = uniqueStrings([
    ...normalizeStringArray(manifest.proofDigestRefs),
    ...normalizeStringArray(claim?.proofDigestRefs),
    ...normalizeStringArray(options.proofDigestRefs),
    ...[options.proofDigestRef].filter((ref) => ref),
  ]);
  const digestRefs = uniqueStrings([
    ...normalizeStringArray(manifest.digestRefs),
    ...normalizeStringArray(claim?.digestRefs),
    ...normalizeStringArray(options.digestRefs),
    ...[options.digestRef].filter((ref) => ref),
  ]);
  const signatureRefs = uniqueStrings([
    ...normalizeStringArray(manifest.signatureRefs),
    ...normalizeStringArray(claim?.signatureRefs),
    ...normalizeStringArray(options.signatureRefs),
    ...[options.signatureRef].filter((ref) => ref),
  ]);
  const publisherRefs = uniqueStrings([
    ...normalizeStringArray(manifest.publisherRefs),
    ...normalizeStringArray(claim?.publisherRefs),
    ...normalizeStringArray(options.publisherRefs),
    ...[options.publisherRef].filter((ref) => ref),
  ]);
  const sourceAuthorityRefs = uniqueStrings([
    ...normalizeStringArray(manifest.sourceAuthorityRefs),
    ...normalizeStringArray(claim?.sourceAuthorityRefs),
    ...normalizeStringArray(options.sourceAuthorityRefs),
    ...[options.sourceAuthorityRef].filter((ref) => ref),
  ]);
  const releaseEvidenceRefs = uniqueStrings([
    ...normalizeStringArray(manifest.releaseEvidenceRefs),
    ...normalizeStringArray(claim?.releaseEvidenceRefs),
    ...normalizeStringArray(options.releaseEvidenceRefs),
    ...[options.releaseEvidenceRef].filter((ref) => ref),
  ]);
  const rollbackRefs = uniqueStrings([
    ...normalizeStringArray(manifest.rollbackRefs),
    ...normalizeStringArray(claim?.rollbackRefs),
    ...normalizeStringArray(options.rollbackRefs),
    ...[options.rollbackRef].filter((ref) => ref),
  ]);
  const secretBoundaryRefs = uniqueStrings([
    ...normalizeStringArray(manifest.secretBoundaryRefs),
    ...normalizeStringArray(claim?.secretBoundaryRefs),
    ...normalizeStringArray(options.secretBoundaryRefs),
    ...[options.secretBoundaryRef].filter((ref) => ref),
  ]);
  const trustRefs = uniqueStrings([
    ...normalizeStringArray(manifest.trustRefs),
    ...normalizeStringArray(claim?.trustRefs),
    ...normalizeStringArray(options.trustRefs),
    ...[options.trustRef].filter((ref) => ref),
  ]);
  const requiredModuleRoles = uniqueStrings([
    ...normalizeStringArray(manifest.requiredModuleRoles),
    ...normalizeStringArray(claim?.requiredModuleRoles),
    ...normalizeStringArray(options.requiredModuleRoles),
  ]);
  const grantRefs = uniqueStrings([
    ...normalizeStringArray(manifest.grantRefs),
    ...normalizeStringArray(claim?.grantRefs),
    ...normalizeStringArray(options.grantRefs),
  ]);
  const runnerRequirementRefs = uniqueStrings([
    ...normalizeStringArray(manifest.runnerRequirementRefs),
    ...normalizeStringArray(claim?.runnerRequirementRefs),
    ...normalizeStringArray(options.runnerRequirementRefs),
  ]);
  const serviceManagerRequirementRefs = uniqueStrings([
    ...normalizeStringArray(manifest.serviceManagerRequirementRefs),
    ...normalizeStringArray(claim?.serviceManagerRequirementRefs),
    ...normalizeStringArray(options.serviceManagerRequirementRefs),
  ]);
  const sourceCandidatePosture = surfaceAppSourceCandidatePosture({
    sourceMode,
    sourceClass: options.sourceClass || claim?.sourceClass || manifest.sourceClass,
    appContractRef,
    bundledContractAvailable: Boolean(surfaceApp),
    bundledSourceRefs,
    remoteSourceRefs,
    storageObjectRefs,
    releaseSourceRefs,
    swarmSourceRefs,
    releaseContractRef,
    compatibilityRefs: uniqueStrings([
      ...normalizeStringArray(manifest.compatibilityRefs),
      ...normalizeStringArray(claim?.compatibilityRefs),
      ...[manifest.compatibilityWindow?.protocolRef].filter((ref) => ref),
      ...[claim?.compatibilityWindow?.protocolRef].filter((ref) => ref),
      ...[options.compatibilityWindow?.protocolRef].filter((ref) => ref),
    ]),
    digestRefs,
    signatureRefs,
    publisherRefs,
    sourceAuthorityRefs,
    releaseEvidenceRefs,
    proofDigestRefs,
    rollbackRefs,
    secretBoundaryRefs,
    trustRefs,
    evidenceRefs: uniqueStrings([
      ...normalizeStringArray(manifest.evidenceRefs),
      ...normalizeStringArray(claim?.evidenceRefs),
      ...normalizeStringArray(options.evidenceRefs),
    ]),
    blockedReasons: options.sourceCandidateBlockedReasons,
    sourceTrusted: options.sourceTrusted,
    issuedAt: Number(options.issuedAt || manifest.issuedAt || Date.now()),
    expiresAt: options.expiresAt || manifest.expiresAt,
  });
  const blockedReasons = uniqueStrings([
    ...(!appContractRef ? ["missingAppContractRef"] : []),
    ...(!version ? ["missingAppVersion"] : []),
    ...(!claim ? ["missingManifestVersion"] : []),
    ...(!surfaceApp ? ["missingBundledContract"] : []),
    ...(surfaceApp && version && String(surfaceApp.contract.version || "") !== version ? ["contractVersionMismatch"] : []),
    ...(manifestState === "blocked" ? postureBlockedReasons(manifest, "manifest") : []),
    ...(claimState === "blocked" ? postureBlockedReasons(claim, "manifestVersion") : []),
    ...(claimState === "superseded" ? ["manifestVersionSuperseded"] : []),
    ...sourceCandidatePosture.blockedReasons,
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const claimForRecord = claim && (!nonBundledSourceMode(sourceMode) || releaseContractRef)
    ? claim
    : null;
  const record = {
    kind: "surface.app.manifest.selection",
    manifestId: String(manifest.manifestId || ""),
    appId: String(manifest.appId || ""),
    state: blockedReasons.length ? "blocked" : "ready",
    appContractRef,
    version,
    sourceMode,
    claimState,
    requiredModuleRoles,
    bundledSourceRefs,
    remoteSourceRefs,
    storageObjectRefs,
    releaseSourceRefs,
    swarmSourceRefs,
    grantRefs,
    runnerRequirementRefs,
    serviceManagerRequirementRefs,
    compatibilityWindow: options.compatibilityWindow || claim?.compatibilityWindow || manifest.compatibilityWindow || undefined,
    compatibilityRefs: uniqueStrings([
      ...normalizeStringArray(manifest.compatibilityRefs),
      ...normalizeStringArray(claim?.compatibilityRefs),
      ...[manifest.compatibilityWindow?.protocolRef].filter((ref) => ref),
      ...[claim?.compatibilityWindow?.protocolRef].filter((ref) => ref),
      ...[options.compatibilityWindow?.protocolRef].filter((ref) => ref),
    ]),
    bootstrapContractRef: String(options.bootstrapContractRef || claim?.bootstrapContractRef || ""),
    releaseContractRef,
    sourceSnapshotRef,
    digestRefs,
    signatureRefs,
    publisherRefs,
    sourceAuthorityRefs,
    releaseEvidenceRefs,
    sourceCandidatePosture,
    bundledContractAvailable: Boolean(surfaceApp),
    evidenceRefs: uniqueStrings([
      ...normalizeStringArray(manifest.evidenceRefs),
      ...normalizeStringArray(claim?.evidenceRefs),
      ...normalizeStringArray(options.evidenceRefs),
    ]),
    blockedReasons,
    claim: claimForRecord ? deepFreeze({ ...claimForRecord }) : null,
    issuedAt: Number(options.issuedAt || manifest.issuedAt || Date.now()),
    expiresAt: options.expiresAt || manifest.expiresAt,
  };
  attachLocalSelectionContext(record, surfaceApp, surfaceApp?.contract || null);
  return deepFreeze(record);
}

function requirementRefs(records, keys) {
  return uniqueStrings((Array.isArray(records) ? records : [])
    .filter(isObject)
    .flatMap((entry) => keys.flatMap((key) => (
      Array.isArray(entry[key])
        ? normalizeStringArray(entry[key])
        : [entry[key]].filter((value) => value !== undefined && value !== null && value !== "").map(String)
    ))));
}

function contractAccessRefs(contract, secretBoundary = {}) {
  return uniqueStrings([
    ...normalizeStringArray(contract.accessGroupRefs),
    ...normalizeStringArray(contract.accessEpochRefs),
    ...normalizeStringArray(contract.privateEnvelopeRefs),
    ...normalizeStringArray(contract.syncRefs),
    ...normalizeStringArray(secretBoundary.accessGroupRefs),
    ...normalizeStringArray(secretBoundary.accessEpochRefs),
    ...normalizeStringArray(secretBoundary.privateEnvelopeRefs),
    ...normalizeStringArray(secretBoundary.syncRefs),
  ]);
}

export function surfaceAppContractResolution(surfaceAppOrContract, selection = {}, options = {}) {
  const surfaceApp = surfaceAppOrContract
    ? (isDefinedSurfaceApp(surfaceAppOrContract)
      ? surfaceAppOrContract
      : defineSurfaceAppContract(surfaceAppOrContract))
    : null;
  const contract = surfaceApp?.contract || {};
  const secretBoundary = isObject(options.secretBoundary)
    ? options.secretBoundary
    : (isObject(contract.secretBoundary) ? contract.secretBoundary : {});
  const compatibilityWindow = options.compatibilityWindow || selection.compatibilityWindow || contract.compatibilityWindow || {};
  const compatibilityRefs = uniqueStrings([
    ...normalizeStringArray(selection.compatibilityRefs),
    ...normalizeStringArray(contract.compatibilityRefs),
    ...[compatibilityWindow.protocolRef].filter((ref) => ref),
    ...normalizeStringArray(options.compatibilityRefs),
  ]);
  const requiredPrimitiveRefs = uniqueStrings([
    ...normalizeStringArray(contract.requiredPrimitives),
    ...(contract.activities || []).flatMap((activity) => normalizeStringArray(activity.primitiveRefs)),
    ...(contract.activityDependencies || []).flatMap((dependency) => normalizeStringArray(dependency.primitiveRefs)),
    ...((surfaceApp?.modules || []).flatMap((module) => normalizeStringArray(module.primitiveRefs))),
    ...normalizeStringArray(options.requiredPrimitiveRefs),
  ]);
  const activityRefs = uniqueStrings([
    ...normalizeStringArray(contract.activityRefs),
    ...(contract.activities || []).map((activity) => activity?.activityRef),
    ...normalizeStringArray(options.activityRefs),
  ]);
  const activityDependencyRefs = uniqueStrings([
    ...normalizeStringArray(contract.activityDependencyRefs),
    ...(contract.activityDependencies || []).map((dependency) => dependency?.dependencyRef),
    ...normalizeStringArray(options.activityDependencyRefs),
  ]);
  const activityDependencyContractRefs = uniqueStrings((contract.activityDependencies || [])
    .flatMap((dependency) => normalizeStringArray(dependency.contractRefs)));
  const moduleRoleClaims = deepFreeze((surfaceApp?.modules || []).map((module) => ({
    role: String(module.role || ""),
    moduleRef: String(module.moduleRef || ""),
    participantSide: String(module.participantSide || ""),
    fulfillmentMode: String(module.fulfillmentMode || ""),
    version: String(module.version || ""),
    primitiveRefs: Object.freeze(normalizeStringArray(module.primitiveRefs)),
  })));
  const permissionRequirementRefs = requirementRefs(contract.permissionRequirements, [
    "requirementRef",
    "permissionRef",
    "grantRef",
    "authorityRef",
  ]);
  const activityPermissionRefs = uniqueStrings((contract.activities || [])
    .flatMap((activity) => normalizeStringArray(activity.permissionRefs)));
  const dependencyPermissionRefs = uniqueStrings((contract.activityDependencies || [])
    .flatMap((dependency) => normalizeStringArray(dependency.permissionRefs)));
  const capabilityRequirementRefs = requirementRefs(contract.capabilityRequirements, [
    "requirementRef",
    "capabilityRef",
  ]);
  const projectionSubscriptionRefs = requirementRefs(contract.projectionSubscriptions, [
    "subscriptionRef",
    "projectionRef",
    "channelRef",
    "projectionId",
  ]);
  const materializationBudgetRefs = uniqueStrings([
    ...(contract.materializationBudgets || []).map((budget) => budget?.budgetId),
    ...(contract.activities || []).flatMap((activity) => normalizeStringArray(activity.materializationRefs)),
    ...(contract.activityDependencies || []).flatMap((dependency) => normalizeStringArray(dependency.materializationRefs)),
    ...normalizeStringArray(options.materializationBudgetRefs),
  ]);
  const accessRequirementRefs = uniqueStrings([
    ...contractAccessRefs(contract, secretBoundary),
    ...(contract.activities || []).flatMap((activity) => normalizeStringArray(activity.accessGroupRefs)),
    ...(contract.activityDependencies || []).flatMap((dependency) => normalizeStringArray(dependency.accessGroupRefs)),
  ]);
  const blockedReasons = uniqueStrings([
    ...(!surfaceApp ? ["missingAppContract"] : []),
    ...(selection.state === "blocked" ? normalizeStringArray(selection.blockedReasons).map((reason) => `selection:${reason}`) : []),
    ...(!moduleRoleClaims.length ? ["missingModuleClaims"] : []),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  return deepFreeze({
    kind: "surface.app.contract.resolution",
    state: blockedReasons.length ? "blocked" : "ready",
    appId: String(selection.appId || contract.appId || ""),
    appContractRef: String(selection.appContractRef || contract.appRef || contract.contractId || ""),
    version: String(selection.version || contract.version || ""),
    sourceMode: String(selection.sourceMode || dominantFulfillmentMode(surfaceApp?.modules || []) || "bundled"),
    activityRefs,
    activityDependencyRefs,
    activityDependencyContractRefs,
    requiredPrimitiveRefs,
    requiredModuleRoles: uniqueStrings([
      ...normalizeStringArray(selection.requiredModuleRoles),
      ...(surfaceApp?.requiredRoles || []),
    ]),
    moduleRoleClaims,
    permissionRequirementRefs: uniqueStrings([
      ...permissionRequirementRefs,
      ...activityPermissionRefs,
      ...dependencyPermissionRefs,
    ]),
    capabilityRequirementRefs,
    projectionSubscriptionRefs,
    materializationBudgetRefs,
    actionGrantRefs: uniqueStrings([
      ...normalizeStringArray(selection.grantRefs),
      ...normalizeStringArray(contract.grantRefs),
    ]),
    accessRequirementRefs,
    requiredContentClasses: uniqueStrings([
      ...normalizeStringArray(contract.requiredContentClasses),
      ...normalizeStringArray(secretBoundary.requiredContentClasses),
    ]),
    compatibilityRefs,
    compatibilityState: String(options.compatibilityResult?.state || "unchecked"),
    blockedReasons,
    safeFacts: {
      primitiveRefCount: requiredPrimitiveRefs.length,
      activityRefCount: activityRefs.length,
      activityDependencyRefCount: activityDependencyRefs.length,
      moduleClaimCount: moduleRoleClaims.length,
      permissionRequirementCount: uniqueStrings([...permissionRequirementRefs, ...activityPermissionRefs, ...dependencyPermissionRefs]).length,
      capabilityRequirementCount: capabilityRequirementRefs.length,
      projectionSubscriptionCount: projectionSubscriptionRefs.length,
      materializationBudgetCount: materializationBudgetRefs.length,
      accessRequirementCount: accessRequirementRefs.length,
    },
    issuedAt: Number(options.issuedAt || selection.issuedAt || contract.issuedAt || Date.now()),
    expiresAt: options.expiresAt || selection.expiresAt || contract.expiresAt,
  });
}

export function surfaceAppActivityPosture(surfaceAppOrContract, activityRefOrId = "", options = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const contract = surfaceApp.contract;
  const requested = String(options.activityRef || options.activityId || activityRefOrId || "").trim();
  const declaredActivityRefs = normalizeStringArray(contract.activityRefs);
  const activityRequired = Boolean(requested || surfaceApp.activities.length || declaredActivityRefs.length);
  const activity = requested
    ? surfaceApp.activityFor(requested)
    : (surfaceApp.activityFor(declaredActivityRefs[0])
      || surfaceApp.activities[0]
      || null);
  const selectedActivityRef = String(activity?.activityRef || requested || "").trim();
  const launchMode = String(options.launchMode || activity?.launchMode || "surface");
  const embedPolicy = String(options.embedPolicy || activity?.embedPolicy || "allowed");
  const primitiveRefs = uniqueStrings([
    ...normalizeStringArray(activity?.primitiveRefs),
    ...normalizeStringArray(options.primitiveRefs),
  ]);
  const moduleRoleRefs = uniqueStrings([
    ...normalizeStringArray(activity?.moduleRoleRefs),
    ...normalizeStringArray(options.moduleRoleRefs),
  ]);
  const permissionRefs = uniqueStrings([
    ...normalizeStringArray(activity?.permissionRefs),
    ...normalizeStringArray(options.permissionRefs),
  ]);
  const accessGroupRefs = uniqueStrings([
    ...normalizeStringArray(activity?.accessGroupRefs),
    ...normalizeStringArray(options.accessGroupRefs),
  ]);
  const materializationRefs = uniqueStrings([
    ...normalizeStringArray(activity?.materializationRefs),
    ...normalizeStringArray(options.materializationRefs),
  ]);
  const activityDependencies = uniqueByRef([
    ...surfaceApp.activityDependenciesFor(selectedActivityRef || requested),
    ...normalizeActivityDependencies(options.activityDependencies),
  ], "dependencyRef");
  const dependencyRefs = uniqueStrings(activityDependencies.map((dependency) => dependency.dependencyRef));
  const dependencyContractRefs = uniqueStrings(activityDependencies.flatMap((dependency) => normalizeStringArray(dependency.contractRefs)));
  const dependencyPrimitiveRefs = uniqueStrings(activityDependencies.flatMap((dependency) => normalizeStringArray(dependency.primitiveRefs)));
  const dependencyPermissionRefs = uniqueStrings(activityDependencies.flatMap((dependency) => normalizeStringArray(dependency.permissionRefs)));
  const dependencyAccessGroupRefs = uniqueStrings(activityDependencies.flatMap((dependency) => normalizeStringArray(dependency.accessGroupRefs)));
  const dependencyMaterializationRefs = uniqueStrings(activityDependencies.flatMap((dependency) => normalizeStringArray(dependency.materializationRefs)));
  const missingRoleRefs = moduleRoleRefs.filter((roleRef) => {
    if (surfaceApp.hasRole(roleRef)) return false;
    return !surfaceApp.modules.some((module) => (
      moduleRoleRefForClaim(surfaceAppContractRef(contract), module) === roleRef
        || String(module.moduleRoleRef || "") === roleRef
    ));
  });
  const activityState = String(activity?.state || "").trim();
  const blockedReasons = uniqueStrings([
    ...(activityRequired && !activity ? ["missingActivity"] : []),
    ...(activityState === "blocked" ? postureBlockedReasons(activity, "activity") : []),
    ...(activityState === "deprecated" ? ["activityDeprecated"] : []),
    ...(activity && !primitiveRefs.length ? ["missingActivityPrimitiveRefs"] : []),
    ...(activity && !moduleRoleRefs.length ? ["missingActivityModuleRoleRefs"] : []),
    ...missingRoleRefs.map((ref) => `missingActivityModuleRole:${ref}`),
    ...activityDependencies.flatMap((dependency) => dependencyBlockedReasons(dependency)),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  return deepFreeze({
    kind: "surface.app.activity.posture",
    state: blockedReasons.length ? "blocked" : (activityRequired ? "ready" : "notRequired"),
    appContractRef: surfaceAppContractRef(contract, options.appContractRef),
    appId: String(contract.appId || ""),
    selectedActivityRef,
    activityId: String(activity?.activityId || requested || "default"),
    launchMode,
    embedPolicy,
    primitiveRefs,
    moduleRoleRefs,
    permissionRefs,
    accessGroupRefs,
    materializationRefs,
    dependencyRefs,
    dependencyContractRefs,
    dependencyPrimitiveRefs,
    dependencyPermissionRefs,
    dependencyAccessGroupRefs,
    dependencyMaterializationRefs,
    evidenceRefs: uniqueStrings([
      ...normalizeStringArray(activity?.evidenceRefs),
      ...activityDependencies.flatMap((dependency) => normalizeStringArray(dependency.evidenceRefs)),
      ...normalizeStringArray(options.evidenceRefs),
    ]),
    blockedReasons,
    issuedAt: Number(options.issuedAt || activity?.issuedAt || contract.issuedAt || Date.now()),
    expiresAt: options.expiresAt || activity?.expiresAt || contract.expiresAt,
  });
}

export function surfaceAppReleaseResolution(surfaceAppOrContract, selection = {}, options = {}) {
  const issuedAt = Number(options.issuedAt || selection.issuedAt || Date.now());
  const surfaceApp = surfaceAppOrContract
    ? (isDefinedSurfaceApp(surfaceAppOrContract)
      ? surfaceAppOrContract
      : defineSurfaceAppContract(surfaceAppOrContract))
    : null;
  const contract = surfaceApp?.contract || {};
  const appContractRef = String(
    options.appContractRef
      || selection.appContractRef
      || surfaceAppContractRef(contract)
      || "",
  ).trim();
  const version = String(options.version || selection.version || contract.version || "").trim();
  const sourceCandidatePosture = isObject(options.sourceCandidatePosture)
    ? options.sourceCandidatePosture
    : (isObject(selection.sourceCandidatePosture)
      ? selection.sourceCandidatePosture
      : surfaceAppSourceCandidatePosture(selection, options));
  const releaseContract = isObject(options.releaseContract)
    ? options.releaseContract
    : (isObject(selection.releaseContract) ? selection.releaseContract : null);
  const releasePosture = isObject(options.releasePosture)
    ? options.releasePosture
    : (isObject(releaseContract?.releasePosture)
      ? releaseContract.releasePosture
      : (isObject(contract.releasePosture) ? contract.releasePosture : {}));
  const distributionPosture = isObject(options.distributionPosture)
    ? options.distributionPosture
    : surfaceAppDistributionPosture(selection, {
      sourceCandidatePosture,
      releaseContract,
      releasePosture,
      state: options.distributionState,
      storageRefs: options.storageRefs,
      sourceRefs: options.sourceRefs,
      pinIntentRefs: options.pinIntentRefs,
      pinProjectionRefs: options.pinProjectionRefs,
      retentionRefs: options.retentionRefs,
      evidenceRefs: options.distributionEvidenceRefs,
    });
  const contractResolution = isObject(options.contractResolution)
    ? options.contractResolution
    : surfaceAppContractResolution(surfaceApp, selection, {
      compatibilityResult: options.compatibilityResult,
      requiredPrimitiveRefs: options.requiredPrimitiveRefs,
      materializationBudgetRefs: options.materializationBudgetRefs,
      blockedReasons: options.contractBlockedReasons,
      issuedAt,
      expiresAt: options.expiresAt || selection.expiresAt,
    });
  const moduleBindings = isObject(options.moduleBindings) ? options.moduleBindings : null;
  const moduleRoleClaims = Array.isArray(contractResolution.moduleRoleClaims)
    ? contractResolution.moduleRoleClaims
    : [];
  const selectedModuleRoleRefs = uniqueStrings([
    ...normalizeStringArray(options.selectedModuleRoleRefs || options.moduleRoleRefs),
    ...moduleRoleClaims.map((claim) => claim.moduleRoleRef || moduleRoleRefForClaim(appContractRef, claim)),
  ]);
  const selectedModuleRefs = uniqueStrings([
    ...normalizeStringArray(options.selectedModuleRefs || options.moduleRefs),
    ...moduleRoleClaims.map((claim) => claim.moduleRef),
    ...normalizeStringArray(moduleBindings?.moduleRefs),
    ...normalizeStringArray(moduleBindings?.bindings?.map?.((binding) => binding?.moduleRef)),
    ...normalizeStringArray(moduleBindings?.bindings?.map?.((binding) => binding?.implementationRef)),
  ]);
  const selectedStorageRefs = uniqueStrings([
    ...normalizeStringArray(options.selectedStorageRefs || options.storageRefs),
    ...normalizeStringArray(sourceCandidatePosture.storageObjectRefs),
    ...normalizeStringArray(sourceCandidatePosture.swarmSourceRefs),
    ...normalizeStringArray(distributionPosture.storageRefs),
    ...normalizeStringArray(releaseContract?.storageRefs),
    ...normalizeStringArray(releasePosture.storageRefs),
  ]);
  const sourceDigestRefs = uniqueStrings([
    ...normalizeStringArray(options.sourceDigestRefs || options.digestRefs),
    ...normalizeStringArray(sourceCandidatePosture.digestRefs),
    ...normalizeStringArray(releaseContract?.digestRefs),
    ...normalizeStringArray(releasePosture.digestRefs),
  ]);
  const sourceSnapshotRef = String(
    options.sourceSnapshotRef
      || selection.sourceSnapshotRef
      || releaseContract?.sourceSnapshotRef
      || releasePosture.sourceSnapshotRef
      || "",
  ).trim();
  const selectedSourceRefs = uniqueStrings([
    ...normalizeStringArray(options.selectedSourceRefs || options.sourceRefs),
    ...normalizeStringArray(sourceCandidatePosture.candidateRefs),
    ...normalizeStringArray(distributionPosture.sourceRefs),
  ]);
  const selectedArtifactRefs = uniqueStrings([
    ...normalizeStringArray(options.selectedArtifactRefs || options.artifactRefs),
    ...normalizeStringArray(releaseContract?.artifactRefs),
    ...normalizeStringArray(releasePosture.artifactRefs),
    ...selectedSourceRefs,
  ]);
  const buildProofRefs = uniqueStrings([
    ...normalizeStringArray(options.buildProofRefs || options.proofRefs),
    ...normalizeStringArray(sourceCandidatePosture.proofDigestRefs),
    ...normalizeStringArray(releaseContract?.proofRefs),
    ...normalizeStringArray(releaseContract?.proofDigestRefs),
    ...normalizeStringArray(releasePosture.proofRefs),
    ...normalizeStringArray(releasePosture.proofDigestRefs),
  ]);
  const selectedReleaseRef = String(
    options.selectedReleaseRef
      || options.releaseRef
      || releaseContract?.releaseRef
      || releasePosture.releaseRef
      || selection.releaseContractRef
      || (appContractRef && version ? `${appContractRef}:release:${version}` : ""),
  ).trim();
  const selectedActivityRef = String(
    options.selectedActivityRef
      || options.activityRef
      || normalizeStringArray(contract.activityRefs)[0]
      || normalizeStringArray(selection.activityRefs)[0]
      || (appContractRef ? `${appContractRef}:activity:default` : ""),
  ).trim();
  const nonBundled = nonBundledSourceMode(sourceCandidatePosture.sourceMode || selection.sourceMode);
  const blockedReasons = uniqueStrings([
    ...prefixedBlockedReasons(contractResolution, "contract"),
    ...prefixedBlockedReasons(sourceCandidatePosture, "source"),
    ...prefixedBlockedReasons(distributionPosture, "distribution"),
    ...prefixedBlockedReasons(moduleBindings, "moduleBinding"),
    ...(!selectedReleaseRef ? ["missingSelectedReleaseRef"] : []),
    ...(!selectedActivityRef ? ["missingSelectedActivityRef"] : []),
    ...(!selectedArtifactRefs.length ? ["missingSelectedArtifactRefs"] : []),
    ...(!selectedModuleRoleRefs.length ? ["missingSelectedModuleRoleRefs"] : []),
    ...(nonBundled && !selectedStorageRefs.length ? ["missingSelectedStorageRefs"] : []),
    ...(nonBundled && !sourceDigestRefs.length ? ["missingSourceDigestRefs"] : []),
    ...(nonBundled && !sourceSnapshotRef ? ["missingSourceSnapshotRef"] : []),
    ...(nonBundled && !buildProofRefs.length ? ["missingBuildProofRefs"] : []),
    ...(!contractResolution.compatibilityRefs?.length ? ["missingCompatibilityRefs"] : []),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const state = blockedReasons.length
    ? "blocked"
    : (String(distributionPosture.state || "") === "degraded" ? "degraded" : "resolved");
  return deepFreeze({
    kind: "surface.app.release.resolution",
    resolutionRef: String(options.resolutionRef || (appContractRef ? `${appContractRef}:resolution:${version || "current"}` : "")),
    appIntentRef: String(options.appIntentRef || selection.appIntentRef || (appContractRef ? `${appContractRef}:intent:launch` : "")),
    appContractRef,
    requestedVersion: version,
    state,
    selectedReleaseRef,
    selectedActivityRef,
    selectedArtifactRefs,
    selectedModuleRoleRefs,
    selectedModuleRefs,
    selectedStorageRefs,
    sourceSnapshotRef,
    selectedSourceRefs,
    sourceDigestRefs,
    buildProofRefs,
    compatibilityRefs: contractResolution.compatibilityRefs,
    permissionRefs: contractResolution.permissionRequirementRefs,
    accessGroupRefs: contractResolution.accessRequirementRefs,
    evidenceRefs: uniqueStrings([
      ...normalizeStringArray(options.evidenceRefs),
      ...normalizeStringArray(sourceCandidatePosture.evidenceRefs),
      ...normalizeStringArray(sourceCandidatePosture.releaseEvidenceRefs),
      ...normalizeStringArray(distributionPosture.evidenceRefs),
      ...normalizeStringArray(releaseContract?.evidenceRefs),
      ...normalizeStringArray(releasePosture.evidenceRefs),
    ]),
    contractResolution,
    sourceCandidatePosture,
    distributionPosture,
    moduleBindings,
    blockedReasons,
    safeFacts: {
      sourceMode: String(sourceCandidatePosture.sourceMode || ""),
      moduleRoleRefCount: selectedModuleRoleRefs.length,
      moduleRefCount: selectedModuleRefs.length,
      artifactRefCount: selectedArtifactRefs.length,
      storageRefCount: selectedStorageRefs.length,
      sourceDigestRefCount: sourceDigestRefs.length,
      buildProofRefCount: buildProofRefs.length,
    },
    resolvedAt: issuedAt,
    expiresAt: options.expiresAt || selection.expiresAt || contract.expiresAt,
  });
}

export function surfaceAppRunnerPlanFromManifest(manifest, surfaceAppsOrContracts, options = {}) {
  const selection = surfaceAppManifestSelection(manifest, surfaceAppsOrContracts, options.selection || options);
  if (selection.state !== "ready") {
    return deepFreeze({
      kind: "surface.app.manifest.runner.plan",
      planId: String(options.planId || `surface-runner:${selection.appContractRef || selection.appId || "surface-app"}`),
      state: "blocked",
      manifestSelection: selection,
      runnerPlan: null,
      blockedReasons: selection.blockedReasons,
      issuedAt: Number(options.issuedAt || selection.issuedAt || Date.now()),
      expiresAt: options.expiresAt || selection.expiresAt,
    });
  }
  const runnerPlan = surfaceAppRunnerPlan(selection.surfaceApp, {
    ...options.runnerPlanOptions,
    sourceMode: options.runnerPlanOptions?.sourceMode || selection.sourceMode,
    bootstrapContractOptions: {
      ...options.runnerPlanOptions?.bootstrapContractOptions,
      releaseContractRef: options.runnerPlanOptions?.bootstrapContractOptions?.releaseContractRef || selection.releaseContractRef,
      trainDigestRef: options.runnerPlanOptions?.bootstrapContractOptions?.trainDigestRef || options.trainDigestRef,
    },
    issuedAt: options.issuedAt,
    expiresAt: options.expiresAt,
  });
  return deepFreeze({
    kind: "surface.app.manifest.runner.plan",
    planId: String(options.planId || runnerPlan.planId),
    state: runnerPlan.state,
    manifestSelection: selection,
    runnerPlan,
    blockedReasons: uniqueStrings([
      ...selection.blockedReasons,
      ...runnerPlan.blockedReasons,
    ]),
    issuedAt: runnerPlan.issuedAt,
    expiresAt: runnerPlan.expiresAt,
  });
}

export function surfaceAppSourceCandidatePosture(selectionOrOptions, options = {}) {
  const source = isObject(selectionOrOptions) ? selectionOrOptions : {};
  const sourceMode = String(options.sourceMode || source.sourceMode || "bundled").trim();
  const sourceClass = surfaceAppSourceClass(sourceMode, options.sourceClass || source.sourceClass);
  const bundled = !nonBundledSourceMode(sourceMode);
  const releaseContractRef = String(options.releaseContractRef || source.releaseContractRef || "").trim();
  const bundledContractAvailable = Boolean(options.bundledContractAvailable ?? source.bundledContractAvailable ?? source.surfaceApp);
  const appContractRef = String(options.appContractRef || source.appContractRef || "").trim();
  const bundledSourceRefs = uniqueStrings([
    ...normalizeStringArray(source.bundledSourceRefs),
    ...normalizeStringArray(options.bundledSourceRefs),
  ]);
  const remoteSourceRefs = uniqueStrings([
    ...normalizeStringArray(source.remoteSourceRefs),
    ...normalizeStringArray(options.remoteSourceRefs),
  ]);
  const storageObjectRefs = uniqueStrings([
    ...normalizeStringArray(source.storageObjectRefs),
    ...normalizeStringArray(options.storageObjectRefs),
    ...(sourceMode === "storageObject" ? remoteSourceRefs : []),
  ]);
  const releaseSourceRefs = uniqueStrings([
    ...normalizeStringArray(source.releaseSourceRefs),
    ...normalizeStringArray(options.releaseSourceRefs),
    ...(sourceClass === "releaseFetched" ? remoteSourceRefs : []),
  ]);
  const swarmSourceRefs = uniqueStrings([
    ...normalizeStringArray(source.swarmSourceRefs),
    ...normalizeStringArray(options.swarmSourceRefs),
    ...(sourceMode === "swarmPackage" ? remoteSourceRefs : []),
  ]);
  const compatibilityRefs = uniqueStrings([
    ...normalizeStringArray(source.compatibilityRefs),
    ...normalizeStringArray(options.compatibilityRefs),
  ]);
  const proofDigestRefs = uniqueStrings([
    ...normalizeStringArray(source.proofDigestRefs),
    ...normalizeStringArray(options.proofDigestRefs),
    ...[source.proofDigestRef].filter((ref) => ref),
    ...[options.proofDigestRef].filter((ref) => ref),
  ]);
  const digestRefs = uniqueStrings([
    ...normalizeStringArray(source.digestRefs),
    ...normalizeStringArray(options.digestRefs),
    ...[source.digestRef].filter((ref) => ref),
    ...[options.digestRef].filter((ref) => ref),
  ]);
  const signatureRefs = uniqueStrings([
    ...normalizeStringArray(source.signatureRefs),
    ...normalizeStringArray(options.signatureRefs),
    ...[source.signatureRef].filter((ref) => ref),
    ...[options.signatureRef].filter((ref) => ref),
  ]);
  const publisherRefs = uniqueStrings([
    ...normalizeStringArray(source.publisherRefs),
    ...normalizeStringArray(options.publisherRefs),
    ...[source.publisherRef].filter((ref) => ref),
    ...[options.publisherRef].filter((ref) => ref),
  ]);
  const sourceAuthorityRefs = uniqueStrings([
    ...normalizeStringArray(source.sourceAuthorityRefs),
    ...normalizeStringArray(options.sourceAuthorityRefs),
    ...[source.sourceAuthorityRef].filter((ref) => ref),
    ...[options.sourceAuthorityRef].filter((ref) => ref),
  ]);
  const releaseEvidenceRefs = uniqueStrings([
    ...normalizeStringArray(source.releaseEvidenceRefs),
    ...normalizeStringArray(options.releaseEvidenceRefs),
    ...[source.releaseEvidenceRef].filter((ref) => ref),
    ...[options.releaseEvidenceRef].filter((ref) => ref),
  ]);
  const rollbackRefs = uniqueStrings([
    ...normalizeStringArray(source.rollbackRefs),
    ...normalizeStringArray(options.rollbackRefs),
    ...[source.rollbackRef].filter((ref) => ref),
    ...[options.rollbackRef].filter((ref) => ref),
  ]);
  const secretBoundaryRefs = uniqueStrings([
    ...normalizeStringArray(source.secretBoundaryRefs),
    ...normalizeStringArray(options.secretBoundaryRefs),
    ...[source.secretBoundaryRef].filter((ref) => ref),
    ...[options.secretBoundaryRef].filter((ref) => ref),
  ]);
  const trustRefs = uniqueStrings([
    ...normalizeStringArray(source.trustRefs),
    ...normalizeStringArray(options.trustRefs),
    ...[source.trustRef].filter((ref) => ref),
    ...[options.trustRef].filter((ref) => ref),
  ]);
  const evidenceRefs = uniqueStrings([
    ...normalizeStringArray(source.evidenceRefs),
    ...normalizeStringArray(options.evidenceRefs),
  ]);
  const remoteCandidateRefs = uniqueStrings([
    ...remoteSourceRefs,
    ...storageObjectRefs,
    ...releaseSourceRefs,
    ...swarmSourceRefs,
  ]);
  const candidateRefs = uniqueStrings([
    ...(bundled ? bundledSourceRefs : remoteCandidateRefs),
    ...(bundled && bundledContractAvailable && appContractRef ? [appContractRef] : []),
    ...normalizeStringArray(source.candidateRefs),
    ...normalizeStringArray(options.candidateRefs),
  ]);
  const sourceTrusted = options.sourceTrusted ?? source.sourceTrusted;
  const blockedReasons = uniqueStrings([
    ...(bundled && candidateRefs.length === 0 && !bundledContractAvailable ? ["missingBundledSourceRef"] : []),
    ...(!bundled && candidateRefs.length === 0 ? ["missingRemoteSourceRef"] : []),
    ...(!bundled && !releaseContractRef ? ["missingReleaseContractRef"] : []),
    ...(!bundled && digestRefs.length === 0 ? ["missingSourceDigestRef"] : []),
    ...(!bundled && signatureRefs.length === 0 ? ["missingSourceSignatureRef"] : []),
    ...(!bundled && proofDigestRefs.length === 0 ? ["missingProofDigestRef"] : []),
    ...(!bundled && rollbackRefs.length === 0 ? ["missingRollbackRef"] : []),
    ...(!bundled && secretBoundaryRefs.length === 0 ? ["missingSecretBoundaryRef"] : []),
    ...(!bundled && compatibilityRefs.length === 0 ? ["missingCompatibilityRef"] : []),
    ...(!bundled && trustRefs.length === 0 && sourceTrusted !== true ? ["missingSourceTrustRef"] : []),
    ...(sourceTrusted === false ? ["sourceUntrusted"] : []),
    ...normalizeStringArray(source.blockedReasons),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  return deepFreeze({
    kind: "surface.app.source.candidate.posture",
    state: blockedReasons.length ? "blocked" : "ready",
    sourceMode,
    sourceClass,
    candidateRefs,
    bundledSourceRefs,
    remoteSourceRefs,
    storageObjectRefs,
    releaseSourceRefs,
    swarmSourceRefs,
    releaseContractRef,
    digestRefs,
    signatureRefs,
    publisherRefs,
    sourceAuthorityRefs,
    releaseEvidenceRefs,
    compatibilityRefs,
    proofDigestRefs,
    rollbackRefs,
    secretBoundaryRefs,
    trustRefs,
    evidenceRefs,
    blockedReasons,
    issuedAt: Number(options.issuedAt || source.issuedAt || Date.now()),
    expiresAt: options.expiresAt || source.expiresAt,
  });
}

export function surfaceAppDistributionPosture(selectionOrOptions, options = {}) {
  const source = isObject(selectionOrOptions) ? selectionOrOptions : {};
  const sourceCandidatePosture = isObject(options.sourceCandidatePosture)
    ? options.sourceCandidatePosture
    : (isObject(source.sourceCandidatePosture)
      ? source.sourceCandidatePosture
      : surfaceAppSourceCandidatePosture(source, options));
  const releaseContract = isObject(options.releaseContract)
    ? options.releaseContract
    : (isObject(source.releaseContract) ? source.releaseContract : null);
  const releasePosture = isObject(options.releasePosture)
    ? options.releasePosture
    : (isObject(releaseContract?.releasePosture)
      ? releaseContract.releasePosture
      : (isObject(source.releasePosture) ? source.releasePosture : {}));
  const schemaPosture = isObject(options.schemaPosture)
    ? options.schemaPosture
    : (isObject(source.schemaPosture) ? source.schemaPosture : undefined);
  const sourceRefs = uniqueStrings([
    ...normalizeStringArray(sourceCandidatePosture.candidateRefs),
    ...normalizeStringArray(source.sourceRefs),
    ...normalizeStringArray(options.sourceRefs),
  ]);
  const storageRefs = uniqueStrings([
    ...normalizeStringArray(sourceCandidatePosture.storageObjectRefs),
    ...normalizeStringArray(source.storageRefs),
    ...normalizeStringArray(options.storageRefs),
  ]);
  const pinIntentRefs = uniqueStrings([
    ...normalizeStringArray(source.pinIntentRefs),
    ...normalizeStringArray(options.pinIntentRefs),
  ]);
  const pinProjectionRefs = uniqueStrings([
    ...normalizeStringArray(source.pinProjectionRefs),
    ...normalizeStringArray(options.pinProjectionRefs),
  ]);
  const releaseContractRefs = uniqueStrings([
    sourceCandidatePosture.releaseContractRef,
    releaseContract?.contractId,
    ...normalizeStringArray(source.releaseContractRefs),
    ...normalizeStringArray(options.releaseContractRefs),
  ]);
  const retentionRefs = uniqueStrings([
    ...normalizeStringArray(source.retentionRefs),
    ...normalizeStringArray(options.retentionRefs),
  ]);
  const evidenceRefs = uniqueStrings([
    ...normalizeStringArray(sourceCandidatePosture.evidenceRefs),
    ...normalizeStringArray(sourceCandidatePosture.releaseEvidenceRefs),
    ...normalizeStringArray(releaseContract?.evidenceRefs),
    ...normalizeStringArray(releasePosture.evidenceRefs),
    ...normalizeStringArray(source.evidenceRefs),
    ...normalizeStringArray(options.evidenceRefs),
  ]);
  const requestedState = String(options.state || source.state || "").trim();
  const inferredState = sourceCandidatePosture.state === "blocked"
    ? "blocked"
    : (pinIntentRefs.length || pinProjectionRefs.length || storageRefs.length ? "retained" : "pending");
  const state = requestedState || inferredState;
  const blockedReasons = uniqueStrings([
    ...prefixedBlockedReasons(sourceCandidatePosture, "source"),
    ...prefixedBlockedReasons(releaseContract, "release"),
    ...prefixedBlockedReasons(releasePosture, "releasePosture"),
    ...prefixedBlockedReasons(schemaPosture, "schema"),
    ...(state === "retained" && sourceRefs.length === 0 && storageRefs.length === 0 ? ["missingRetainedSourceRef"] : []),
    ...(state === "retained" && pinIntentRefs.length === 0 && pinProjectionRefs.length === 0 ? ["missingRetainedPinRef"] : []),
    ...normalizeStringArray(source.blockedReasons),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const record = {
    state: blockedReasons.length ? "blocked" : state,
    sourceMode: sourceCandidatePosture.sourceMode,
    sourceRefs,
    storageRefs,
    pinIntentRefs,
    pinProjectionRefs,
    releaseContractRefs,
    retentionRefs,
    retentionClass: String(options.retentionClass || source.retentionClass || "surface-app-release"),
    releasePosture,
    evidenceRefs,
    blockedReasons,
    safeFacts: {
      sourceClass: sourceCandidatePosture.sourceClass,
      sourceRefCount: sourceRefs.length,
      storageRefCount: storageRefs.length,
      pinRefCount: pinIntentRefs.length + pinProjectionRefs.length,
      releaseContractRefCount: releaseContractRefs.length,
      evidenceRefCount: evidenceRefs.length,
    },
  };
  assignObjectIfPresent(record, "schemaPosture", schemaPosture);
  return deepFreeze(record);
}

export function surfaceAppServiceManagerActionability(surfaceAppOrContract, options = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const contract = surfaceApp.contract;
  const runnerPlan = isObject(options.runnerPlan) ? options.runnerPlan : {};
  const serviceManagerPosture = isObject(options.serviceManagerPosture)
    ? options.serviceManagerPosture
    : (isObject(contract.serviceManagerPosture) ? contract.serviceManagerPosture : {});
  const sourceMode = String(options.sourceMode || runnerPlan.sourceMode || dominantFulfillmentMode(surfaceApp.modules) || "bundled");
  const secretBoundary = isObject(options.secretBoundary)
    ? options.secretBoundary
    : (isObject(options.secretBoundaryRecord)
      ? options.secretBoundaryRecord
      : (isObject(runnerPlan.secretBoundary)
        ? runnerPlan.secretBoundary
        : (isObject(contract.secretBoundary) ? contract.secretBoundary : null)));
  const releaseContract = isObject(options.releaseContract)
    ? options.releaseContract
    : (isObject(runnerPlan.releaseContract) ? runnerPlan.releaseContract : null);
  const labProof = isObject(options.labProof)
    ? options.labProof
    : (isObject(runnerPlan.labProof) ? runnerPlan.labProof : null);
  const proofDigest = isObject(options.proofDigest)
    ? options.proofDigest
    : (isObject(runnerPlan.proofDigest) ? runnerPlan.proofDigest : null);
  const trainDigest = isObject(options.trainDigest)
    ? options.trainDigest
    : (isObject(runnerPlan.trainDigest) ? runnerPlan.trainDigest : null);
  const managerId = String(options.managerId || serviceManagerPosture.managerId || serviceManagerPosture.serviceManagerRef || `manager:${contract.appId || contract.contractId || "surface-app"}`);
  const managerRef = String(options.managerRef || serviceManagerPosture.managerRef || serviceManagerPosture.managerId || serviceManagerPosture.serviceManagerRef || managerId);
  const subjectRef = surfaceSubjectRef(contract, options.subjectRef);
  const operationOptionsByName = isObject(options.operationOptionsByName) ? options.operationOptionsByName : {};
  const releaseRef = String(
    options.releaseRef
      || operationOptionsByName.release?.releaseRef
      || releaseContract?.releaseRef
      || releaseContract?.releasePosture?.releaseRef
      || contract.releasePosture?.releaseRef
      || "",
  ).trim();
  const rollbackRef = String(
    options.rollbackRef
      || operationOptionsByName.rollback?.rollbackRef
      || releaseContract?.rollbackRef
      || releaseContract?.rollbackPosture?.rollbackRef
      || contract.rollbackPosture?.rollbackRef
      || contract.releasePosture?.rollbackRef
      || "",
  ).trim();
  const defaultOperations = ["healthCheck", "secretReady", "install", "update", "start", "stop", "restart"];
  if (releaseRef) defaultOperations.push("release");
  if (rollbackRef) defaultOperations.push("rollback");
  const managerObserved = Object.keys(serviceManagerPosture).length > 0;
  const operationNames = uniqueStrings([
    ...normalizeStringArray(options.operationNames),
    ...(Array.isArray(options.operationPostures) ? options.operationPostures.map((posture) => posture?.operation) : []),
    ...((managerObserved || options.generateOperationPostures === true) ? defaultOperations : []),
  ]);
  const suppliedOperationPostures = Array.isArray(options.operationPostures)
    ? options.operationPostures.filter(isObject)
    : [];
  const suppliedByOperation = new Map(suppliedOperationPostures.map((posture) => [String(posture.operation || ""), posture]));
  const operationPostures = operationNames.map((operation) => {
    const supplied = suppliedByOperation.get(operation);
    if (supplied) return supplied;
    return surfaceServiceManagerOperationPosture(surfaceApp, {
      ...(isObject(operationOptionsByName[operation]) ? operationOptionsByName[operation] : {}),
      operation,
      releaseRef: operation === "release" ? releaseRef : operationOptionsByName[operation]?.releaseRef,
      rollbackRef: operation === "rollback" ? rollbackRef : operationOptionsByName[operation]?.rollbackRef,
      managerId,
      managerRef,
      subjectRef,
      serviceManagerPosture,
      secretBoundary: secretBoundary || undefined,
      releasePosture: releaseContract?.releasePosture || contract.releasePosture,
      rollbackPosture: releaseContract?.rollbackPosture || contract.rollbackPosture,
      state: operation === "healthCheck" ? (options.healthState || "succeeded") : (operationOptionsByName[operation]?.state || "requested"),
      requestedAt: options.issuedAt || Date.now(),
    });
  });
  const requiredOperations = uniqueStrings(normalizeStringArray(options.requiredOperations || ["healthCheck"]));
  const requiredOperationBlockedReasons = operationPostures
    .filter((posture) => requiredOperations.includes(String(posture.operation || "")))
    .flatMap((posture) => normalizeStringArray(posture.blockedReasons)
      .map((reason) => `operation:${posture.operation}:${reason}`));
  const healthPosture = operationPostures.find((posture) => String(posture.operation || "") === "healthCheck") || null;
  const healthState = String(options.healthState || healthPosture?.state || serviceManagerPosture.healthState || "unknown");
  const blockedReasons = uniqueStrings([
    ...postureBlockedReasons(serviceManagerPosture, "serviceManager"),
    ...postureBlockedReasons(secretBoundary, "secretBoundary"),
    ...postureBlockedReasons(releaseContract, "release"),
    ...postureBlockedReasons(labProof, "labProof"),
    ...postureBlockedReasons(proofDigest, "proofDigest"),
    ...postureBlockedReasons(trainDigest, "trainDigest"),
    ...(nonBundledSourceMode(sourceMode) && !releaseContract ? ["missingReleaseContract"] : []),
    ...requiredOperationBlockedReasons,
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const degraded = postureIsDegraded(serviceManagerPosture)
    || postureIsDegraded(releaseContract)
    || postureIsDegraded(labProof)
    || postureIsDegraded(proofDigest)
    || postureIsDegraded(trainDigest);
  const observedActionability = managerObserved
    || Boolean(releaseContract)
    || Boolean(secretBoundary)
    || Boolean(labProof)
    || Boolean(proofDigest)
    || Boolean(trainDigest)
    || operationPostures.length > 0;
  const operationRefs = uniqueStrings(operationPostures.map((posture) => posture.operationId));
  const serviceManagerRequirementRefs = uniqueStrings([
    ...normalizeStringArray(options.serviceManagerRequirementRefs),
    ...normalizeStringArray(options.manifestSelection?.serviceManagerRequirementRefs),
  ]);
  const hasManagerEvidence = managerObserved
    || operationPostures.length > 0
    || Boolean(proofDigest)
    || Boolean(labProof)
    || Boolean(trainDigest);
  const requiredWithoutEvidence = serviceManagerRequirementRefs.length > 0 && !hasManagerEvidence;
  const normalizedServiceManagerPosture = managerObserved
    ? deepFreeze({
      kind: serviceManagerPosture.kind || "service.manager.posture",
      managerId,
      subjectRef,
      managerRef,
      state: serviceManagerPosture.state || "manual",
      serviceRefs: uniqueStrings([
        ...normalizeStringArray(serviceManagerPosture.serviceRefs),
        contract.serviceRef,
      ]),
      capabilityRefs: uniqueStrings(normalizeStringArray(serviceManagerPosture.capabilityRefs)),
      operationRefs: uniqueStrings(normalizeStringArray(serviceManagerPosture.operationRefs)),
      proofDigestRefs: uniqueStrings(normalizeStringArray(serviceManagerPosture.proofDigestRefs)),
      evidenceRefs: uniqueStrings(normalizeStringArray(serviceManagerPosture.evidenceRefs)),
      blockedReasons: uniqueStrings(normalizeStringArray(serviceManagerPosture.blockedReasons)),
      issuedAt: Number(serviceManagerPosture.issuedAt || options.issuedAt || contract.issuedAt || Date.now()),
      expiresAt: serviceManagerPosture.expiresAt || options.expiresAt || contract.expiresAt,
    })
    : undefined;
  const normalizedSecretBoundary = secretBoundary
    ? surfaceServiceManagerSecretBoundary(surfaceApp, {
      secretBoundary,
      serviceManagerPosture: normalizedServiceManagerPosture || serviceManagerPosture,
      managerId,
      subjectRef,
      issuedAt: options.issuedAt,
      expiresAt: options.expiresAt || contract.expiresAt,
    })
    : null;
  const record = {
    kind: "surface.app.runtime.service-manager.actionability",
    state: blockedReasons.length
      ? "blocked"
      : (!observedActionability || requiredWithoutEvidence
        ? "unknown"
        : (degraded ? "degraded" : "ready")),
    managerId,
    subjectRef,
    managerRef,
    sourceMode,
    healthState,
    serviceManagerRequirementRefs,
    operationRefs,
    releaseContractRefs: uniqueStrings([
      releaseContract?.contractId,
      ...normalizeStringArray(options.releaseContractRefs),
    ]),
    secretBoundaryRefs: uniqueStrings([
      normalizedSecretBoundary?.boundaryId,
      ...normalizeStringArray(options.secretBoundaryRefs),
    ]),
    proofDigestRefs: uniqueStrings([
      proofDigest?.digestId,
      ...normalizeStringArray(releaseContract?.proofDigestRefs),
      ...normalizeStringArray(trainDigest?.proofDigestRefs),
      ...normalizeStringArray(options.proofDigestRefs),
    ]),
    labProofRefs: uniqueStrings([
      labProof?.proofId,
      ...normalizeStringArray(releaseContract?.labProofRefs),
      ...normalizeStringArray(trainDigest?.labProofRefs),
      ...normalizeStringArray(options.labProofRefs),
    ]),
    trainDigestRefs: uniqueStrings([
      trainDigest?.trainId,
      ...normalizeStringArray(options.trainDigestRefs),
    ]),
    capabilityRefs: uniqueStrings([
      ...normalizeStringArray(serviceManagerPosture.capabilityRefs),
      ...normalizeStringArray(options.capabilityRefs),
    ]),
    evidenceRefs: uniqueStrings([
      ...normalizeStringArray(serviceManagerPosture.evidenceRefs),
      ...normalizeStringArray(releaseContract?.evidenceRefs),
      ...normalizeStringArray(secretBoundary?.evidenceRefs),
      ...normalizeStringArray(labProof?.evidenceRefs),
      ...normalizeStringArray(proofDigest?.evidenceRefs),
      ...normalizeStringArray(trainDigest?.evidenceRefs),
      ...normalizeStringArray(options.evidenceRefs),
    ]),
    serviceManagerPosture: normalizedServiceManagerPosture,
    releaseContract,
    secretBoundary: normalizedSecretBoundary,
    labProof,
    proofDigest,
    trainDigest,
    operationPostures,
    blockedReasons,
    issuedAt: Number(options.issuedAt || Date.now()),
    expiresAt: options.expiresAt || serviceManagerPosture.expiresAt || contract.expiresAt,
  };
  return deepFreeze(record);
}

export function surfaceAppFulfillmentIdentityPosture(surfaceAppOrContract, options = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const contract = surfaceApp.contract;
  const serviceManagerPosture = isObject(options.serviceManagerPosture)
    ? options.serviceManagerPosture
    : (isObject(contract.serviceManagerPosture) ? contract.serviceManagerPosture : {});
  const appContractRef = surfaceAppContractRef(contract, options.appContractRef);
  const serviceContractRef = String(options.serviceContractRef || contract.serviceContractRef || contract.serviceRef || "").trim();
  const serviceRef = String(options.serviceRef || contract.serviceRef || serviceContractRef || "").trim();
  const serviceRequired = Boolean(options.serviceRequired ?? Boolean(contract.serviceRef || contract.serviceContractRef));
  const runnerCandidates = uniqueStrings([
    options.runnerRef,
    serviceManagerPosture.runnerRef,
    ...(Array.isArray(options.runnerRefs) ? options.runnerRefs : []),
  ]);
  const memberCandidates = uniqueStrings([
    ...runnerCandidates,
    options.memberRef,
    ...(Array.isArray(options.memberRefs) ? options.memberRefs : []),
  ]);
  const invalidRunnerRefs = runnerCandidates.filter((ref) => !isResolvedMemberRef(ref));
  const invalidMemberRefs = memberCandidates.filter((ref) => !isResolvedMemberRef(ref));
  const runnerRefs = runnerCandidates.filter(isResolvedMemberRef);
  const memberRefs = memberCandidates.filter(isResolvedMemberRef);
  const serviceRouteRefs = uniqueStrings([
    serviceRef,
    ...(Array.isArray(contract.serviceRouteRefs) ? contract.serviceRouteRefs : []),
    ...(Array.isArray(options.serviceRouteRefs) ? options.serviceRouteRefs : []),
  ]);
  const routeRefs = uniqueStrings([
    ...serviceRouteRefs,
    ...(Array.isArray(contract.routeRefs) ? contract.routeRefs : []),
    ...(Array.isArray(options.routeRefs) ? options.routeRefs : []),
  ]);
  const hostRefs = uniqueStrings([
    options.hostRef,
    serviceManagerPosture.hostRef,
    ...(Array.isArray(contract.hostRefs) ? contract.hostRefs : []),
    ...(Array.isArray(options.hostRefs) ? options.hostRefs : []),
  ]);
  const managerRefs = uniqueStrings([
    options.managerRef,
    serviceManagerPosture.managerRef,
    serviceManagerPosture.managerId,
    serviceManagerPosture.serviceManagerRef,
    ...(Array.isArray(options.managerRefs) ? options.managerRefs : []),
  ]);
  const blockedReasons = uniqueStrings([
    ...surfaceApp.missingRoles.map((role) => `missingModuleRole:${role}`),
    ...(serviceRequired && !serviceContractRef ? ["missingServiceContractRef"] : []),
    ...(serviceContractRef && serviceRef && serviceContractRef !== serviceRef ? ["serviceRefMismatch"] : []),
    ...invalidRunnerRefs.map(() => "unresolvedRunnerRef"),
    ...invalidMemberRefs.filter((ref) => !runnerCandidates.includes(ref)).map(() => "unresolvedMemberRef"),
    ...postureBlockedReasons(serviceManagerPosture, "serviceManager"),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const degraded = postureIsDegraded(serviceManagerPosture);
  const explicitState = String(options.state || "").trim();
  const state = blockedReasons.length
    ? "blocked"
    : (explicitState || (degraded ? "degraded" : "ready"));
  const record = {
    kind: "surface.app.fulfillment.identity.posture",
    identityId: String(options.identityId || `identity:${appContractRef || contract.appId || "surface-app"}`),
    state,
    appContractRef,
    appId: String(contract.appId || ""),
    version: String(contract.version || ""),
    surfaceRef: String(options.surfaceRef || contract.surfaceRef || ""),
    serviceRequired,
    serviceRouteRefs,
    routeRefs,
    hostRefs,
    managerRefs,
    runnerRefs,
    memberRefs,
    capabilityRefs: uniqueStrings([
      ...normalizeStringArray(serviceManagerPosture.capabilityRefs),
      ...normalizeStringArray(options.capabilityRefs),
    ]),
    grantRefs: uniqueStrings([
      ...normalizeStringArray(serviceManagerPosture.grantRefs),
      ...normalizeStringArray(options.grantRefs),
    ]),
    authorityRefs: uniqueStrings(normalizeStringArray(options.authorityRefs)),
    evidenceRefs: uniqueStrings([
      ...normalizeStringArray(serviceManagerPosture.evidenceRefs),
      ...normalizeStringArray(options.evidenceRefs),
    ]),
    identityPosture: deepFreeze({
      app: appContractRef ? "ready" : "blocked",
      service: serviceRequired ? (serviceContractRef ? "ready" : "blocked") : "notRequired",
      route: routeRefs.length ? "ready" : "notRequired",
      host: hostRefs.length || managerRefs.length || runnerRefs.length ? "ready" : "unknown",
    }),
    blockedReasons,
    safeFacts: {
      serviceRequired,
      serviceRouteRefCount: serviceRouteRefs.length,
      hostRefCount: hostRefs.length,
      runnerRefCount: runnerRefs.length,
      memberRefCount: memberRefs.length,
    },
    issuedAt: Number(options.issuedAt || contract.issuedAt || Date.now()),
    expiresAt: options.expiresAt || serviceManagerPosture.expiresAt || contract.expiresAt,
  };
  assignIfPresent(record, "serviceContractRef", serviceContractRef);
  assignIfPresent(record, "serviceRef", serviceRef);
  return deepFreeze(record);
}

export function surfaceAppAuthorityAccessPosture(surfaceAppOrContract, options = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const contract = surfaceApp.contract;
  const appContractRef = surfaceAppContractRef(contract, options.appContractRef);
  const fulfillmentIdentityPosture = isObject(options.fulfillmentIdentityPosture)
    ? options.fulfillmentIdentityPosture
    : surfaceAppFulfillmentIdentityPosture(surfaceApp, {
      ...(isObject(options.fulfillmentIdentityOptions) ? options.fulfillmentIdentityOptions : {}),
      serviceManagerPosture: options.serviceManagerPosture || contract.serviceManagerPosture,
      issuedAt: options.issuedAt,
      expiresAt: options.expiresAt,
    });
  const secretBoundary = isObject(options.secretBoundary)
    ? options.secretBoundary
    : (isObject(contract.secretBoundary) ? contract.secretBoundary : {});
  const manifestSelection = isObject(options.manifestSelection)
    ? options.manifestSelection
    : (isObject(options.runtimeSelectionPosture?.manifestSelection) ? options.runtimeSelectionPosture.manifestSelection : {});
  const serviceManagerPosture = isObject(options.serviceManagerPosture)
    ? options.serviceManagerPosture
    : (isObject(contract.serviceManagerPosture) ? contract.serviceManagerPosture : {});
  const rootRefs = uniqueStrings([
    ...normalizeStringArray(contract.rootRefs),
    ...normalizeStringArray(options.rootRefs),
  ]);
  const deviceRefs = uniqueStrings([
    ...normalizeStringArray(contract.deviceRefs),
    ...normalizeStringArray(options.deviceRefs),
  ]);
  const grantRefs = uniqueStrings([
    ...normalizeStringArray(contract.grantRefs),
    ...normalizeStringArray(manifestSelection.grantRefs),
    ...normalizeStringArray(serviceManagerPosture.grantRefs),
    ...normalizeStringArray(fulfillmentIdentityPosture.grantRefs),
    ...normalizeStringArray(options.grantRefs),
  ]);
  const authorityRefs = uniqueStrings([
    ...normalizeStringArray(contract.authorityRefs),
    ...normalizeStringArray(secretBoundary.authorityRefs),
    ...normalizeStringArray(serviceManagerPosture.authorityRefs),
    ...normalizeStringArray(fulfillmentIdentityPosture.authorityRefs),
    ...normalizeStringArray(options.authorityRefs),
  ]);
  const accessGroupRefs = uniqueStrings([
    ...normalizeStringArray(contract.accessGroupRefs),
    ...normalizeStringArray(secretBoundary.accessGroupRefs),
    ...normalizeStringArray(options.accessGroupRefs),
  ]);
  const accessEpochRefs = uniqueStrings([
    ...normalizeStringArray(contract.accessEpochRefs),
    ...normalizeStringArray(secretBoundary.accessEpochRefs),
    ...normalizeStringArray(options.accessEpochRefs),
  ]);
  const privateEnvelopeRefs = uniqueStrings([
    ...normalizeStringArray(contract.privateEnvelopeRefs),
    ...normalizeStringArray(secretBoundary.privateEnvelopeRefs),
    ...normalizeStringArray(options.privateEnvelopeRefs),
  ]);
  const syncRefs = uniqueStrings([
    ...normalizeStringArray(contract.syncRefs),
    ...normalizeStringArray(manifestSelection.syncRefs),
    ...normalizeStringArray(options.syncRefs),
  ]);
  const requiredContentClasses = uniqueStrings([
    ...normalizeStringArray(contract.requiredContentClasses),
    ...normalizeStringArray(secretBoundary.requiredContentClasses),
    ...normalizeStringArray(options.requiredContentClasses),
  ]);
  const revocationRefs = uniqueStrings([
    ...normalizeStringArray(contract.revocationRefs),
    ...normalizeStringArray(options.revocationRefs),
  ]);
  const exerciseRefs = uniqueStrings([
    ...normalizeStringArray(options.exerciseRefs),
  ]);
  const evidenceRefs = uniqueStrings([
    ...normalizeStringArray(secretBoundary.evidenceRefs),
    ...normalizeStringArray(serviceManagerPosture.evidenceRefs),
    ...normalizeStringArray(fulfillmentIdentityPosture.evidenceRefs),
    ...normalizeStringArray(options.evidenceRefs),
  ]);
  const actionRequired = Boolean(options.actionRequired ?? (
    normalizeStringArray(contract.grantRefs).length
    || normalizeStringArray(manifestSelection.grantRefs).length
    || normalizeStringArray(options.requiredGrantRefs).length
  ));
  const accessRequired = Boolean(options.accessRequired ?? (
    requiredContentClasses.length
    || normalizeStringArray(options.requiredAccessGroupRefs).length
  ));
  const syncRequired = Boolean(options.syncRequired ?? (
    syncRefs.length
    || normalizeStringArray(options.requiredSyncRefs).length
  ));
  const explicitRevocationState = String(options.revocationState || options.revocationPosture?.state || "").trim();
  const expiresAt = options.expiresAt || contract.expiresAt;
  const now = Number(options.now || Date.now());
  const expired = Boolean(expiresAt && Number(expiresAt) <= now);
  const actionPosture = isObject(options.actionPosture)
    ? options.actionPosture
    : {
      state: actionRequired ? (grantRefs.length ? "ready" : "missing") : "notRequired",
      grantRefCount: grantRefs.length,
    };
  const accessPosture = isObject(options.accessPosture)
    ? options.accessPosture
    : {
      state: accessRequired ? (accessGroupRefs.length ? "ready" : "missing") : "notRequired",
      accessGroupRefCount: accessGroupRefs.length,
      accessEpochRefCount: accessEpochRefs.length,
      privateEnvelopeRefCount: privateEnvelopeRefs.length,
      requiredContentClassCount: requiredContentClasses.length,
    };
  const syncPosture = isObject(options.syncPosture)
    ? options.syncPosture
    : {
      state: syncRequired ? (syncRefs.length ? "ready" : "missing") : "notRequired",
      syncRefCount: syncRefs.length,
    };
  const revocationPosture = isObject(options.revocationPosture)
    ? options.revocationPosture
    : {
      state: explicitRevocationState === "revoked" ? "revoked" : "clear",
      revocationRefCount: revocationRefs.length,
    };
  const expiryPosture = isObject(options.expiryPosture)
    ? options.expiryPosture
    : {
      state: expired ? "expired" : (expiresAt ? "fresh" : "unbounded"),
      expiresAt: expiresAt || null,
    };
  const blockedReasons = uniqueStrings([
    ...(actionRequired && !grantRefs.length ? ["missingActionGrant"] : []),
    ...(accessRequired && !accessGroupRefs.length ? ["missingAccessGroup"] : []),
    ...(accessRequired && !requiredContentClasses.length ? ["missingContentClass"] : []),
    ...(syncRequired && !syncRefs.length ? ["missingSyncWitness"] : []),
    ...(explicitRevocationState === "revoked" || String(revocationPosture.state || "") === "revoked" ? ["revoked"] : []),
    ...(expired ? ["expired"] : []),
    ...postureBlockedReasons(actionPosture, "action"),
    ...postureBlockedReasons(accessPosture, "access"),
    ...postureBlockedReasons(syncPosture, "sync"),
    ...postureBlockedReasons(revocationPosture, "revocation"),
    ...postureBlockedReasons(expiryPosture, "expiry"),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const degraded = [actionPosture, accessPosture, syncPosture, revocationPosture, expiryPosture, fulfillmentIdentityPosture]
    .some((posture) => String(posture?.state || "") === "degraded" || String(posture?.state || "") === "unchecked");
  const record = {
    kind: "surface.app.authority.access.posture",
    postureId: String(options.postureId || `authority-access:${appContractRef || contract.appId || "surface-app"}`),
    state: blockedReasons.length ? "blocked" : (String(options.state || "") || (degraded ? "degraded" : "ready")),
    appContractRef,
    appId: String(contract.appId || ""),
    actionRequired,
    accessRequired,
    syncRequired,
    rootRefs,
    deviceRefs,
    grantRefs,
    authorityRefs,
    accessGroupRefs,
    accessEpochRefs,
    privateEnvelopeRefs,
    syncRefs,
    requiredContentClasses,
    revocationRefs,
    exerciseRefs,
    evidenceRefs,
    actionPosture: deepFreeze({ ...actionPosture }),
    accessPosture: deepFreeze({ ...accessPosture }),
    syncPosture: deepFreeze({ ...syncPosture }),
    revocationPosture: deepFreeze({ ...revocationPosture }),
    expiryPosture: deepFreeze({ ...expiryPosture }),
    safeFacts: {
      actionRequired,
      accessRequired,
      syncRequired,
      grantRefCount: grantRefs.length,
      accessGroupRefCount: accessGroupRefs.length,
      accessEpochRefCount: accessEpochRefs.length,
      privateEnvelopeRefCount: privateEnvelopeRefs.length,
      syncRefCount: syncRefs.length,
      requiredContentClassCount: requiredContentClasses.length,
      revocationRefCount: revocationRefs.length,
    },
    blockedReasons,
    issuedAt: Number(options.issuedAt || contract.issuedAt || Date.now()),
    expiresAt,
  };
  assignIfPresent(record, "revocationState", explicitRevocationState);
  return deepFreeze(record);
}

export function surfaceAppRuntimeSelectionPosture(manifest, surfaceAppsOrContracts, options = {}) {
  const issuedAt = Number(options.issuedAt || Date.now());
  const requestedAppRef = String(options.requestedAppRef || options.appContractRef || manifest?.currentAppContractRef || "").trim();
  const requestedVersion = String(options.requestedVersion || options.version || manifest?.currentVersion || "").trim();
  const manifestRunnerPlan = surfaceAppRunnerPlanFromManifest(manifest, surfaceAppsOrContracts, {
    ...options,
    selection: {
      ...(isObject(options.selection) ? options.selection : {}),
      appContractRef: String(options.selection?.appContractRef || options.appContractRef || requestedAppRef || "").trim(),
      version: String(options.selection?.version || options.version || requestedVersion || "").trim(),
    },
    issuedAt,
  });
  const selection = manifestRunnerPlan.manifestSelection;
  const surfaceApp = selection.surfaceApp;
  const requiredModuleRoles = uniqueStrings([
    ...normalizeStringArray(selection.requiredModuleRoles),
    ...(surfaceApp ? normalizeStringArray(surfaceApp.requiredRoles) : []),
  ]);
  const modulePostures = deepFreeze(requiredModuleRoles.map((role) => (
    surfaceApp
      ? surfaceModuleRolePosture(surfaceApp, role)
      : Object.freeze({
        kind: "surface.module.role.posture",
        state: "blocked",
        blockedReason: "missingBundledContract",
        role,
        moduleRef: "",
        primitiveRef: "",
        moduleCount: 0,
        modules: Object.freeze([]),
      })
  )));
  const compatibilityResult = surfaceAppCompatibilityResult(selection, options);
  const sourceCandidatePosture = isObject(selection.sourceCandidatePosture)
    ? selection.sourceCandidatePosture
    : surfaceAppSourceCandidatePosture(selection, options);
  const sourceTrustResult = surfaceAppSourceTrustResult(selection, options);
  const serviceManagerActionability = surfaceApp
    ? surfaceAppServiceManagerActionability(surfaceApp, {
      ...(isObject(options.serviceManagerActionabilityOptions) ? options.serviceManagerActionabilityOptions : {}),
      manifestSelection: selection,
      runnerPlan: manifestRunnerPlan.runnerPlan,
      sourceMode: selection.sourceMode,
      serviceManagerPosture: options.serviceManagerPosture || selection.contract?.serviceManagerPosture,
      issuedAt,
      expiresAt: options.expiresAt || selection.expiresAt,
    })
    : null;
  const runnerReadiness = deepFreeze({
    kind: "surface.app.runtime.runner.readiness",
    state: manifestRunnerPlan.state,
    runnerRequirementRefs: Object.freeze([...selection.runnerRequirementRefs]),
    planId: manifestRunnerPlan.planId,
    runnerPlanId: String(manifestRunnerPlan.runnerPlan?.planId || ""),
    blockedReasons: Object.freeze([...manifestRunnerPlan.blockedReasons]),
  });
  const serviceManagerReadiness = surfaceAppServiceManagerReadiness(selection, {
    ...options,
    serviceManagerActionability,
  });
  const fulfillmentIdentityPosture = surfaceApp
    ? surfaceAppFulfillmentIdentityPosture(surfaceApp, {
      ...(isObject(options.fulfillmentIdentityOptions) ? options.fulfillmentIdentityOptions : {}),
      serviceManagerPosture: options.fulfillmentIdentityOptions?.serviceManagerPosture || selection.contract?.serviceManagerPosture,
      issuedAt,
      expiresAt: options.expiresAt || selection.expiresAt,
    })
    : null;
  const authorityAccessPosture = surfaceApp
    ? surfaceAppAuthorityAccessPosture(surfaceApp, {
      ...(isObject(options.authorityAccessOptions) ? options.authorityAccessOptions : {}),
      fulfillmentIdentityPosture,
      manifestSelection: selection,
      secretBoundary: options.authorityAccessOptions?.secretBoundary || selection.contract?.secretBoundary,
      serviceManagerPosture: options.authorityAccessOptions?.serviceManagerPosture || selection.contract?.serviceManagerPosture,
      issuedAt,
      expiresAt: options.expiresAt || selection.expiresAt,
    })
    : null;
  const appContractResolution = surfaceAppContractResolution(surfaceApp, selection, {
    ...(isObject(options.contractResolutionOptions) ? options.contractResolutionOptions : {}),
    compatibilityResult,
    issuedAt,
    expiresAt: options.expiresAt || selection.expiresAt,
  });
  const activityPosture = surfaceApp
    ? surfaceAppActivityPosture(surfaceApp, options.activityRef || options.activityId || selection.selectedActivityRef || "", {
      ...(isObject(options.activityOptions) ? options.activityOptions : {}),
      issuedAt,
      expiresAt: options.expiresAt || selection.expiresAt,
    })
    : null;
  const releaseResolution = surfaceAppReleaseResolution(surfaceApp, selection, {
    ...(isObject(options.releaseResolutionOptions) ? options.releaseResolutionOptions : {}),
    contractResolution: appContractResolution,
    selectedActivityRef: activityPosture?.selectedActivityRef,
    sourceCandidatePosture,
    compatibilityResult,
    issuedAt,
    expiresAt: options.expiresAt || selection.expiresAt,
  });
  const blockedReasons = uniqueStrings([
    ...selection.blockedReasons.map((reason) => `manifest:${reason}`),
    ...compatibilityResult.blockedReasons.map((reason) => `compatibility:${reason}`),
    ...sourceTrustResult.blockedReasons.map((reason) => `source:${reason}`),
    ...prefixedBlockedReasons(appContractResolution, "contractResolution"),
    ...prefixedBlockedReasons(activityPosture, "activity"),
    ...prefixedBlockedReasons(releaseResolution, "releaseResolution"),
    ...modulePostures
      .filter((posture) => posture.state === "blocked")
      .map((posture) => `module:${posture.role}:${posture.blockedReason}`),
    ...prefixedBlockedReasons(runnerReadiness, "runner"),
    ...prefixedBlockedReasons(serviceManagerReadiness, "serviceManager"),
    ...prefixedBlockedReasons(serviceManagerActionability, "serviceManager"),
    ...prefixedBlockedReasons(fulfillmentIdentityPosture, "identity"),
    ...prefixedBlockedReasons(authorityAccessPosture, "authorityAccess"),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const degraded = [
    compatibilityResult,
    sourceTrustResult,
    appContractResolution,
    serviceManagerReadiness,
    serviceManagerActionability,
    fulfillmentIdentityPosture,
    authorityAccessPosture,
  ].some((posture) => String(posture?.state || "") === "degraded" || String(posture?.state || "") === "unchecked");
  return deepFreeze({
    kind: "surface.app.runtime.selection.posture",
    selectionId: String(options.selectionId || `runtime-selection:${selection.manifestId || selection.appId || "surface-app"}`),
    state: blockedReasons.length ? "blocked" : (degraded ? "degraded" : "ready"),
    requestedAppRef,
    requestedVersion,
    manifestId: selection.manifestId,
    appId: selection.appId,
    pinnedAppContractRef: selection.appContractRef,
    pinnedVersion: selection.version,
    sourceMode: selection.sourceMode,
    requiredModuleRoles,
    compatibilityResult,
    appContractResolution,
    activityPosture,
    releaseResolution,
    requiredPrimitiveRefs: appContractResolution.requiredPrimitiveRefs,
    activityRefs: appContractResolution.activityRefs,
    selectedActivityRef: activityPosture?.selectedActivityRef || releaseResolution.selectedActivityRef,
    permissionRequirementRefs: appContractResolution.permissionRequirementRefs,
    capabilityRequirementRefs: appContractResolution.capabilityRequirementRefs,
    projectionSubscriptionRefs: appContractResolution.projectionSubscriptionRefs,
    materializationBudgetRefs: appContractResolution.materializationBudgetRefs,
    accessRequirementRefs: appContractResolution.accessRequirementRefs,
    sourceCandidatePosture,
    sourceTrustResult,
    modulePostures,
    runnerReadiness,
    serviceManagerReadiness,
    serviceManagerActionability,
    fulfillmentIdentityPosture,
    authorityAccessPosture,
    manifestSelection: selection,
    manifestRunnerPlan,
    runnerPlan: manifestRunnerPlan.runnerPlan,
    blockedReasons,
    issuedAt,
    expiresAt: options.expiresAt || selection.expiresAt,
  });
}

export function surfaceAppInstancePosture(surfaceAppOrContract, options = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const contract = surfaceApp.contract;
  const runtimeSelectionPosture = isObject(options.runtimeSelectionPosture)
    ? options.runtimeSelectionPosture
    : null;
  const runnerPlan = isObject(options.runnerPlan)
    ? options.runnerPlan
    : (isObject(runtimeSelectionPosture?.runnerPlan) ? runtimeSelectionPosture.runnerPlan : null);
  const bootstrapContract = isObject(options.bootstrapContract)
    ? options.bootstrapContract
    : (isObject(runnerPlan?.bootstrapContract) ? runnerPlan.bootstrapContract : null);
  const bootstrapPosture = isObject(options.bootstrapPosture)
    ? options.bootstrapPosture
    : (isObject(contract.bootstrapPosture) ? contract.bootstrapPosture : null);
  const runnerFulfillmentReport = isObject(options.runnerFulfillmentReport)
    ? options.runnerFulfillmentReport
    : (isObject(runtimeSelectionPosture?.runnerFulfillmentReport) ? runtimeSelectionPosture.runnerFulfillmentReport : null);
  const runnerFulfillmentLifecycle = surfaceAppRunnerFulfillmentLifecycle(runnerFulfillmentReport, {
    appContract: contract,
    observedAt: options.observedAt,
  });
  const runnerFulfillmentReadiness = surfaceAppRunnerFulfillmentReadiness(runnerFulfillmentReport, {
    appContract: contract,
    observedAt: options.observedAt,
  });
  const serviceManagerOperationPosture = isObject(options.serviceManagerOperationPosture)
    ? options.serviceManagerOperationPosture
    : null;
  const serviceManagerProofDigest = isObject(options.serviceManagerProofDigest)
    ? options.serviceManagerProofDigest
    : null;
  const serviceManagerActionability = isObject(options.serviceManagerActionability)
    ? options.serviceManagerActionability
    : (isObject(runtimeSelectionPosture?.serviceManagerActionability)
      ? runtimeSelectionPosture.serviceManagerActionability
      : surfaceAppServiceManagerActionability(surfaceApp, {
        runnerPlan,
        serviceManagerPosture: contract.serviceManagerPosture,
        operationPostures: serviceManagerOperationPosture ? [serviceManagerOperationPosture] : [],
        proofDigest: serviceManagerProofDigest,
        issuedAt: options.issuedAt,
        expiresAt: options.expiresAt || runtimeSelectionPosture?.expiresAt || contract.expiresAt,
      }));
  const fulfillmentIdentityPosture = isObject(options.fulfillmentIdentityPosture)
    ? options.fulfillmentIdentityPosture
    : (isObject(runtimeSelectionPosture?.fulfillmentIdentityPosture)
      ? runtimeSelectionPosture.fulfillmentIdentityPosture
      : surfaceAppFulfillmentIdentityPosture(surfaceApp, {
        ...(isObject(options.fulfillmentIdentityOptions) ? options.fulfillmentIdentityOptions : {}),
        serviceManagerPosture: options.fulfillmentIdentityOptions?.serviceManagerPosture || contract.serviceManagerPosture,
        issuedAt: options.issuedAt,
        expiresAt: options.expiresAt || runtimeSelectionPosture?.expiresAt || contract.expiresAt,
      }));
  const authorityAccessPosture = isObject(options.authorityAccessPosture)
    ? options.authorityAccessPosture
    : (isObject(runtimeSelectionPosture?.authorityAccessPosture)
      ? runtimeSelectionPosture.authorityAccessPosture
      : surfaceAppAuthorityAccessPosture(surfaceApp, {
        ...(isObject(options.authorityAccessOptions) ? options.authorityAccessOptions : {}),
        fulfillmentIdentityPosture,
        runtimeSelectionPosture,
        secretBoundary: options.authorityAccessOptions?.secretBoundary || contract.secretBoundary,
        serviceManagerPosture: options.authorityAccessOptions?.serviceManagerPosture || contract.serviceManagerPosture,
        issuedAt: options.issuedAt,
        expiresAt: options.expiresAt || runtimeSelectionPosture?.expiresAt || contract.expiresAt,
      }));
  const moduleBindingPosture = surfaceAppModuleBindingPosture(options.moduleBindings || options.moduleBindingPosture);
  const modulePostures = deepFreeze((Array.isArray(options.modulePostures) && options.modulePostures.length
    ? options.modulePostures
    : (Array.isArray(runtimeSelectionPosture?.modulePostures) && runtimeSelectionPosture.modulePostures.length
      ? runtimeSelectionPosture.modulePostures
      : (Array.isArray(runnerPlan?.modulePostures) && runnerPlan.modulePostures.length
        ? runnerPlan.modulePostures
        : surfaceApp.requiredRoles.map((role) => surfaceModuleRolePosture(surfaceApp, role)))))
    .filter(isObject)
    .map((posture) => ({ ...posture })));
  const manifestSelection = isObject(runtimeSelectionPosture?.manifestSelection)
    ? runtimeSelectionPosture.manifestSelection
    : {};
  const manifest = isObject(options.manifest) ? options.manifest : {};
  const requiredModuleRoles = uniqueStrings([
    ...normalizeStringArray(runtimeSelectionPosture?.requiredModuleRoles),
    ...surfaceApp.requiredRoles,
  ]);
  const blockedReasons = uniqueStrings([
    ...surfaceApp.missingRoles.map((role) => `module:${role}:missingModuleRole`),
    ...instancePostureBlockedReasons(runtimeSelectionPosture, "runtimeSelection"),
    ...modulePostures
      .filter((posture) => String(posture.state || "") === "blocked")
      .map((posture) => `module:${posture.role || "unknown"}:${posture.blockedReason || "blocked"}`),
    ...instancePostureBlockedReasons(moduleBindingPosture, "moduleBinding"),
    ...instancePostureBlockedReasons(runnerPlan, "runner"),
    ...instancePostureBlockedReasons(runnerFulfillmentReadiness, "runnerFulfillment"),
    ...instancePostureBlockedReasons(bootstrapContract, "bootstrapContract"),
    ...instancePostureBlockedReasons(bootstrapPosture, "bootstrap"),
    ...instancePostureBlockedReasons(fulfillmentIdentityPosture, "identity"),
    ...instancePostureBlockedReasons(authorityAccessPosture, "authorityAccess"),
    ...instancePostureBlockedReasons(serviceManagerActionability, "serviceManager"),
    ...instancePostureBlockedReasons(serviceManagerOperationPosture, "serviceManagerOperation"),
    ...instancePostureBlockedReasons(serviceManagerProofDigest, "serviceManagerProof"),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const degraded = [
    runtimeSelectionPosture,
    moduleBindingPosture,
    runnerPlan,
    runnerFulfillmentReadiness,
    bootstrapContract,
    bootstrapPosture,
    fulfillmentIdentityPosture,
    authorityAccessPosture,
    serviceManagerActionability,
    serviceManagerOperationPosture,
    serviceManagerProofDigest,
  ].some(postureIsInstanceDegraded);
  const issuedAt = Number(options.issuedAt
    || runtimeSelectionPosture?.issuedAt
    || runnerPlan?.issuedAt
    || bootstrapPosture?.issuedAt
    || contract.issuedAt
    || Date.now());
  const instanceId = String(options.instanceId
    || runtimeSelectionPosture?.selectionId
    || `surface-instance:${contract.contractId || contract.appId || "surface-app"}`);
  return deepFreeze({
    kind: "surface.app.instance.posture",
    instanceId,
    state: blockedReasons.length ? "blocked" : (degraded ? "degraded" : "ready"),
    contractId: String(contract.contractId || ""),
    appId: String(contract.appId || ""),
    appRef: String(contract.appRef || runtimeSelectionPosture?.pinnedAppContractRef || ""),
    serviceRef: String(contract.serviceRef || ""),
    surfaceRef: String(contract.surfaceRef || ""),
    displayName: String(contract.displayName || ""),
    version: String(contract.version || runtimeSelectionPosture?.pinnedVersion || ""),
    manifestId: String(runtimeSelectionPosture?.manifestId || manifestSelection.manifestId || manifest.manifestId || ""),
    pinnedAppContractRef: String(runtimeSelectionPosture?.pinnedAppContractRef || manifestSelection.appContractRef || manifest.currentAppContractRef || contract.appRef || ""),
    pinnedVersion: String(runtimeSelectionPosture?.pinnedVersion || manifestSelection.version || manifest.currentVersion || contract.version || ""),
    sourceMode: String(runtimeSelectionPosture?.sourceMode || manifestSelection.sourceMode || dominantFulfillmentMode(surfaceApp.modules) || "bundled"),
    sourceTrustResult: isObject(runtimeSelectionPosture?.sourceTrustResult) ? deepFreeze({ ...runtimeSelectionPosture.sourceTrustResult }) : null,
    compatibilityResult: isObject(runtimeSelectionPosture?.compatibilityResult) ? deepFreeze({ ...runtimeSelectionPosture.compatibilityResult }) : null,
    requiredModuleRoles,
    moduleRefs: surfaceApp.modules.map((module) => module.moduleRef),
    modulePostures,
    moduleBindingPosture,
    materializationBudgetRefs: (contract.materializationBudgets || [])
      .map((budget) => String(budget?.budgetId || "").trim())
      .filter(Boolean),
    runtimeSelectionPosture: runtimeSelectionPosture ? deepFreeze({ ...runtimeSelectionPosture }) : null,
    runnerReadiness: isObject(runtimeSelectionPosture?.runnerReadiness)
      ? deepFreeze({ ...runtimeSelectionPosture.runnerReadiness })
      : (runnerFulfillmentReadiness || surfaceAppRunnerReadinessFromPlan(runnerPlan)),
    serviceManagerReadiness: isObject(runtimeSelectionPosture?.serviceManagerReadiness)
      ? deepFreeze({ ...runtimeSelectionPosture.serviceManagerReadiness })
      : surfaceAppServiceManagerReadinessFromOperation(serviceManagerOperationPosture),
    serviceManagerActionability,
    runnerPlanRef: String(runnerPlan?.planId || ""),
    runnerFulfillmentRef: String(runnerFulfillmentReport?.reportId || ""),
    runnerFulfillmentLifecycle,
    runnerFulfillmentReadiness,
    bootstrapContractRef: String(bootstrapContract?.bootstrapContractId || bootstrapContract?.contractId || ""),
    bootstrapPosture,
    fulfillmentIdentityPosture,
    authorityAccessPosture,
    serviceManagerOperationRef: String(serviceManagerOperationPosture?.operationId || ""),
    serviceManagerProofRef: String(serviceManagerProofDigest?.digestId || ""),
    blockedReasons,
    issuedAt,
    expiresAt: options.expiresAt || runtimeSelectionPosture?.expiresAt || runnerPlan?.expiresAt || contract.expiresAt,
  });
}

export function surfaceAppRunnerFulfillmentReadiness(report, options = {}) {
  if (!isObject(report)) return null;
  const lifecycle = surfaceAppRunnerFulfillmentLifecycle(report, options);
  if (!lifecycle) return null;
  const reportState = String(lifecycle.state || "unknown").trim();
  const terminalBlocked = ["blocked", "failed", "rejected", "cancelled", "expired"].includes(reportState);
  const blockedReasons = uniqueStrings([
    ...normalizeStringArray(lifecycle.blockedReasons),
    ...(terminalBlocked ? [`fulfillment:${reportState}`] : []),
  ]);
  const state = blockedReasons.length
    ? "blocked"
    : (reportState === "succeeded" || reportState === "released" ? "ready"
      : (["accepted", "requested", "running", "rolledBack"].includes(reportState) ? "degraded" : reportState));
  return deepFreeze({
    kind: "surface.app.runner.fulfillment.readiness",
    state,
    reportId: lifecycle.reportId,
    runnerId: lifecycle.runnerId,
    runnerRef: lifecycle.runnerRef,
    hostRef: lifecycle.hostRef,
    runnerOperationId: lifecycle.runnerOperationId,
    operation: lifecycle.operation,
    appContractRef: lifecycle.appContractRef,
    manifestRef: lifecycle.manifestRef,
    sourceMode: lifecycle.sourceMode,
    outputRefs: lifecycle.outputRefs,
    proofRefs: lifecycle.proofRefs,
    releaseRefs: lifecycle.releaseRefs,
    evidenceRefs: lifecycle.evidenceRefs,
    resourcePosture: lifecycle.resourcePosture,
    hostFulfillmentPosture: lifecycle.hostFulfillmentPosture,
    operationPosture: lifecycle.operationPosture,
    fulfillmentPosture: lifecycle.fulfillmentPosture,
    blockedReasons,
    observedAt: lifecycle.observedAt,
    expiresAt: lifecycle.expiresAt,
  });
}

export function surfaceAppRunnerFulfillmentLifecycle(report, options = {}) {
  if (!isObject(report)) return null;
  const contract = isObject(options.appContract) ? options.appContract : {};
  const expectedRefs = uniqueStrings([
    options.appContractRef,
    contract.appRef,
    contract.contractId,
    contract.appId && contract.version ? `${contract.appId}@${contract.version}` : "",
  ]);
  const reportAppRef = String(report.appContractRef || report.contractRef || contract.appRef || contract.contractId || "").trim();
  const reportKind = String(report.kind || "").trim();
  const reportObservedAt = Number(report.observedAt || 0);
  const effectiveObservedAt = Number(options.now || options.observedAt || reportObservedAt || Date.now());
  const reportState = String(report.state || "unknown").trim();
  const reportExpiresAt = Number(report.expiresAt || 0);
  const expired = Boolean(reportExpiresAt && reportExpiresAt <= effectiveObservedAt);
  const terminalBlocked = ["blocked", "failed", "rejected", "cancelled"].includes(reportState);
  const blockedReasons = uniqueStrings([
    ...normalizeStringArray(report.blockedReasons),
    ...(reportKind !== "app.runner.fulfillment.report" ? ["invalidRunnerFulfillmentReport"] : []),
    ...(terminalBlocked ? [`fulfillment:${reportState}`] : []),
    ...(expired ? ["fulfillmentExpired"] : []),
    ...(reportAppRef && expectedRefs.length && !expectedRefs.includes(reportAppRef) ? ["appContractRefMismatch"] : []),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const state = blockedReasons.length
    ? (expired ? "expired" : "blocked")
    : reportState;
  const hostFulfillmentPosture = isObject(report.hostFulfillmentPosture)
    ? deepFreeze({ ...report.hostFulfillmentPosture })
    : null;
  const operationPosture = isObject(report.operationPosture) ? deepFreeze({ ...report.operationPosture }) : null;
  const fulfillmentPosture = isObject(report.fulfillmentPosture) ? deepFreeze({ ...report.fulfillmentPosture }) : null;
  return deepFreeze({
    kind: "app.runner.fulfillment.lifecycle",
    lifecycleId: String(options.lifecycleId || `app-runner-lifecycle:${report.reportId || report.runnerOperationId || "unknown"}`),
    reportId: String(report.reportId || ""),
    runnerId: String(report.runnerId || ""),
    runnerRef: String(report.runnerRef || ""),
    hostRef: String(report.hostRef || ""),
    runnerOperationId: String(report.runnerOperationId || report.operationId || ""),
    operation: String(report.operation || ""),
    state,
    requesterRef: String(report.requesterRef || ""),
    subjectRef: String(report.subjectRef || ""),
    contractRef: String(report.contractRef || ""),
    appContractRef: reportAppRef,
    appId: String(report.appId || contract.appId || ""),
    version: String(report.version || contract.version || ""),
    manifestRef: String(report.manifestRef || ""),
    sourceMode: String(report.sourceMode || ""),
    sourceRefs: uniqueStrings(normalizeStringArray(report.sourceRefs)),
    grantRefs: uniqueStrings(normalizeStringArray(report.grantRefs)),
    capabilityRefs: uniqueStrings(normalizeStringArray(report.capabilityRefs)),
    inputRefs: uniqueStrings(normalizeStringArray(report.inputRefs)),
    outputRefs: uniqueStrings(normalizeStringArray(report.outputRefs)),
    evidenceRefs: uniqueStrings(normalizeStringArray(report.evidenceRefs)),
    proofRefs: uniqueStrings(normalizeStringArray(report.proofRefs)),
    releaseRefs: uniqueStrings(normalizeStringArray(report.releaseRefs)),
    witnessRefs: uniqueStrings([
      ...normalizeStringArray(report.witnessRefs),
      ...normalizeStringArray(options.witnessRefs),
    ]),
    releaseWitnessRefs: uniqueStrings([
      ...normalizeStringArray(report.releaseWitnessRefs),
      ...normalizeStringArray(options.releaseWitnessRefs),
    ]),
    resourceBudget: isObject(report.resourceBudget) ? deepFreeze({ ...report.resourceBudget }) : null,
    resourcePosture: isObject(report.resourcePosture) ? deepFreeze({ ...report.resourcePosture }) : null,
    secretBoundary: isObject(report.secretBoundary) ? deepFreeze({ ...report.secretBoundary }) : undefined,
    releasePosture: isObject(report.releasePosture) ? deepFreeze({ ...report.releasePosture }) : null,
    rollbackPosture: isObject(report.rollbackPosture) ? deepFreeze({ ...report.rollbackPosture }) : null,
    hostFulfillmentPosture,
    ...(String(report.releaseRef || "").trim() ? { releaseRef: String(report.releaseRef).trim() } : {}),
    ...(String(report.rollbackRef || "").trim() ? { rollbackRef: String(report.rollbackRef).trim() } : {}),
    operationPosture,
    fulfillmentPosture,
    safeFacts: isObject(report.safeFacts) ? deepFreeze({ ...report.safeFacts }) : undefined,
    blockedReasons,
    requestedAt: Number(operationPosture?.requestedAt || report.requestedAt || 0) || undefined,
    acceptedAt: Number(operationPosture?.acceptedAt || report.acceptedAt || 0) || undefined,
    startedAt: Number(operationPosture?.startedAt || report.startedAt || 0) || undefined,
    completedAt: Number(operationPosture?.completedAt || report.completedAt || 0) || undefined,
    releasedAt: Number(report.releasedAt || (state === "released" ? effectiveObservedAt : 0)) || undefined,
    rolledBackAt: Number(report.rolledBackAt || (state === "rolledBack" ? effectiveObservedAt : 0)) || undefined,
    rejectedAt: Number(report.rejectedAt || (["blocked", "failed", "rejected", "cancelled"].includes(state) ? effectiveObservedAt : 0)) || undefined,
    expiredAt: Number(report.expiredAt || (state === "expired" ? effectiveObservedAt : 0)) || undefined,
    observedAt: effectiveObservedAt,
    expiresAt: report.expiresAt || options.expiresAt,
  });
}

export function surfaceAppRunnerPlan(surfaceAppOrContract, options = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const contract = surfaceApp.contract;
  const sourceMode = String(options.sourceMode || dominantFulfillmentMode(surfaceApp.modules) || "bundled");
  const secretBoundary = surfaceServiceManagerSecretBoundary(surfaceApp, {
    secretBoundary: isObject(options.secretBoundary) ? options.secretBoundary : contract.secretBoundary,
    serviceManagerPosture: options.serviceManagerPosture,
    required: Boolean(options.secretBoundaryRequired ?? false),
    issuedAt: options.issuedAt,
  });
  const needsRelease = Boolean(options.includeReleaseContract || nonBundledSourceMode(sourceMode));
  const releaseContract = needsRelease
    ? surfaceServiceManagerReleaseContract(surfaceApp, {
      ...options.releaseContractOptions,
      sourceMode,
      secretBoundaryRecord: secretBoundary,
      serviceManagerPosture: options.serviceManagerPosture,
      issuedAt: options.issuedAt,
    })
    : null;
  const labProof = isObject(options.labProofOptions)
    ? surfaceServiceManagerLabProof(surfaceApp, {
      ...options.labProofOptions,
      releaseContractRef: releaseContract?.contractId || options.labProofOptions.releaseContractRef,
    })
    : null;
  const proofDigest = isObject(options.proofDigestOptions)
    ? surfaceServiceManagerProofDigest(surfaceApp, options.proofDigestOptions)
    : null;
  const trainDigest = isObject(options.trainDigestOptions)
    ? surfaceServiceManagerTrainDigest(surfaceApp, {
      ...options.trainDigestOptions,
      releaseContractRefs: uniqueStrings([
        releaseContract?.contractId,
        ...normalizeStringArray(options.trainDigestOptions.releaseContractRefs),
      ]),
      labProofRefs: uniqueStrings([
        labProof?.proofId,
        ...normalizeStringArray(options.trainDigestOptions.labProofRefs),
      ]),
      proofDigestRefs: uniqueStrings([
        proofDigest?.digestId,
        ...normalizeStringArray(options.trainDigestOptions.proofDigestRefs),
      ]),
    })
    : null;
  const bootstrapContract = surfaceAppBootstrapContract(surfaceApp, {
    ...options.bootstrapContractOptions,
    sourceMode,
    secretBoundaryRecord: secretBoundary,
    releaseContract,
    trainDigestRef: trainDigest?.trainId || options.bootstrapContractOptions?.trainDigestRef,
    serviceManagerPosture: options.serviceManagerPosture,
    issuedAt: options.issuedAt,
  });
  const modulePostures = deepFreeze(surfaceApp.requiredRoles.map((role) => surfaceModuleRolePosture(surfaceApp, role)));
  const blockedReasons = uniqueStrings([
    ...surfaceApp.missingRoles.map((role) => `missingModuleRole:${role}`),
    ...prefixedBlockedReasons(secretBoundary, "secretBoundary"),
    ...prefixedBlockedReasons(releaseContract, "release"),
    ...prefixedBlockedReasons(bootstrapContract, "bootstrap"),
    ...prefixedBlockedReasons(labProof, "labProof"),
    ...prefixedBlockedReasons(proofDigest, "proofDigest"),
    ...prefixedBlockedReasons(trainDigest, "trainDigest"),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  return deepFreeze({
    kind: "surface.app.runner.plan",
    planId: String(options.planId || `surface-runner:${contract.contractId || contract.appId || "surface-app"}`),
    contractId: String(contract.contractId || ""),
    appId: String(contract.appId || ""),
    state: blockedReasons.length ? "blocked" : "ready",
    sourceMode,
    attachContext: surfaceAppAttachContext(surfaceApp, options.attachContext || {}),
    modulePostures,
    secretBoundary,
    releaseContract,
    bootstrapContract,
    labProof,
    proofDigest,
    trainDigest,
    blockedReasons,
    issuedAt: Number(options.issuedAt || Date.now()),
    expiresAt: options.expiresAt || contract.expiresAt,
  });
}

export function surfaceModuleRolePosture(surfaceAppOrContract, role, options = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const issuedAt = Number(options.issuedAt || surfaceApp.contract.issuedAt || Date.now());
  const roleRef = String(role || "");
  const moduleRef = String(options.moduleRef || "").trim();
  const primitiveRef = String(options.primitiveRef || "").trim();
  const modules = surfaceApp.modulesForRole(roleRef)
    .filter((module) => !moduleRef || String(module.moduleRef || "") === moduleRef)
    .filter((module) => !primitiveRef || module.primitiveRefs.includes(primitiveRef));
  const state = modules.length ? "ready" : "blocked";
  return Object.freeze({
    kind: "surface.module.role.posture",
    state,
    blockedReason: state === "ready" ? "" : surfaceModuleBlockedReason(surfaceApp, roleRef, moduleRef, primitiveRef),
    role: roleRef,
    moduleRef,
    primitiveRef,
    moduleCount: modules.length,
    modules: Object.freeze(modules.map((module) => Object.freeze({
      ...module,
      issuedAt: Number(module.issuedAt || issuedAt),
    }))),
  });
}

export function requireSurfaceModuleRole(surfaceAppOrContract, role, options = {}) {
  const posture = surfaceModuleRolePosture(surfaceAppOrContract, role, options);
  if (posture.state !== "ready") {
    const detail = [posture.blockedReason, posture.role, posture.moduleRef, posture.primitiveRef]
      .filter(Boolean)
      .join(" ");
    throw new Error(`surface module role unavailable: ${detail}`.trim());
  }
  return posture.modules[0];
}

export function surfaceMaterializationBudgetPosture(surfaceAppOrContract, budgetId, options = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const requestedBudgetId = String(budgetId || "").trim();
  const payloadClass = String(options.payloadClass || "").trim();
  const copyRole = String(options.copyRole || "").trim();
  const transferMode = String(options.transferMode || "").trim();
  const budgets = surfaceApp.contract.materializationBudgets || [];
  const budget = budgets.find((entry) => String(entry?.budgetId || "") === requestedBudgetId) || null;
  const blockedReason = materializationBudgetBlockedReason(budget, requestedBudgetId, {
    payloadClass,
    copyRole,
    transferMode,
  });
  const state = blockedReason ? "blocked" : "ready";
  return Object.freeze({
    kind: "surface.materialization.budget.posture",
    state,
    blockedReason,
    budgetId: requestedBudgetId,
    payloadClass,
    copyRole,
    transferMode,
    budget: budget ? Object.freeze({ ...budget }) : null,
  });
}

export function requireSurfaceMaterializationBudget(surfaceAppOrContract, budgetId, options = {}) {
  const posture = surfaceMaterializationBudgetPosture(surfaceAppOrContract, budgetId, options);
  if (posture.state !== "ready") {
    const detail = [posture.blockedReason, posture.budgetId, posture.payloadClass, posture.copyRole, posture.transferMode]
      .filter(Boolean)
      .join(" ");
    throw new Error(`surface materialization budget unavailable: ${detail}`.trim());
  }
  return posture.budget;
}

export function materializationBudgetLimit(budget, key, fallback = 0) {
  const limitKey = String(key || "").trim();
  if (!limitKey || !isObject(budget)) return fallback;
  const limits = isObject(budget.limits) ? budget.limits : {};
  const value = Number(limits[limitKey] ?? budget[limitKey]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function materializationBudgetUsage(budget, {
  sourceCount = 0,
  materializedCount = sourceCount,
  sourceLimitKey = "maxSourceItems",
  materializedLimitKey = "maxItems",
  blockedReason = "materializationBudgetPressure",
  sampledAt = Date.now(),
} = {}) {
  const sourceTotal = normalizedCount(sourceCount);
  const materializedTotal = normalizedCount(materializedCount);
  const materializedLimit = materializationBudgetLimit(budget, materializedLimitKey, Number.POSITIVE_INFINITY);
  const sourceLimit = materializationBudgetLimit(budget, sourceLimitKey, materializedLimit);
  const sourceOver = sourceTotal > sourceLimit;
  const materializedOver = materializedTotal > materializedLimit;
  const overBudget = sourceOver || materializedOver;
  return Object.freeze({
    kind: "surface.materialization.usage",
    budgetId: String(budget?.budgetId || ""),
    state: overBudget ? "pressure" : "withinBudget",
    sourceCount: sourceTotal,
    materializedCount: materializedTotal,
    sourceLimit,
    materializedLimit,
    sourceLimitKey,
    materializedLimitKey,
    overBudget,
    blockedReasons: Object.freeze(overBudget ? [String(blockedReason || "materializationBudgetPressure")] : []),
    sampledAt,
  });
}

export function materializationBudgetRecord(budget, {
  sourceCount = 0,
  materializedCount = sourceCount,
  sourceLimitKey = "maxSourceItems",
  materializedLimitKey = "maxItems",
  blockedReason = "materializationBudgetPressure",
  limits = {},
  consumerFloor = undefined,
  sampledAt = Date.now(),
  expiresInMs = 60_000,
  ...overrides
} = {}) {
  const usage = materializationBudgetUsage(budget, {
    sourceCount,
    materializedCount,
    sourceLimitKey,
    materializedLimitKey,
    blockedReason,
    sampledAt,
  });
  const mergedLimits = {
    ...(isObject(budget?.limits) ? budget.limits : {}),
    ...(isObject(limits) ? limits : {}),
    sourceCount: usage.sourceCount,
    materializedCount: usage.materializedCount,
  };
  const record = {
    ...(isObject(budget) ? budget : {}),
    ...overrides,
    state: usage.state,
    limits: mergedLimits,
    blockedReasons: usage.blockedReasons,
    issuedAt: Number(overrides.issuedAt || sampledAt),
    releaseAfter: Number(overrides.releaseAfter || sampledAt),
    expiresAt: Number(overrides.expiresAt || (sampledAt + expiresInMs)),
  };
  if (consumerFloor !== undefined) record.consumerFloor = consumerFloor;
  return record;
}

export function materializationConsumerFloorRecord(budget, {
  floorId = "",
  consumerRef = "",
  materializationId = "",
  subjectRef = "",
  sourceCount = 0,
  materializedCount = sourceCount,
  sourceLimitKey = "maxSourceItems",
  materializedLimitKey = "maxItems",
  cursor = undefined,
  eventTimeFloor = undefined,
  observedTimeFloor = undefined,
  reason = "",
  replay = undefined,
  redelivery = undefined,
  sampledAt = Date.now(),
  expiresInMs = 60_000,
} = {}) {
  const usage = materializationBudgetUsage(budget, {
    sourceCount,
    materializedCount,
    sourceLimitKey,
    materializedLimitKey,
    blockedReason: reason || "materializationConsumerLag",
    sampledAt,
  });
  const lagState = usage.overBudget ? "lagging" : "caughtUp";
  const floor = {
    kind: "consumer.floor",
    floorId: String(floorId || `floor:${materializationId || budget?.budgetId || "materialization"}`),
    consumerRef: String(consumerRef || budget?.consumerRef || ""),
    materializationId: String(materializationId || budget?.budgetId || ""),
    subjectRef: String(subjectRef || ""),
    ackFloor: String(usage.materializedCount),
    witnessFloor: String(usage.materializedCount),
    compactionFloor: String(Math.min(usage.sourceCount, usage.materializedLimit)),
    observedTimeFloor: observedTimeFloor || sampledAt,
    lagState,
    sampledAt,
    expiresAt: sampledAt + expiresInMs,
  };
  if (cursor !== undefined) floor.cursor = cursor;
  if (eventTimeFloor !== undefined) floor.eventTimeFloor = eventTimeFloor;
  if (usage.overBudget || reason) floor.reason = String(reason || usage.blockedReasons[0] || "materialization consumer lag");
  if (replay !== undefined) floor.replay = replay;
  if (redelivery !== undefined) floor.redelivery = redelivery;
  return floor;
}

export function materializationEventReplayPosture(budget, {
  sourceEvents = [],
  materializedEvents = sourceEvents,
  eventKey = defaultEventKey,
  eventTime = defaultEventTime,
  observedTime = defaultObservedTime,
  schemaVersion = defaultSchemaVersion,
  safeFacts = defaultSafeFacts,
  tags = defaultTags,
  encryptedDetailRefs = defaultEncryptedDetailRefs,
  expectedSchemaVersion = "",
  maxSafeFactKeys = materializationBudgetLimit(budget, "maxSafeFactKeys", Number.POSITIVE_INFINITY),
  maxLabelValues = materializationBudgetLimit(budget, "maxLabelValues", Number.POSITIVE_INFINITY),
  maxEncryptedDetailRefs = materializationBudgetLimit(budget, "maxEncryptedDetailRefs", Number.POSITIVE_INFINITY),
  sampledAt = Date.now(),
  consumerFloor = {},
} = {}) {
  const source = Array.isArray(sourceEvents) ? sourceEvents : [];
  const materialized = Array.isArray(materializedEvents) ? materializedEvents : [];
  const usage = materializationBudgetUsage(budget, {
    sourceCount: source.length,
    materializedCount: materialized.length,
    blockedReason: "eventReplayPressure",
    sampledAt,
  });
  const eventTimes = materialized
    .map((event) => normalizedTimeMillis(callExtractor(eventTime, event)))
    .filter((value) => value > 0);
  const observedTimes = materialized
    .map((event) => normalizedTimeMillis(callExtractor(observedTime, event)))
    .filter((value) => value > 0);
  const schemaVersions = new Map();
  let unsupportedSchemaCount = 0;
  const safeFactKeys = new Set();
  const labelValues = new Set();
  let detailRefCount = 0;
  for (const event of source) {
    const version = String(callExtractor(schemaVersion, event) || "").trim();
    if (version) {
      schemaVersions.set(version, (schemaVersions.get(version) || 0) + 1);
      if (expectedSchemaVersion && version !== String(expectedSchemaVersion)) unsupportedSchemaCount += 1;
    }
    const facts = callExtractor(safeFacts, event);
    if (isObject(facts)) {
      for (const key of Object.keys(facts)) safeFactKeys.add(key);
    }
    const eventTags = callExtractor(tags, event);
    if (Array.isArray(eventTags)) {
      for (const tag of eventTags) {
        const value = String(tag || "").trim();
        if (value) labelValues.add(value);
      }
    }
    const refs = callExtractor(encryptedDetailRefs, event);
    if (Array.isArray(refs)) detailRefCount += refs.length;
    else if (refs) detailRefCount += 1;
  }
  const cardinalityPressure = safeFactKeys.size > maxSafeFactKeys
    || labelValues.size > maxLabelValues
    || detailRefCount > maxEncryptedDetailRefs;
  const blockedReasons = [
    ...(usage.overBudget ? usage.blockedReasons : []),
    ...(unsupportedSchemaCount ? ["schemaPostureQuarantined"] : []),
    ...(safeFactKeys.size > maxSafeFactKeys ? ["safeFactCardinalityPressure"] : []),
    ...(labelValues.size > maxLabelValues ? ["labelCardinalityPressure"] : []),
    ...(detailRefCount > maxEncryptedDetailRefs ? ["encryptedDetailRefPressure"] : []),
  ];
  const state = unsupportedSchemaCount
    ? "blocked"
    : (usage.overBudget || cardinalityPressure ? "pressure" : "ready");
  const eventTimeFloor = eventTimes.length ? Math.min(...eventTimes) : undefined;
  const observedTimeFloor = observedTimes.length ? Math.max(...observedTimes) : sampledAt;
  const floor = materializationConsumerFloorRecord(budget, {
    materializationId: budget?.budgetId || "",
    sourceCount: source.length,
    materializedCount: materialized.length,
    cursor: materialized.length ? callExtractor(eventKey, materialized[materialized.length - 1]) : undefined,
    eventTimeFloor,
    observedTimeFloor,
    reason: blockedReasons[0] || "",
    replay: {
      mode: "event-replay",
      sourceCount: source.length,
      materializedCount: materialized.length,
      eventTimeFloor,
      observedTimeFloor,
    },
    redelivery: {
      mode: "cursor",
      duplicatePolicy: "eventKey",
    },
    sampledAt,
    ...(isObject(consumerFloor) ? consumerFloor : {}),
  });
  return deepFreeze({
    kind: "surface.event.replay.posture",
    budgetId: String(budget?.budgetId || ""),
    state,
    blockedReasons,
    counts: {
      source: source.length,
      materialized: materialized.length,
      detailRefs: detailRefCount,
    },
    consumerFloor: floor,
    bitemporal: {
      eventTimeFloor,
      observedTimeFloor,
      eventTimeCount: eventTimes.length,
      observedTimeCount: observedTimes.length,
    },
    schema: {
      state: unsupportedSchemaCount ? "quarantined" : "current",
      expectedVersion: String(expectedSchemaVersion || ""),
      versions: Object.fromEntries(schemaVersions.entries()),
      unsupportedCount: unsupportedSchemaCount,
    },
    privacy: {
      tiers: detailRefCount ? ["safeFacts", "encryptedDetail"] : ["safeFacts"],
      encryptedDetailRefCount: detailRefCount,
    },
    cardinality: {
      state: cardinalityPressure ? "pressure" : "withinBudget",
      safeFactKeyCount: safeFactKeys.size,
      labelValueCount: labelValues.size,
      maxSafeFactKeys,
      maxLabelValues,
      maxEncryptedDetailRefs,
    },
    sampling: {
      state: usage.overBudget || cardinalityPressure ? "summarized" : "full",
      adaptive: usage.overBudget || cardinalityPressure,
    },
  });
}

export function materializationEnforcementPosture(budget, {
  sourceCount = 0,
  materializedCount = sourceCount,
  sourceLimitKey = "maxSourceItems",
  materializedLimitKey = "maxItems",
  blockedReason = "materializationBudgetPressure",
  consumerFloor = undefined,
  replayPosture = undefined,
  upstreamPosture = undefined,
  upstreamBudget = undefined,
  referenceRefs = undefined,
  evidenceRefs = undefined,
  reason = "",
  blockedReasons = [],
  sampledAt = Date.now(),
  expiresInMs = 60_000,
} = {}) {
  const usage = materializationBudgetUsage(budget, {
    sourceCount,
    materializedCount,
    sourceLimitKey,
    materializedLimitKey,
    blockedReason,
    sampledAt,
  });
  const floor = isObject(consumerFloor)
    ? consumerFloor
    : materializationConsumerFloorRecord(budget, {
      sourceCount,
      materializedCount,
      sourceLimitKey,
      materializedLimitKey,
      sampledAt,
    });
  const replay = isObject(replayPosture) ? replayPosture : null;
  const upstream = materializationUpstreamPosture(upstreamPosture, upstreamBudget);
  const copyBoundary = materializationCopyBoundaryPosture(budget, {
    referenceRefs,
    evidenceRefs,
    sampledAt,
  });
  const floorReason = String(floor.reason || "").trim();
  const floorLagState = String(floor.lagState || "unknown").trim() || "unknown";
  const releaseBlockedReasons = uniqueStrings([
    ...normalizeStringArray(blockedReasons),
    ...usage.blockedReasons,
    ...normalizeStringArray(replay?.blockedReasons),
    ...normalizeStringArray(upstream.blockedReasons),
    ...normalizeStringArray(copyBoundary.blockedReasons),
    ...(reason ? [reason] : []),
    ...(floorReason ? [floorReason] : []),
  ]);
  const hardBlocked = releaseBlockedReasons.some((entry) => [
    "schemaPostureQuarantined",
    "materializationCopyBoundaryBlocked",
    "missingReferenceRef",
  ].includes(entry) || entry.startsWith("upstream:blocked"));
  const degraded = usage.overBudget
    || ["lagging", "stale", "blocked"].includes(floorLagState)
    || ["pressure", "blocked"].includes(String(replay?.state || ""))
    || upstream.state !== "absent" && upstream.state !== "ready"
    || copyBoundary.state !== "ready"
    || releaseBlockedReasons.length > 0;
  const state = hardBlocked || floorLagState === "blocked"
    ? "blocked"
    : (degraded ? "pressure" : "ready");
  const issuedAt = Number(sampledAt || Date.now());
  const releaseState = state === "ready" ? "releasable" : "held";
  return deepFreeze({
    kind: "surface.materialization.enforcement.posture",
    budgetId: String(budget?.budgetId || ""),
    state,
    blockedReasons: releaseBlockedReasons,
    sourceAuthority: String(budget?.sourceAuthority || ""),
    consumerRef: String(budget?.consumerRef || ""),
    payloadClass: String(budget?.payloadClass || ""),
    copyRole: String(budget?.copyRole || ""),
    transferMode: String(budget?.transferMode || ""),
    privacyTier: String(budget?.privacyTier || ""),
    usage,
    consumerFloor: floor,
    replayPosture: replay,
    upstream,
    copyBoundary,
    bitemporal: isObject(replay?.bitemporal) ? replay.bitemporal : {
      observedTimeFloor: floor.observedTimeFloor || sampledAt,
      ...(floor.eventTimeFloor !== undefined ? { eventTimeFloor: floor.eventTimeFloor } : {}),
    },
    schema: isObject(replay?.schema) ? replay.schema : (isObject(budget?.schema) ? budget.schema : null),
    privacy: isObject(replay?.privacy) ? replay.privacy : {
      tiers: String(budget?.privacyTier || "") ? [String(budget.privacyTier)] : [],
    },
    cardinality: isObject(replay?.cardinality) ? replay.cardinality : (isObject(budget?.cardinality) ? budget.cardinality : null),
    sampling: isObject(replay?.sampling) ? replay.sampling : {
      state: usage.overBudget ? "summarized" : "full",
      adaptive: usage.overBudget,
    },
    releasePosture: {
      state: releaseState,
      blockedReasons: releaseBlockedReasons,
      issuedAt,
      releaseAfter: Math.max(Number(budget?.releaseAfter || issuedAt), issuedAt),
      expiresAt: Number(budget?.expiresAt || (issuedAt + expiresInMs)),
    },
    referenceRefs: Object.freeze(referenceRefs === undefined
      ? normalizeStringArray(budget?.referenceRefs)
      : normalizeStringArray(referenceRefs)),
    evidenceRefs: Object.freeze(evidenceRefs === undefined
      ? normalizeStringArray(budget?.evidenceRefs)
      : normalizeStringArray(evidenceRefs)),
    sampledAt: issuedAt,
  });
}

function surfaceSubjectRef(contract, override) {
  return String(override || contract.serviceRef || contract.appRef || `surface-app:${contract.appId || contract.contractId || "unknown"}`);
}

function requireResolvedMemberRef(value, context) {
  const text = String(value || "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(text)) throw new Error(`${context} requires resolved member ref`);
  return text;
}

function isResolvedMemberRef(value) {
  return /^[0-9a-fA-F]{64}$/.test(String(value || "").trim());
}

function serviceManagerOperationToRunnerOperation(operation) {
  switch (String(operation || "")) {
    case "healthCheck":
      return "healthCheck";
    case "secretReady":
      return "prepare";
    case "rollback":
      return "rollback";
    case "stop":
    case "release":
      return "release";
    case "install":
    case "update":
    case "start":
    case "restart":
    case "promote":
      return "execute";
    default:
      return "execute";
  }
}

function serviceManagerStateToRunnerState(state, runnerOperation) {
  const normalized = String(state || "requested");
  if (runnerOperation === "release" && normalized === "succeeded") return "released";
  if ([
    "requested",
    "accepted",
    "running",
    "succeeded",
    "failed",
    "blocked",
    "cancelled",
    "superseded",
    "released",
    "rejected",
  ].includes(normalized)) {
    return normalized;
  }
  return "requested";
}

function assignIfPresent(target, key, value) {
  if (value === undefined || value === null) return target;
  if (typeof value === "string" && !value.trim()) return target;
  if (typeof value !== "string" && value === "") return target;
  target[key] = typeof value === "string" ? value.trim() : value;
  return target;
}

function assignObjectIfPresent(target, key, value) {
  if (!isObject(value)) return target;
  if (Object.keys(value).length === 0) return target;
  target[key] = deepFreeze({ ...value });
  return target;
}

function surfaceAppContractRef(contract, override) {
  return String(override || contract.appRef || contract.contractId || `surface-app:${contract.appId || "unknown"}`);
}

function moduleRoleRefForClaim(appContractRef, claim = {}) {
  const role = String(claim.role || claim.moduleRole || "").trim();
  const moduleRef = String(claim.moduleRef || "").trim();
  const base = String(appContractRef || "surface-app:unknown").trim();
  if (!role) return moduleRef || "";
  return `${base}:moduleRole:${role}`;
}

function surfaceAppCompatibilityResult(selection, options = {}) {
  const window = isObject(selection.compatibilityWindow) ? selection.compatibilityWindow : null;
  const runtimeVersion = String(options.runtimeVersion || options.runtimeBuildId || "").trim();
  const blockedReasons = uniqueStrings([
    ...(options.compatible === false ? ["incompatibleRuntimeVersion"] : []),
    ...(options.requireRuntimeVersion && window && !runtimeVersion ? ["missingRuntimeVersion"] : []),
    ...(window && runtimeVersion && versionBelow(runtimeVersion, window.minVersion) ? ["runtimeVersionTooOld"] : []),
    ...(window && runtimeVersion && versionAbove(runtimeVersion, window.maxVersion) ? ["runtimeVersionTooNew"] : []),
    ...normalizeStringArray(options.compatibilityBlockedReasons),
  ]);
  return deepFreeze({
    kind: "surface.app.runtime.compatibility.result",
    state: blockedReasons.length ? "blocked" : (window ? "ready" : "unchecked"),
    runtimeVersion,
    minVersion: String(window?.minVersion || ""),
    maxVersion: String(window?.maxVersion || ""),
    protocolRef: String(window?.protocolRef || ""),
    compatibilityRefs: Object.freeze([...selection.compatibilityRefs]),
    blockedReasons,
  });
}

function surfaceAppSourceTrustResult(selection, options = {}) {
  const candidatePosture = isObject(selection.sourceCandidatePosture)
    ? selection.sourceCandidatePosture
    : surfaceAppSourceCandidatePosture(selection, options);
  const sourceMode = String(candidatePosture.sourceMode || selection.sourceMode || "").trim();
  const bundled = !nonBundledSourceMode(sourceMode);
  const sourceRefs = normalizeStringArray(candidatePosture.candidateRefs);
  const blockedReasons = uniqueStrings([
    ...normalizeStringArray(candidatePosture.blockedReasons),
    ...(options.sourceTrusted === false ? ["sourceUntrusted"] : []),
    ...normalizeStringArray(options.sourceBlockedReasons),
  ]);
  return deepFreeze({
    kind: "surface.app.runtime.source.trust.result",
    state: blockedReasons.length ? "blocked" : "ready",
    sourceMode,
    sourceRefs: Object.freeze([...sourceRefs]),
    releaseContractRef: candidatePosture.releaseContractRef || selection.releaseContractRef,
    bundled,
    blockedReasons,
  });
}

function surfaceAppServiceManagerReadiness(selection, options = {}) {
  const actionability = isObject(options.serviceManagerActionability)
    ? options.serviceManagerActionability
    : null;
  const posture = isObject(options.serviceManagerPosture)
    ? options.serviceManagerPosture
    : (isObject(selection.contract?.serviceManagerPosture) ? selection.contract.serviceManagerPosture : {});
  const postureState = String(posture.state || "").trim();
  const postureReasons = normalizeStringArray(posture.blockedReasons);
  const blockedReasons = uniqueStrings([
    ...normalizeStringArray(actionability?.blockedReasons),
    ...((postureState === "blocked" || postureState === "unavailable")
      ? (postureReasons.length ? postureReasons : [postureState])
      : []),
    ...normalizeStringArray(options.serviceManagerBlockedReasons),
  ]);
  const readinessState = (() => {
    if (blockedReasons.length) return "blocked";
    if (actionability && String(actionability.state || "") === "ready") return "ready";
    if (actionability && String(actionability.state || "") === "degraded") return "degraded";
    if (postureIsDegraded(posture)) return "degraded";
    if (postureState === "ready" || postureState === "manual") return "ready";
    if (postureState === "blocked" || postureState === "unavailable") return "blocked";
    return postureState ? "unchecked" : "unknown";
  })();
  return deepFreeze({
    kind: "surface.app.runtime.service-manager.readiness",
    state: readinessState,
    serviceManagerRequirementRefs: Object.freeze([...selection.serviceManagerRequirementRefs]),
    managerId: String(actionability?.managerId || posture.managerId || posture.serviceManagerRef || ""),
    evidenceRefs: Object.freeze(uniqueStrings([
      ...normalizeStringArray(posture.evidenceRefs),
      ...normalizeStringArray(actionability?.evidenceRefs),
    ])),
    blockedReasons,
  });
}

function indexSurfaceApps(surfaceAppsOrContracts) {
  const entries = Array.isArray(surfaceAppsOrContracts)
    ? surfaceAppsOrContracts
    : (isObject(surfaceAppsOrContracts) ? Object.values(surfaceAppsOrContracts) : []);
  const index = new Map();
  for (const entry of entries) {
    if (!entry) continue;
    const surfaceApp = isDefinedSurfaceApp(entry) ? entry : defineSurfaceAppContract(entry);
    const contract = surfaceApp.contract;
    const refs = uniqueStrings([
      surfaceAppContractRef(contract),
      contract.contractId,
      contract.appRef,
      contract.appId && contract.version ? `${contract.appId}@${contract.version}` : "",
      contract.contractId && contract.version ? `${contract.contractId}@${contract.version}` : "",
    ]);
    for (const ref of refs) index.set(ref, surfaceApp);
  }
  return index;
}

function nonBundledSourceMode(sourceMode) {
  return ["swarmPackage", "storageObject", "nativeInstalled", "devOverlay"].includes(String(sourceMode || ""));
}

function surfaceAppSourceClass(sourceMode, explicitSourceClass) {
  const explicit = String(explicitSourceClass || "").trim();
  if (explicit) return explicit;
  switch (String(sourceMode || "")) {
    case "bundled":
      return "bundled";
    case "storageObject":
      return "storagePinned";
    case "swarmPackage":
      return "swarmHosted";
    case "nativeInstalled":
      return "nativeInstalled";
    case "devOverlay":
      return "devOverlay";
    default:
      return "unknown";
  }
}

function attachLocalSelectionContext(record, surfaceApp, contract) {
  if (!isObject(record)) return record;
  if (surfaceApp) {
    Object.defineProperty(record, "surfaceApp", {
      value: surfaceApp,
      enumerable: false,
      configurable: false,
    });
  }
  if (contract) {
    Object.defineProperty(record, "contract", {
      value: contract,
      enumerable: false,
      configurable: false,
    });
  }
  return record;
}

function versionParts(value) {
  return String(value || "")
    .replace(/^runtime-/, "")
    .split(".")
    .map((part) => {
      if (part === "x" || part === "*") return Number.NaN;
      const parsed = Number.parseInt(part, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });
}

function compareVersionLike(left, right) {
  if (!right) return 0;
  const a = versionParts(left);
  const b = versionParts(right);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const bv = b[i] ?? 0;
    if (Number.isNaN(bv)) return 0;
    const av = a[i] ?? 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

function versionBelow(version, minVersion) {
  return Boolean(minVersion) && compareVersionLike(version, minVersion) < 0;
}

function versionAbove(version, maxVersion) {
  return Boolean(maxVersion) && compareVersionLike(version, maxVersion) > 0;
}

function prefixedBlockedReasons(posture, prefix) {
  if (!isObject(posture) || String(posture.state || "") !== "blocked") return [];
  const reasons = normalizeStringArray(posture.blockedReasons);
  return reasons.length ? reasons.map((reason) => `${prefix}:${reason}`) : [`${prefix}:blocked`];
}

function instancePostureBlockedReasons(posture, prefix) {
  if (!isObject(posture)) return [];
  const state = String(posture.state || "").trim();
  if (!["blocked", "failed", "unavailable"].includes(state)) return [];
  const reasons = uniqueStrings([
    ...normalizeStringArray(posture.blockedReasons),
    posture.blockedReason,
    state && state !== "blocked" ? state : "",
  ]);
  return reasons.length ? reasons.map((reason) => `${prefix}:${reason}`) : [`${prefix}:blocked`];
}

function postureIsInstanceDegraded(posture) {
  if (!isObject(posture)) return false;
  return ["degraded", "pressure", "partial", "stale", "unchecked"].includes(String(posture.state || "").trim());
}

function surfaceAppModuleBindingPosture(moduleBindings) {
  if (!isObject(moduleBindings)) return null;
  const bindings = Array.isArray(moduleBindings.bindings)
    ? moduleBindings.bindings
    : (Array.isArray(moduleBindings.postures) ? moduleBindings.postures : []);
  const blockedReasons = uniqueStrings([
    ...normalizeStringArray(moduleBindings.blockedReasons),
    moduleBindings.blockedReason,
    ...bindings
      .filter((binding) => String(binding?.state || "") === "blocked")
      .map((binding) => binding.blockedReason || "blocked"),
  ]);
  return deepFreeze({
    kind: "surface.app.module.binding.posture",
    state: blockedReasons.length ? "blocked" : String(moduleBindings.state || "ready"),
    roles: normalizeStringArray(moduleBindings.roles),
    keys: normalizeStringArray(moduleBindings.keys),
    moduleRefs: bindings
      .map((binding) => String(binding?.moduleRef || "").trim())
      .filter(Boolean),
    implementationRefs: bindings
      .map((binding) => String(binding?.implementationRef || "").trim())
      .filter(Boolean),
    blockedReasons,
  });
}

function surfaceAppRunnerReadinessFromPlan(runnerPlan) {
  if (!isObject(runnerPlan)) return null;
  return deepFreeze({
    kind: "surface.app.runtime.runner.readiness",
    state: String(runnerPlan.state || "unknown"),
    runnerRequirementRefs: normalizeStringArray(runnerPlan.runnerRequirementRefs),
    planId: String(runnerPlan.planId || ""),
    runnerPlanId: String(runnerPlan.planId || ""),
    blockedReasons: normalizeStringArray(runnerPlan.blockedReasons),
  });
}

function surfaceAppServiceManagerReadinessFromOperation(operationPosture) {
  if (!isObject(operationPosture)) return null;
  return deepFreeze({
    kind: "surface.app.runtime.serviceManager.readiness",
    state: String(operationPosture.state || "unknown"),
    operationId: String(operationPosture.operationId || ""),
    managerId: String(operationPosture.managerId || ""),
    blockedReasons: normalizeStringArray(operationPosture.blockedReasons),
  });
}

function normalizeModules(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(value
    .filter(isObject)
    .map((module) => Object.freeze({
      ...module,
      primitiveRefs: Object.freeze(normalizeStringArray(module.primitiveRefs)),
      requiredCapabilities: Object.freeze(normalizeStringArray(module.requiredCapabilities)),
      inputs: Object.freeze(normalizeStringArray(module.inputs)),
      outputs: Object.freeze(normalizeStringArray(module.outputs)),
      fallbackRefs: Object.freeze(normalizeStringArray(module.fallbackRefs)),
    })));
}

function normalizeActivities(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(value
    .filter(isObject)
    .map((activity) => Object.freeze({
      ...activity,
      primitiveRefs: Object.freeze(normalizeStringArray(activity.primitiveRefs)),
      moduleRoleRefs: Object.freeze(normalizeStringArray(activity.moduleRoleRefs)),
      permissionRefs: Object.freeze(normalizeStringArray(activity.permissionRefs)),
      accessGroupRefs: Object.freeze(normalizeStringArray(activity.accessGroupRefs)),
      materializationRefs: Object.freeze(normalizeStringArray(activity.materializationRefs)),
      evidenceRefs: Object.freeze(normalizeStringArray(activity.evidenceRefs)),
      blockedReasons: Object.freeze(normalizeStringArray(activity.blockedReasons)),
    })));
}

function normalizeActivityDependencies(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(value
    .filter(isObject)
    .map((dependency) => Object.freeze({
      ...dependency,
      contractRefs: Object.freeze(normalizeStringArray(dependency.contractRefs)),
      primitiveRefs: Object.freeze(normalizeStringArray(dependency.primitiveRefs)),
      permissionRefs: Object.freeze(normalizeStringArray(dependency.permissionRefs)),
      accessGroupRefs: Object.freeze(normalizeStringArray(dependency.accessGroupRefs)),
      materializationRefs: Object.freeze(normalizeStringArray(dependency.materializationRefs)),
      evidenceRefs: Object.freeze(normalizeStringArray(dependency.evidenceRefs)),
      blockedReasons: Object.freeze(normalizeStringArray(dependency.blockedReasons)),
    })));
}

function indexModulesByRole(modules) {
  const index = {};
  for (const role of SURFACE_CONTRACT_ROLE_ORDER) index[role] = [];
  for (const module of modules) {
    const role = String(module.role || "");
    if (!role) continue;
    if (!index[role]) index[role] = [];
    index[role].push(module);
  }
  for (const [role, roleModules] of Object.entries(index)) {
    index[role] = Object.freeze([...roleModules]);
  }
  return Object.freeze(index);
}

function indexActivities(activities) {
  const index = new Map();
  for (const activity of activities) {
    const ref = String(activity.activityRef || "").trim();
    const id = String(activity.activityId || "").trim();
    if (ref) index.set(ref, activity);
    if (id) index.set(id, activity);
  }
  return index;
}

function indexActivityDependencies(activityDependencies) {
  const index = new Map();
  for (const dependency of activityDependencies) {
    for (const key of uniqueStrings([
      dependency.activityRef,
      dependency.activityId,
      ...(Array.isArray(dependency.activityRefs) ? dependency.activityRefs : []),
    ])) {
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(dependency);
    }
  }
  for (const [key, dependencies] of index) index.set(key, Object.freeze([...dependencies]));
  return index;
}

function dependencyBlockedReasons(dependency) {
  const dependencyRef = String(dependency?.dependencyRef || dependency?.dependencyType || "unknown").trim();
  const state = String(dependency?.state || "pending").trim();
  const required = dependency?.required !== false;
  const reasons = [];
  if (state === "blocked") {
    const dependencyReasons = normalizeStringArray(dependency.blockedReasons);
    reasons.push(...(dependencyReasons.length
      ? dependencyReasons.map((reason) => `dependency:${dependencyRef}:${reason}`)
      : [`dependencyBlocked:${dependencyRef}`]));
  } else if (required && state !== "ready") {
    reasons.push(`requiredDependencyNotReady:${dependencyRef}`);
  }
  if (required && normalizeStringArray(dependency.contractRefs).length === 0) {
    reasons.push(`missingDependencyContract:${dependencyRef}`);
  }
  if (required && normalizeStringArray(dependency.primitiveRefs).length === 0) {
    reasons.push(`missingDependencyPrimitive:${dependencyRef}`);
  }
  return reasons;
}

function freezeContract(contract, modules, requiredRoles, activities = Object.freeze([]), activityDependencies = Object.freeze([])) {
  const activityRefs = uniqueStrings([
    ...normalizeStringArray(contract.activityRefs),
    ...activities.map((activity) => activity.activityRef),
  ]);
  const activityDependencyRefs = uniqueStrings([
    ...normalizeStringArray(contract.activityDependencyRefs),
    ...activityDependencies.map((dependency) => dependency.dependencyRef),
  ]);
  return Object.freeze({
    ...contract,
    requiredPrimitives: Object.freeze(normalizeStringArray(contract.requiredPrimitives)),
    requiredModuleRoles: Object.freeze([...requiredRoles]),
    activityRefs: Object.freeze(activityRefs),
    activityDependencyRefs: Object.freeze(activityDependencyRefs),
    activities,
    activityDependencies,
    modules,
    projectionSubscriptions: Object.freeze(normalizeArray(contract.projectionSubscriptions)),
    permissionRequirements: Object.freeze(normalizeArray(contract.permissionRequirements)),
    capabilityRequirements: Object.freeze(normalizeArray(contract.capabilityRequirements)),
    materializationBudgets: normalizeBudgets(contract.materializationBudgets),
    serviceRouteRefs: Object.freeze(normalizeStringArray(contract.serviceRouteRefs)),
    hostRefs: Object.freeze(normalizeStringArray(contract.hostRefs)),
    routeRefs: Object.freeze(normalizeStringArray(contract.routeRefs)),
  });
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

function normalizeBudgets(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(value
    .filter(isObject)
    .map((budget) => Object.freeze({
      ...budget,
      limits: isObject(budget.limits) ? Object.freeze({ ...budget.limits }) : budget.limits,
      snapshotPolicy: isObject(budget.snapshotPolicy) ? Object.freeze({ ...budget.snapshotPolicy }) : budget.snapshotPolicy,
      deltaPolicy: isObject(budget.deltaPolicy) ? Object.freeze({ ...budget.deltaPolicy }) : budget.deltaPolicy,
      coalescing: isObject(budget.coalescing) ? Object.freeze({ ...budget.coalescing }) : budget.coalescing,
      cardinality: isObject(budget.cardinality) ? Object.freeze({ ...budget.cardinality }) : budget.cardinality,
      schema: isObject(budget.schema) ? Object.freeze({ ...budget.schema }) : budget.schema,
      referenceRefs: Object.freeze(normalizeStringArray(budget.referenceRefs)),
      evidenceRefs: Object.freeze(normalizeStringArray(budget.evidenceRefs)),
      blockedReasons: Object.freeze(normalizeStringArray(budget.blockedReasons)),
    })));
}

function surfaceModuleTaxonomyRolePosture(surfaceApp, role, options = {}) {
  const roleRef = String(role || "");
  const spec = SURFACE_MODULE_ROLE_TAXONOMY[roleRef] || freezeTaxonomyRole({
    taxonomyKey: roleRef || "unknown",
    role: roleRef,
    participantSides: [],
    evidenceChannels: [],
    lifecycle: { state: "custom" },
  });
  const required = surfaceApp.requiredRoles.includes(roleRef);
  const modules = surfaceApp.modulesForRole(roleRef);
  const state = modules.length ? "ready" : (required ? "blocked" : "optional");
  const blockedReasons = state === "blocked" ? [`missingModuleRole:${roleRef}`] : [];
  const lifecycle = firstObject(modules.map((module) => module.lifecycle)) || spec.lifecycle;
  const materializationBudgetRefs = uniqueStrings(modules.flatMap(moduleMaterializationBudgetRefs));
  const releaseRefs = uniqueStrings(modules.flatMap(moduleReleaseRefs));

  return deepFreeze({
    kind: "surface.module.taxonomy.role.posture",
    state,
    blockedReasons,
    blockedReason: blockedReasons[0] || "",
    taxonomyKey: spec.taxonomyKey,
    role: roleRef,
    required,
    moduleRefs: modules.map((module) => String(module.moduleRef || "")).filter(Boolean),
    participantSides: uniqueStrings([
      ...modules.map((module) => module.participantSide),
      ...(modules.length ? [] : spec.participantSides),
    ]),
    evidenceChannels: uniqueStrings([
      ...spec.evidenceChannels,
      ...modules.flatMap(moduleEvidenceChannels),
    ]),
    lifecycle,
    materializationBudgetRefs,
    releaseRefs,
    moduleCount: modules.length,
    modules,
    issuedAt: Number(options.issuedAt || surfaceApp.contract.issuedAt || Date.now()),
    expiresAt: options.expiresAt || surfaceApp.contract.expiresAt,
  });
}

function freezeTaxonomyRole(role) {
  return Object.freeze({
    taxonomyKey: String(role.taxonomyKey || role.role || ""),
    role: String(role.role || ""),
    participantSides: Object.freeze(normalizeStringArray(role.participantSides)),
    evidenceChannels: Object.freeze(normalizeStringArray(role.evidenceChannels)),
    lifecycle: isObject(role.lifecycle) ? Object.freeze({ ...role.lifecycle }) : Object.freeze({ state: "declared" }),
  });
}

function moduleEvidenceChannels(module) {
  const evidenceContract = isObject(module.evidenceContract) ? module.evidenceContract : {};
  return uniqueStrings([
    ...normalizeStringArray(module.outputs),
    ...normalizeStringArray(module.evidenceChannels),
    ...normalizeStringArray(evidenceContract.channelRefs),
    ...normalizeStringArray(evidenceContract.channels),
    ...normalizeStringArray(evidenceContract.outputs),
  ]);
}

function moduleMaterializationBudgetRefs(module) {
  return uniqueStrings([
    ...normalizeStringArray(module.materializationBudgetRefs),
    ...normalizeArray(module.materializationBudgets).map((budget) => (isObject(budget) ? budget.budgetId : budget)),
  ]);
}

function moduleReleaseRefs(module) {
  return uniqueStrings([
    ...normalizeStringArray(module.releaseRefs),
    module.releaseRef,
    module.buildRef,
    module.rollbackRef,
  ]);
}

function surfaceReleaseRefs(contract) {
  const releasePosture = isObject(contract.releasePosture) ? contract.releasePosture : {};
  const rollbackPosture = isObject(contract.rollbackPosture) ? contract.rollbackPosture : {};
  return uniqueStrings([
    ...normalizeStringArray(contract.releaseRefs),
    releasePosture.releaseRef,
    releasePosture.buildRef,
    releasePosture.rollbackRef,
    ...normalizeStringArray(releasePosture.releaseRefs),
    rollbackPosture.releaseRef,
    rollbackPosture.buildRef,
    rollbackPosture.rollbackRef,
    ...normalizeStringArray(rollbackPosture.releaseRefs),
  ]);
}

function firstObject(values) {
  return values.find(isObject) || null;
}

function surfaceModuleBlockedReason(surfaceApp, role, moduleRef, primitiveRef) {
  if (!role) return "missingRole";
  if (!surfaceApp.hasRole(role)) return "missingModuleRole";
  if (moduleRef) return "missingModuleRef";
  if (primitiveRef) return "missingPrimitiveRef";
  return "missingModule";
}

function materializationBudgetBlockedReason(budget, budgetId, { payloadClass, copyRole, transferMode }) {
  if (!budgetId) return "missingBudgetId";
  if (!budget) return "missingMaterializationBudget";
  if (payloadClass && String(budget.payloadClass || "") !== payloadClass) return "payloadClassMismatch";
  if (copyRole && String(budget.copyRole || "") !== copyRole) return "copyRoleMismatch";
  if (transferMode && String(budget.transferMode || "") !== transferMode) return "transferModeMismatch";
  return "";
}

function postureBlockedReasons(posture, prefix) {
  if (!isObject(posture)) return [];
  const state = String(posture.state || "").trim();
  const reasons = normalizeStringArray(posture.blockedReasons);
  if (state === "blocked" || state === "unavailable") {
    return reasons.length ? reasons.map((reason) => `${prefix}:${reason}`) : [`${prefix}:${state}`];
  }
  return [];
}

function postureIsDegraded(posture) {
  if (!isObject(posture)) return false;
  return ["degraded", "updateAvailable"].includes(String(posture.state || "").trim());
}

function dominantFulfillmentMode(modules) {
  const counts = new Map();
  for (const module of modules) {
    const mode = String(module.fulfillmentMode || "").trim();
    if (!mode) continue;
    counts.set(mode, (counts.get(mode) || 0) + 1);
  }
  let best = "";
  let bestCount = -1;
  for (const [mode, count] of counts.entries()) {
    if (count > bestCount) {
      best = mode;
      bestCount = count;
    }
  }
  return best;
}

function uniqueStrings(value) {
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const normalized = String(item || "").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function uniqueByRef(values, key) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (!isObject(value)) continue;
    const id = String(value[key] || "").trim() || JSON.stringify(value);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(value);
  }
  return Object.freeze(out);
}

function materializationUpstreamPosture(upstreamPosture, upstreamBudget) {
  const posture = isObject(upstreamPosture) ? upstreamPosture : null;
  const budget = isObject(upstreamBudget) ? upstreamBudget : null;
  if (!posture && !budget) {
    return Object.freeze({
      state: "absent",
      blockedReasons: Object.freeze([]),
      budgetId: "",
      consumerFloor: null,
    });
  }
  const blockedReasons = uniqueStrings([
    ...normalizeStringArray(posture?.blockedReasons).map((entry) => `upstream:${entry}`),
    ...normalizeStringArray(budget?.blockedReasons).map((entry) => `upstream:${entry}`),
  ]);
  const postureState = String(posture?.state || "").trim();
  const budgetState = String(budget?.state || "").trim();
  const lagState = String(posture?.consumerFloor?.lagState || budget?.consumerFloor?.lagState || "").trim();
  const state = postureState === "blocked" || budgetState === "blocked" || lagState === "blocked"
    ? "blocked"
    : (postureState === "pressure" || budgetState === "pressure" || ["lagging", "stale"].includes(lagState) || blockedReasons.length
      ? "pressure"
      : "ready");
  return deepFreeze({
    state,
    blockedReasons,
    budgetId: String(budget?.budgetId || posture?.budgetId || ""),
    consumerFloor: posture?.consumerFloor || budget?.consumerFloor || null,
    replayState: postureState || "unknown",
    budgetState: budgetState || "unknown",
    privacy: posture?.privacy || null,
    cardinality: posture?.cardinality || null,
    schema: posture?.schema || budget?.schema || null,
  });
}

function materializationCopyBoundaryPosture(budget, { referenceRefs, evidenceRefs, sampledAt = Date.now() } = {}) {
  const transferMode = String(budget?.transferMode || "");
  const payloadClass = String(budget?.payloadClass || "");
  const refs = referenceRefs === undefined ? normalizeStringArray(budget?.referenceRefs) : normalizeStringArray(referenceRefs);
  const evidence = evidenceRefs === undefined ? normalizeStringArray(budget?.evidenceRefs) : normalizeStringArray(evidenceRefs);
  const blockedReasons = uniqueStrings([
    ...(payloadClass === "media" && transferMode === "clone" ? ["mediaCloneTransferBlocked"] : []),
    ...(payloadClass === "retainedRaw" && !String(budget?.privacyTier || "").startsWith("encrypted") ? ["retainedRawRequiresEncryptedPrivacy"] : []),
    ...(transferMode === "referenceOnly" && !refs.length ? ["missingReferenceRef"] : []),
  ]);
  return deepFreeze({
    state: blockedReasons.length ? "blocked" : "ready",
    blockedReasons,
    payloadClass,
    copyRole: String(budget?.copyRole || ""),
    transferMode,
    privacyTier: String(budget?.privacyTier || ""),
    referenceRefs: Object.freeze(refs),
    evidenceRefs: Object.freeze(evidence),
    sampledAt,
  });
}

function isDefinedSurfaceApp(value) {
  return Boolean(value && typeof value === "object" && value.contract && value.modulesByRole && value.posture);
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizedCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

function callExtractor(extractor, event) {
  return typeof extractor === "function" ? extractor(event) : undefined;
}

function defaultEventKey(event) {
  return event?.eventId || event?.event_id || event?.id || "";
}

function defaultEventTime(event) {
  return event?.eventTime || event?.event_time || event?.occurredAt || event?.occurred_at || event?.ts || 0;
}

function defaultObservedTime(event) {
  return event?.observedAt || event?.observed_at || defaultEventTime(event);
}

function defaultSchemaVersion(event) {
  return event?.schemaVersion || event?.schema_version || "";
}

function defaultSafeFacts(event) {
  return event?.safeFacts || event?.safe_facts || {};
}

function defaultTags(event) {
  return Array.isArray(event?.tags) ? event.tags : [];
}

function defaultEncryptedDetailRefs(event) {
  const refs = [];
  for (const value of [
    event?.detailRef,
    event?.detail_ref,
    event?.encryptedDetailRef,
    event?.encrypted_detail_ref,
  ]) {
    if (value) refs.push(value);
  }
  for (const value of [
    event?.detailRefs,
    event?.detail_refs,
    event?.encryptedDetailRefs,
    event?.encrypted_detail_refs,
  ]) {
    if (Array.isArray(value)) refs.push(...value.filter(Boolean));
  }
  return refs;
}

function normalizedTimeMillis(value) {
  const raw = Number(value || 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw > 9_999_999_999 ? raw : raw * 1000;
}

function deepFreeze(value) {
  if (!isObject(value) && !Array.isArray(value)) return value;
  for (const child of Object.values(value)) {
    if ((isObject(child) || Array.isArray(child)) && !Object.isFrozen(child)) deepFreeze(child);
  }
  return Object.freeze(value);
}
