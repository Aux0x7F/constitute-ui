import {
  SURFACE_APP,
  SWARM,
  assertSurfaceAdapterLifecyclePosture,
} from "../../constitute-protocol/src/index.js";

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item !== null && item !== undefined && item !== "")
    .map((item) => String(item).trim())
    .filter(Boolean);
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
  return out;
}

function firstString(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function lifecycleIdFor(input = {}) {
  const source = [
    "adapter-life",
    input.adapterRef,
    input.subjectRef,
    input.state,
  ].filter(Boolean).join(":");
  return source || "adapter-life:unknown";
}

export function adapterReconnectJitterMs(baseMs, random = Math.random) {
  const base = Math.max(0, Number(baseMs || 0) || 0);
  if (base <= 0) return 0;
  const sample = typeof random === "function" ? Number(random()) : 0;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(sample) ? sample : 0));
  return Math.floor(clamped * Math.min(1_000, base));
}

export function adapterReconnectDelayMs(attempt, baseMs, maxMs, jitterMs = 0) {
  const attemptNumber = Math.max(1, Number(attempt || 1) || 1);
  const base = Math.max(0, Number(baseMs || 0) || 0);
  const max = Math.max(base, Number(maxMs || base) || base);
  const step = Math.min(5, Math.max(0, attemptNumber - 1));
  return Math.min(max, (base * (2 ** step)) + Math.max(0, Number(jitterMs || 0) || 0));
}

export function surfaceAdapterLifecyclePosture(input = {}) {
  const issuedAt = Number(input.issuedAt || input.observedAt || Date.now());
  const observedAt = Number(input.observedAt || issuedAt || Date.now());
  const state = firstString(input.state, SURFACE_APP.ADAPTER_LIFECYCLE_STATE.IDLE);
  const blockedReasons = uniqueStrings([
    ...normalizeStringArray(input.blockedReasons),
    state === SURFACE_APP.ADAPTER_LIFECYCLE_STATE.BLOCKED ? input.blockedReason : "",
    state === SURFACE_APP.ADAPTER_LIFECYCLE_STATE.EXPIRED ? input.blockedReason || "adapterLifecycleExpired" : "",
  ]);
  const reconnect = asObject(input.reconnect);
  const cleanup = asObject(input.cleanup);
  const releaseRefs = uniqueStrings([
    input.releaseRef,
    ...normalizeStringArray(input.releaseRefs),
  ]);
  return assertSurfaceAdapterLifecyclePosture({
    kind: SWARM.RECORD_KIND.SURFACE_ADAPTER_LIFECYCLE_POSTURE,
    lifecycleId: firstString(input.lifecycleId, lifecycleIdFor({ ...input, state })),
    adapterRef: firstString(input.adapterRef, input.moduleRef, "adapter:unknown"),
    moduleRef: firstString(input.moduleRef),
    surfaceRef: firstString(input.surfaceRef),
    subjectRef: firstString(input.subjectRef, input.sessionRef, input.intentRef, "adapter-subject:unknown"),
    role: firstString(input.role, SURFACE_APP.MODULE_ROLE.PLATFORM_ADAPTER),
    participantSide: firstString(input.participantSide, SURFACE_APP.PARTICIPANT_SIDE.WINDOW),
    state,
    intentRefs: uniqueStrings([
      input.intentRef,
      ...normalizeStringArray(input.intentRefs),
    ]),
    sessionRefs: uniqueStrings([
      input.sessionRef,
      ...normalizeStringArray(input.sessionRefs),
    ]),
    evidenceRefs: uniqueStrings([
      input.evidenceRef,
      ...normalizeStringArray(input.evidenceRefs),
    ]),
    releaseRefs,
    releaseRef: firstString(input.releaseRef),
    resourceRefs: uniqueStrings([
      input.resourceRef,
      ...normalizeStringArray(input.resourceRefs),
    ]),
    reconnect: Object.keys(reconnect).length ? reconnect : undefined,
    cleanup: Object.keys(cleanup).length ? cleanup : undefined,
    safeFacts: asObject(input.safeFacts),
    blockedReasons,
    issuedAt,
    observedAt,
    expiresAt: input.expiresAt,
  });
}

export function adapterReconnectLifecyclePosture(input = {}) {
  const observedAt = Number(input.observedAt || Date.now());
  const attempt = Math.max(1, Number(input.attempt || 1) || 1);
  const delayMs = Math.max(0, Number(input.delayMs || 0) || 0);
  return surfaceAdapterLifecyclePosture({
    ...input,
    state: SURFACE_APP.ADAPTER_LIFECYCLE_STATE.RECONNECTING,
    observedAt,
    reconnect: {
      ...asObject(input.reconnect),
      attempt,
      delayMs,
      nextRetryAt: Number(input.nextRetryAt || (observedAt + delayMs)),
      reason: firstString(input.reason, asObject(input.reconnect).reason),
    },
    cleanup: {
      openResourceCount: Number(input.openResourceCount || 0),
      releaseRequired: true,
      ...asObject(input.cleanup),
    },
  });
}

export function adapterReleaseLifecyclePosture(input = {}) {
  const observedAt = Number(input.observedAt || Date.now());
  return surfaceAdapterLifecyclePosture({
    ...input,
    state: SURFACE_APP.ADAPTER_LIFECYCLE_STATE.RELEASED,
    observedAt,
    releaseRefs: uniqueStrings([
      input.releaseRef,
      ...normalizeStringArray(input.releaseRefs),
      "release:adapter-lifecycle",
    ]),
    cleanup: {
      openResourceCount: 0,
      releaseRequired: false,
      releasedAt: observedAt,
      ...asObject(input.cleanup),
    },
  });
}
