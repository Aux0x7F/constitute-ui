export const SURFACE_CONTRACT_ROLE_ORDER = Object.freeze([
  "runtimeClient",
  "projectionModel",
  "platformAdapter",
  "serviceSurfaceAdapter",
  "productView",
  "operatorHelper",
  "releaseHelper",
]);

export function defineSurfaceAppContract(contract, { validate } = {}) {
  const validated = typeof validate === "function" ? validate(contract) : contract;
  if (!isObject(validated)) throw new Error("surface app contract is required");

  const modules = normalizeModules(validated.modules);
  const requiredRoles = normalizeStringArray(validated.requiredModuleRoles);
  const modulesByRole = indexModulesByRole(modules);
  const missingRoles = requiredRoles.filter((role) => !modulesByRole[role]?.length);
  const posture = Object.freeze({
    state: missingRoles.length ? "blocked" : "ready",
    blockedReason: missingRoles.length ? "missingModuleRole" : "",
    missingRoles: Object.freeze([...missingRoles]),
    moduleCount: modules.length,
  });

  const surfaceApp = {
    contract: freezeContract(validated, modules, requiredRoles),
    modules,
    modulesByRole,
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

export function surfaceAppAttachContext(surfaceAppOrContract, extra = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const contract = surfaceApp.contract;
  return Object.freeze({
    kind: "surface.app.attachContext",
    contractId: String(contract.contractId || ""),
    appId: String(contract.appId || ""),
    appRef: String(contract.appRef || ""),
    serviceRef: String(contract.serviceRef || ""),
    surfaceRef: String(contract.surfaceRef || ""),
    version: String(contract.version || ""),
    displayName: String(contract.displayName || ""),
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
  const bootstrapPosture = isObject(options.bootstrapPosture)
    ? options.bootstrapPosture
    : (isObject(contract.bootstrapPosture) ? contract.bootstrapPosture : {});
  const serviceManagerPosture = isObject(options.serviceManagerPosture)
    ? options.serviceManagerPosture
    : (isObject(contract.serviceManagerPosture) ? contract.serviceManagerPosture : {});
  const secretBoundary = isObject(options.secretBoundary)
    ? options.secretBoundary
    : (isObject(contract.secretBoundary) ? contract.secretBoundary : {});
  const releasePosture = isObject(options.releasePosture)
    ? options.releasePosture
    : (isObject(contract.releasePosture) ? contract.releasePosture : {});
  const rollbackPosture = isObject(options.rollbackPosture)
    ? options.rollbackPosture
    : (isObject(contract.rollbackPosture) ? contract.rollbackPosture : {});
  const blockedReasons = uniqueStrings([
    ...surfaceApp.missingRoles.map((role) => `missingModuleRole:${role}`),
    ...postureBlockedReasons(bootstrapPosture, "bootstrap"),
    ...postureBlockedReasons(serviceManagerPosture, "serviceManager"),
    ...postureBlockedReasons(secretBoundary, "secretBoundary"),
    ...postureBlockedReasons(releasePosture, "release"),
    ...postureBlockedReasons(rollbackPosture, "rollback"),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const degraded = postureIsDegraded(bootstrapPosture)
    || postureIsDegraded(serviceManagerPosture)
    || postureIsDegraded(releasePosture)
    || postureIsDegraded(rollbackPosture);
  const moduleRefs = uniqueStrings([
    ...surfaceApp.modules.map((module) => module.moduleRef),
    ...normalizeStringArray(bootstrapPosture.moduleRefs),
    ...normalizeStringArray(options.moduleRefs),
  ]);
  const issuedAt = Number(options.issuedAt || bootstrapPosture.issuedAt || contract.issuedAt || Date.now());
  const sourceMode = String(options.sourceMode || bootstrapPosture.sourceMode || dominantFulfillmentMode(surfaceApp.modules) || "bundled");
  return deepFreeze({
    kind: "surface.app.bootstrap.posture",
    bootstrapId: String(options.bootstrapId || bootstrapPosture.bootstrapId || `bootstrap:${contract.contractId || contract.appId || "surface-app"}`),
    contractId: String(contract.contractId || ""),
    appId: String(contract.appId || ""),
    state: blockedReasons.length ? "blocked" : (degraded ? "degraded" : "ready"),
    sourceMode,
    moduleRefs,
    serviceManagerRef: String(options.serviceManagerRef || bootstrapPosture.serviceManagerRef || serviceManagerPosture.managerId || ""),
    serviceManagerPosture: deepFreeze({ ...serviceManagerPosture }),
    secretBoundary: deepFreeze(Object.keys(secretBoundary).length ? { ...secretBoundary } : { state: "notRequired" }),
    releasePosture: deepFreeze(Object.keys(releasePosture).length ? { ...releasePosture } : { state: "static" }),
    rollbackPosture: deepFreeze(Object.keys(rollbackPosture).length ? { ...rollbackPosture } : undefined),
    blockedReasons,
    evidenceRefs: uniqueStrings([
      ...normalizeStringArray(bootstrapPosture.evidenceRefs),
      ...normalizeStringArray(serviceManagerPosture.evidenceRefs),
      ...normalizeStringArray(releasePosture.evidenceRefs),
      ...normalizeStringArray(options.evidenceRefs),
    ]),
    issuedAt,
    expiresAt: options.expiresAt || bootstrapPosture.expiresAt || contract.expiresAt,
  });
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
    releaseRef: String(options.releaseRef || releasePosture.releaseRef || ""),
    rollbackRef: String(options.rollbackRef || releasePosture.rollbackRef || ""),
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
    blockedReasons,
    safeFacts: isObject(options.safeFacts) ? deepFreeze({ ...options.safeFacts }) : undefined,
    requestedAt,
    acceptedAt: options.acceptedAt,
    startedAt: options.startedAt,
    completedAt: options.completedAt,
    observedAt: options.observedAt,
    expiresAt: options.expiresAt || serviceManagerPosture.expiresAt || contract.expiresAt,
  };
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
  const blockedReasons = uniqueStrings([
    ...(!appContractRef ? ["missingAppContractRef"] : []),
    ...(!version ? ["missingAppVersion"] : []),
    ...(!claim ? ["missingManifestVersion"] : []),
    ...(!surfaceApp ? ["missingBundledContract"] : []),
    ...(surfaceApp && version && String(surfaceApp.contract.version || "") !== version ? ["contractVersionMismatch"] : []),
    ...(manifestState === "blocked" ? postureBlockedReasons(manifest, "manifest") : []),
    ...(claimState === "blocked" ? postureBlockedReasons(claim, "manifestVersion") : []),
    ...(claimState === "superseded" ? ["manifestVersionSuperseded"] : []),
    ...(nonBundledSourceMode(sourceMode) && !releaseContractRef ? ["missingReleaseContractRef"] : []),
    ...(nonBundledSourceMode(sourceMode) && remoteSourceRefs.length === 0 ? ["missingRemoteSourceRef"] : []),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  return deepFreeze({
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
    grantRefs,
    runnerRequirementRefs,
    serviceManagerRequirementRefs,
    compatibilityWindow: options.compatibilityWindow || claim?.compatibilityWindow || manifest.compatibilityWindow || null,
    compatibilityRefs: uniqueStrings([
      ...normalizeStringArray(manifest.compatibilityRefs),
      ...normalizeStringArray(claim?.compatibilityRefs),
    ]),
    bootstrapContractRef: String(options.bootstrapContractRef || claim?.bootstrapContractRef || ""),
    releaseContractRef,
    evidenceRefs: uniqueStrings([
      ...normalizeStringArray(manifest.evidenceRefs),
      ...normalizeStringArray(claim?.evidenceRefs),
      ...normalizeStringArray(options.evidenceRefs),
    ]),
    blockedReasons,
    claim: claim ? deepFreeze({ ...claim }) : null,
    surfaceApp,
    contract: surfaceApp?.contract || null,
    issuedAt: Number(options.issuedAt || manifest.issuedAt || Date.now()),
    expiresAt: options.expiresAt || manifest.expiresAt,
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
  const sourceTrustResult = surfaceAppSourceTrustResult(selection, options);
  const runnerReadiness = deepFreeze({
    kind: "surface.app.runtime.runner.readiness",
    state: manifestRunnerPlan.state,
    runnerRequirementRefs: Object.freeze([...selection.runnerRequirementRefs]),
    planId: manifestRunnerPlan.planId,
    runnerPlanId: String(manifestRunnerPlan.runnerPlan?.planId || ""),
    blockedReasons: Object.freeze([...manifestRunnerPlan.blockedReasons]),
  });
  const serviceManagerReadiness = surfaceAppServiceManagerReadiness(selection, options);
  const blockedReasons = uniqueStrings([
    ...selection.blockedReasons.map((reason) => `manifest:${reason}`),
    ...compatibilityResult.blockedReasons.map((reason) => `compatibility:${reason}`),
    ...sourceTrustResult.blockedReasons.map((reason) => `source:${reason}`),
    ...modulePostures
      .filter((posture) => posture.state === "blocked")
      .map((posture) => `module:${posture.role}:${posture.blockedReason}`),
    ...prefixedBlockedReasons(runnerReadiness, "runner"),
    ...prefixedBlockedReasons(serviceManagerReadiness, "serviceManager"),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const degraded = [
    compatibilityResult,
    sourceTrustResult,
    serviceManagerReadiness,
  ].some((posture) => String(posture.state || "") === "degraded" || String(posture.state || "") === "unchecked");
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
    sourceTrustResult,
    modulePostures,
    runnerReadiness,
    serviceManagerReadiness,
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
  const serviceManagerOperationPosture = isObject(options.serviceManagerOperationPosture)
    ? options.serviceManagerOperationPosture
    : null;
  const serviceManagerProofDigest = isObject(options.serviceManagerProofDigest)
    ? options.serviceManagerProofDigest
    : null;
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
    ...instancePostureBlockedReasons(bootstrapContract, "bootstrapContract"),
    ...instancePostureBlockedReasons(bootstrapPosture, "bootstrap"),
    ...instancePostureBlockedReasons(serviceManagerOperationPosture, "serviceManagerOperation"),
    ...instancePostureBlockedReasons(serviceManagerProofDigest, "serviceManagerProof"),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const degraded = [
    runtimeSelectionPosture,
    moduleBindingPosture,
    runnerPlan,
    bootstrapContract,
    bootstrapPosture,
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
      : surfaceAppRunnerReadinessFromPlan(runnerPlan),
    serviceManagerReadiness: isObject(runtimeSelectionPosture?.serviceManagerReadiness)
      ? deepFreeze({ ...runtimeSelectionPosture.serviceManagerReadiness })
      : surfaceAppServiceManagerReadinessFromOperation(serviceManagerOperationPosture),
    runnerPlanRef: String(runnerPlan?.planId || ""),
    bootstrapContractRef: String(bootstrapContract?.bootstrapContractId || bootstrapContract?.contractId || ""),
    bootstrapPosture,
    serviceManagerOperationRef: String(serviceManagerOperationPosture?.operationId || ""),
    serviceManagerProofRef: String(serviceManagerProofDigest?.digestId || ""),
    blockedReasons,
    issuedAt,
    expiresAt: options.expiresAt || runtimeSelectionPosture?.expiresAt || runnerPlan?.expiresAt || contract.expiresAt,
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
    modules: Object.freeze([...modules]),
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

function serviceManagerOperationToRunnerOperation(operation) {
  switch (String(operation || "")) {
    case "healthCheck":
      return "healthCheck";
    case "rollback":
      return "rollback";
    case "stop":
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
  const sourceMode = String(selection.sourceMode || "").trim();
  const bundled = !nonBundledSourceMode(sourceMode);
  const sourceRefs = bundled ? selection.bundledSourceRefs : selection.remoteSourceRefs;
  const blockedReasons = uniqueStrings([
    ...(bundled && sourceRefs.length === 0 && !selection.surfaceApp ? ["missingBundledSourceRef"] : []),
    ...(!bundled && sourceRefs.length === 0 ? ["missingRemoteSourceRef"] : []),
    ...(!bundled && !selection.releaseContractRef ? ["missingReleaseContractRef"] : []),
    ...(options.sourceTrusted === false ? ["sourceUntrusted"] : []),
    ...normalizeStringArray(options.sourceBlockedReasons),
  ]);
  return deepFreeze({
    kind: "surface.app.runtime.source.trust.result",
    state: blockedReasons.length ? "blocked" : "ready",
    sourceMode,
    sourceRefs: Object.freeze([...sourceRefs]),
    releaseContractRef: selection.releaseContractRef,
    bundled,
    blockedReasons,
  });
}

function surfaceAppServiceManagerReadiness(selection, options = {}) {
  const posture = isObject(options.serviceManagerPosture)
    ? options.serviceManagerPosture
    : (isObject(selection.contract?.serviceManagerPosture) ? selection.contract.serviceManagerPosture : {});
  const postureState = String(posture.state || "").trim();
  const postureReasons = normalizeStringArray(posture.blockedReasons);
  const blockedReasons = uniqueStrings([
    ...((postureState === "blocked" || postureState === "unavailable")
      ? (postureReasons.length ? postureReasons : [postureState])
      : []),
    ...normalizeStringArray(options.serviceManagerBlockedReasons),
  ]);
  return deepFreeze({
    kind: "surface.app.runtime.service-manager.readiness",
    state: blockedReasons.length ? "blocked" : (postureIsDegraded(posture) ? "degraded" : (postureState || "unknown")),
    serviceManagerRequirementRefs: Object.freeze([...selection.serviceManagerRequirementRefs]),
    managerId: String(posture.managerId || posture.serviceManagerRef || ""),
    evidenceRefs: Object.freeze(normalizeStringArray(posture.evidenceRefs)),
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
  return ["swarmPackage", "storageObject", "nativeInstalled"].includes(String(sourceMode || ""));
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

function freezeContract(contract, modules, requiredRoles) {
  return Object.freeze({
    ...contract,
    requiredPrimitives: Object.freeze(normalizeStringArray(contract.requiredPrimitives)),
    requiredModuleRoles: Object.freeze([...requiredRoles]),
    modules,
    projectionSubscriptions: Object.freeze(normalizeArray(contract.projectionSubscriptions)),
    permissionRequirements: Object.freeze(normalizeArray(contract.permissionRequirements)),
    capabilityRequirements: Object.freeze(normalizeArray(contract.capabilityRequirements)),
    materializationBudgets: normalizeBudgets(contract.materializationBudgets),
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
