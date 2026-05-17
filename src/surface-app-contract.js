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
