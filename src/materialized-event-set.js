import {
  materializationBudgetLimit,
  materializationBudgetRecord,
  materializationConsumerFloorRecord,
  materializationEnforcementPosture,
  materializationEventReplayPosture,
} from "./surface-app-contract.js";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function estimatedJsonBytes(value) {
  const text = stableStringify(value);
  if (typeof TextEncoder !== "undefined") {
    try {
      return new TextEncoder().encode(text).byteLength;
    } catch {}
  }
  return text.length;
}

function uniqueJson(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const key = stableStringify(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function callExtractor(extractor, value, fallback = undefined) {
  if (typeof extractor !== "function") return fallback;
  try {
    return extractor(value);
  } catch {
    return fallback;
  }
}

function timestampMillis(value) {
  const raw = Number(value || 0);
  if (!raw) return 0;
  return raw > 9_999_999_999 ? raw : raw * 1000;
}

function defaultTimeMillis(event) {
  return timestampMillis(event?.observedAt || event?.observed_at || event?.occurredAt || event?.occurred_at || event?.ts || 0);
}

export function defaultEventMaterializationKey(event) {
  const direct = String(event?.eventId || event?.event_id || event?.logEventId || event?.id || "").trim();
  if (direct) return `id:${direct}`;
  const cursor = String(event?.cursor?.value || event?.cursor || "").trim();
  if (cursor) return `cursor:${cursor}`;
  return `shape:${stableStringify({
    occurredAt: event?.occurredAt || event?.occurred_at || event?.ts || "",
    severity: event?.severity || "",
    category: event?.category || "",
    outcome: event?.outcome || "",
    producer: event?.producer || "",
    subject: event?.subject || null,
    resource: event?.resource || null,
    correlation: event?.correlation || null,
    tags: event?.tags || [],
    safeFacts: event?.safeFacts || event?.safe_facts || {},
  })}`;
}

export function defaultMergeMaterializedEvent(existing, next, { encryptedDetailRefs = undefined } = {}) {
  const existingFacts = existing?.safeFacts || existing?.safe_facts || {};
  const nextFacts = next?.safeFacts || next?.safe_facts || {};
  const refs = typeof encryptedDetailRefs === "function"
    ? [
      ...normalizeArray(callExtractor(encryptedDetailRefs, existing, [])),
      ...normalizeArray(callExtractor(encryptedDetailRefs, next, [])),
    ]
    : [
      ...normalizeArray(existing?.encryptedDetailRefs || existing?.encrypted_detail_refs),
      ...normalizeArray(next?.encryptedDetailRefs || next?.encrypted_detail_refs),
    ];
  return {
    ...existing,
    ...next,
    safeFacts: {
      ...(isObject(existingFacts) ? existingFacts : {}),
      ...(isObject(nextFacts) ? nextFacts : {}),
    },
    encryptedDetailRefs: uniqueJson(refs),
  };
}

export function materializeEventSet({
  existingEvents = [],
  incomingEvents = [],
  sourceEvents = undefined,
  replace = false,
  budget = null,
  validateEvent = undefined,
  eventKey = defaultEventMaterializationKey,
  mergeEvent = defaultMergeMaterializedEvent,
  compareEvents = undefined,
  eventTime = defaultTimeMillis,
  observedTime = defaultTimeMillis,
  schemaVersion = undefined,
  expectedSchemaVersion = undefined,
  safeFacts = undefined,
  tags = undefined,
  encryptedDetailRefs = undefined,
  consumerFloor = undefined,
  upstreamPosture = undefined,
  upstreamBudget = undefined,
  referenceRefs = undefined,
  evidenceRefs = undefined,
  sourceLimitKey = "maxSourceItems",
  materializedLimitKey = "maxItems",
  blockedReason = "materializationBudgetPressure",
  floorId = "",
  consumerRef = "",
  subjectRef = "",
  replayMode = "event-replay",
  redeliveryMode = "cursor",
  duplicatePolicy = "eventKey",
  snapshotPolicy = undefined,
  deltaPolicy = undefined,
  coalescing = undefined,
  cardinality = undefined,
  schema = undefined,
  limits = undefined,
  retentionClass = "ephemeral.ui-projection",
  sampledAt = Date.now(),
} = {}) {
  const current = normalizeArray(existingEvents);
  const incoming = normalizeArray(incomingEvents);
  const source = normalizeArray(sourceEvents === undefined ? (replace ? incoming : [...current, ...incoming]) : sourceEvents);
  const previousByKey = new Map();
  for (const event of current) {
    const key = String(callExtractor(eventKey, event, "") || "").trim();
    if (key) previousByKey.set(key, event);
  }
  const byKey = replace ? new Map() : new Map(previousByKey);
  let received = 0;
  let added = 0;
  let updated = 0;
  for (const event of incoming) {
    if (typeof validateEvent === "function" && !validateEvent(event)) continue;
    received += 1;
    const key = String(callExtractor(eventKey, event, "") || "").trim();
    if (!key) continue;
    const existing = byKey.get(key) || previousByKey.get(key);
    if (existing) {
      const merged = mergeEvent(existing, event, { encryptedDetailRefs });
      if (stableStringify(merged) !== stableStringify(existing)) updated += 1;
      byKey.set(key, merged);
      continue;
    }
    byKey.set(key, event);
    added += 1;
  }
  const removed = replace ? Math.max(0, previousByKey.size - byKey.size) : 0;
  let events = Array.from(byKey.values());
  const compare = typeof compareEvents === "function"
    ? compareEvents
    : ((left, right) => Number(callExtractor(eventTime, right, 0) || 0) - Number(callExtractor(eventTime, left, 0) || 0));
  events.sort(compare);
  const maxItems = materializationBudgetLimit(budget, materializedLimitKey, 0);
  const beforeCap = events.length;
  if (maxItems > 0 && events.length > maxItems) events = events.slice(0, maxItems);
  const droppedByItem = Math.max(0, beforeCap - events.length);
  const maxMaterializedBytes = materializationBudgetLimit(budget, "maxMaterializedBytes", Number.POSITIVE_INFINITY);
  let materializedBytes = estimatedJsonBytes(events);
  let droppedByByte = 0;
  if (Number.isFinite(maxMaterializedBytes) && maxMaterializedBytes > 0) {
    while (events.length > 0 && materializedBytes > maxMaterializedBytes) {
      events.pop();
      droppedByByte += 1;
      materializedBytes = estimatedJsonBytes(events);
    }
  }
  const dropped = droppedByItem + droppedByByte;
  const pressureReason = droppedByByte ? "materializationBytePressure" : blockedReason;
  const replayPosture = materializationEventReplayPosture(budget, {
    sourceEvents: source,
    materializedEvents: events,
    eventKey,
    eventTime,
    observedTime,
    schemaVersion,
    expectedSchemaVersion,
    safeFacts,
    tags,
    encryptedDetailRefs,
    sampledAt,
    consumerFloor: {
      floorId,
      consumerRef,
      materializationId: String(budget?.budgetId || ""),
      subjectRef,
      ...(isObject(consumerFloor) ? consumerFloor : {}),
    },
  });
  const lagState = String(replayPosture.consumerFloor?.lagState || "unknown").trim() || "unknown";
  const postureReason = String(replayPosture.consumerFloor?.reason || replayPosture.blockedReasons?.[0] || "").trim();
  const lagRequiresReason = ["lagging", "stale", "blocked"].includes(lagState);
  const floor = materializationConsumerFloorRecord(budget, {
    floorId,
    consumerRef,
    materializationId: String(budget?.budgetId || ""),
    subjectRef,
    sourceCount: source.length,
    materializedCount: events.length,
    cursor: events.length ? String(callExtractor(eventKey, events[events.length - 1], "") || "") : "",
    eventTimeFloor: replayPosture.bitemporal?.eventTimeFloor,
    observedTimeFloor: replayPosture.bitemporal?.observedTimeFloor || sampledAt,
    reason: dropped ? pressureReason : (postureReason || (lagRequiresReason ? "consumer floor lag" : "")),
    replay: replayPosture.consumerFloor?.replay || { mode: replayMode, sourceCount: source.length, materializedCount: events.length },
    redelivery: replayPosture.consumerFloor?.redelivery || { mode: redeliveryMode, duplicatePolicy },
    sampledAt,
    ...(isObject(consumerFloor) ? consumerFloor : {}),
  });
  const normalizedFloor = {
    ...floor,
    lagState,
    ...(postureReason || lagRequiresReason ? { reason: postureReason || "consumer floor lag" } : {}),
  };
  const enforcementPosture = materializationEnforcementPosture(budget, {
    sourceCount: source.length,
    materializedCount: events.length,
    sourceLimitKey,
    materializedLimitKey,
    blockedReason: pressureReason,
    consumerFloor: normalizedFloor,
    replayPosture,
    upstreamPosture,
    upstreamBudget,
    referenceRefs,
    evidenceRefs,
    sampledAt,
  });
  const baseMaterializationBudget = materializationBudgetRecord(budget, {
    sourceCount: source.length,
    materializedCount: events.length,
    sourceLimitKey,
    materializedLimitKey,
    blockedReason: pressureReason,
    limits: {
      ...(isObject(limits) ? limits : {}),
      sourceCount: source.length,
      materializedCount: events.length,
      droppedCount: dropped,
      droppedByItemCount: droppedByItem,
      droppedByByteCount: droppedByByte,
      materializedBytes,
      maxMaterializedBytes,
    },
    snapshotPolicy,
    deltaPolicy,
    coalescing,
    cardinality: {
      ...(isObject(cardinality) ? cardinality : {}),
      safeFactKeyCount: replayPosture.cardinality?.safeFactKeyCount || 0,
      labelValueCount: replayPosture.cardinality?.labelValueCount || 0,
    },
    schema: {
      ...(isObject(schema) ? schema : {}),
      state: replayPosture.schema?.state || schema?.state,
      eventSchemaVersions: replayPosture.schema?.versions || {},
    },
    consumerFloor: normalizedFloor,
    replayPosture,
    enforcementPosture,
    releasePosture: enforcementPosture.releasePosture,
    referenceRefs,
    evidenceRefs,
    retentionClass,
    sampledAt,
  });
  const materializationBudget = dropped
    ? {
        ...baseMaterializationBudget,
        state: "pressure",
        blockedReasons: Object.freeze(uniqueJson([
          ...normalizeArray(baseMaterializationBudget.blockedReasons),
          pressureReason,
        ]).map(String)),
      }
    : baseMaterializationBudget;
  return Object.freeze({
    events: Object.freeze(events),
    merge: Object.freeze({
      received,
      added,
      updated,
      removed,
      dropped,
      droppedByItem,
      droppedByByte,
      materialized: events.length,
      source: source.length,
      materializedBytes,
    }),
    replayPosture,
    consumerFloor: normalizedFloor,
    enforcementPosture,
    materializationBudget,
  });
}
