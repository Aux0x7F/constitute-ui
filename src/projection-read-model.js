function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizedProjectionEntries(projections) {
  if (Array.isArray(projections)) return projections.filter((entry) => entry && typeof entry === "object");
  if (projections && typeof projections === "object") {
    return Object.values(projections).filter((entry) => entry && typeof entry === "object");
  }
  return [];
}

export function projectionRuntimeKey(projection, fallback = "") {
  return String(
    projection?.nodePath
      || projection?.payload?.nodePath
      || projection?.channelId
      || projection?.projectionId
      || fallback
      || "",
  ).trim();
}

export function projectionNodePath(projection, { channelMap = {} } = {}) {
  const direct = String(projection?.nodePath || projection?.payload?.nodePath || "").trim().toLowerCase();
  if (direct) return direct;
  const channelId = String(projection?.channelId || "").trim();
  for (const [nodePath, channelAdapter] of Object.entries(channelMap || {})) {
    if (channelId && channelId === String(channelAdapter || "").trim()) return String(nodePath || "").trim().toLowerCase();
  }
  return "";
}

export function projectionRecordPolicyId(projection) {
  return String(
    projection?.payload?.policy?.policyId
      || projection?.scope?.policyId
      || projection?.policy?.policyId
      || "",
  ).trim();
}

export function projectionUpdatedAt(projection) {
  const value = Number(projection?.freshness?.updatedAt || projection?.retainedAt || projection?.cursor?.updatedAt || 0);
  return Number.isFinite(value) ? value : 0;
}

export function projectionDeltaFor(projection) {
  const delta = projection?.projectionDelta || projection?.delta || projection?.payload?.projectionDelta || projection?.payload?.delta;
  return delta && typeof delta === "object" ? delta : null;
}

export function selectProjectionForNode(projections, nodePath, {
  policyId = "",
  backingChannel = "",
  channelMap = {},
} = {}) {
  const target = String(nodePath || "").trim().toLowerCase();
  const channelAdapter = String(channelMap?.[target] || "").trim();
  const expectedPolicyId = String(policyId || "").trim();
  let examined = 0;
  let matched = 0;
  let exact = null;
  let latest = null;
  for (const projection of normalizedProjectionEntries(projections)) {
    examined += 1;
    const channelId = String(projection?.channelId || "").trim();
    const matches = projectionNodePath(projection, { channelMap }) === target
      || (backingChannel && channelId === backingChannel)
      || (!backingChannel && channelAdapter && channelId === channelAdapter);
    if (!matches) continue;
    matched += 1;
    if (expectedPolicyId && projectionRecordPolicyId(projection) === expectedPolicyId) {
      exact = projection;
      break;
    }
    if (!latest || projectionUpdatedAt(projection) > projectionUpdatedAt(latest)) latest = projection;
  }
  return {
    projection: exact || latest || null,
    exact,
    latest,
    examined,
    matched,
    policyId: expectedPolicyId,
    nodePath: target,
    backingChannel: String(backingChannel || ""),
    channelAdapter,
  };
}

export function projectionForNode(projections, nodePath, options = {}) {
  return selectProjectionForNode(projections, nodePath, options).projection;
}

export function projectionCoverage(projection, {
  materializedFallback = 0,
  targetFallback = materializedFallback,
  syncStateFallback = "stale",
} = {}) {
  if (!projection) {
    return {
      materializedCount: 0,
      targetCount: 0,
      completionRatio: 0,
      completeSeverityBands: [],
      oldestObservedAt: 0,
      newestObservedAt: 0,
      syncState: "stale",
    };
  }
  const coverage = normalizeObject(projection?.payload?.coverage || projection?.coverage);
  const materializedCount = Number(coverage.materializedCount ?? materializedFallback);
  const targetCount = Number(coverage.targetCount ?? targetFallback);
  const ratio = Number(coverage.completionRatio ?? (targetCount ? materializedCount / targetCount : 1));
  return {
    materializedCount: Number.isFinite(materializedCount) ? materializedCount : 0,
    targetCount: Number.isFinite(targetCount) ? targetCount : 0,
    completionRatio: Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0,
    completeSeverityBands: Array.isArray(coverage.completeSeverityBands) ? coverage.completeSeverityBands : [],
    oldestObservedAt: Number(coverage.oldestObservedAt || 0),
    newestObservedAt: Number(coverage.newestObservedAt || 0),
    syncState: String(coverage.syncState || syncStateFallback || "stale"),
  };
}

function normalizedStrings(value) {
  return Array.isArray(value)
    ? value.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
}

export function projectionMaterializationPosture(projection, options = {}) {
  const budget = normalizeObject(options.materializationBudget || projection?.payload?.materializationBudget || projection?.materializationBudget);
  const consumerFloor = normalizeObject(options.consumerFloor || budget.consumerFloor || projection?.payload?.consumerFloor || projection?.consumerFloor);
  const coverage = projectionCoverage(projection, options);
  const blockedReasons = normalizedStrings(budget.blockedReasons || budget.limits?.blockedReasons);
  const state = String(
    options.state
      || budget.state
      || (blockedReasons.length ? "pressure" : projection ? "withinBudget" : "missing"),
  ).trim();
  return Object.freeze({
    kind: "projection.materialization.posture",
    state: state || "unknown",
    budgetId: String(budget.budgetId || options.budgetId || "").trim(),
    consumerFloorId: String(consumerFloor.floorId || "").trim(),
    lagState: String(consumerFloor.lagState || "").trim(),
    materializedCount: coverage.materializedCount,
    targetCount: coverage.targetCount,
    completionRatio: coverage.completionRatio,
    copyRole: String(budget.copyRole || options.copyRole || "").trim(),
    payloadClass: String(budget.payloadClass || options.payloadClass || "").trim(),
    transferMode: String(budget.transferMode || options.transferMode || "").trim(),
    privacyTier: String(budget.privacyTier || options.privacyTier || "").trim(),
    blockedReasons: Object.freeze(blockedReasons),
  });
}

export function projectionRepairFor(projection, {
  nodePath = "",
  channelMap = {},
  service = "",
  repairRequests = [],
  localRepairRequests,
} = {}) {
  const direct = projection?.repairRequest || projection?.repair || projection?.payload?.repairRequest || projection?.payload?.repair;
  if (direct && typeof direct === "object") return direct;
  const target = String(nodePath || "").trim().toLowerCase();
  const ids = [
    projection?.projectionId,
    projection?.channelId,
    projectionDeltaFor(projection)?.projectionId,
    channelMap?.[target],
    service && target ? `${service}.${target}` : "",
  ].map((value) => String(value || "").trim()).filter(Boolean);
  for (const id of ids) {
    if (localRepairRequests?.has?.(id)) return localRepairRequests.get(id).repairRequest || localRepairRequests.get(id);
    const edgeMatch = repairRequests.find((entry) => {
      const request = entry?.repairRequest || entry;
      const projectionId = String(request?.projectionId || request?.projection_id || "").trim();
      return projectionId === id;
    });
    if (edgeMatch) return edgeMatch.repairRequest || edgeMatch;
  }
  return null;
}

export function projectionPostureSummary(snapshotOrProjections = {}) {
  const snapshot = normalizeObject(snapshotOrProjections);
  const projections = snapshot.projections ? normalizeObject(snapshot.projections) : normalizeObject(snapshotOrProjections);
  const coverage = normalizeObject(snapshot.projectionCoverage);
  const coverageCounts = {};
  for (const item of Object.values(coverage)) {
    const syncState = String(item?.syncState || "unknown").trim() || "unknown";
    coverageCounts[syncState] = (coverageCounts[syncState] || 0) + 1;
  }
  const stateLabel = Object.keys(coverageCounts).length === 0
    ? "none"
    : Object.entries(coverageCounts).map(([state, count]) => `${state} ${count}`).join(", ");
  return {
    projectionCount: Object.keys(projections).length,
    coverageCount: Object.keys(coverage).length,
    coverageCounts,
    stateLabel,
  };
}
