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
