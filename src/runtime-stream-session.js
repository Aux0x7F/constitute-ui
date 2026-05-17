const STREAM_KEY_FIELDS = Object.freeze([
  "sessionId",
  "session_id",
  "nonce",
  "intentId",
  "intent_id",
  "frameId",
  "frame_id",
  "ackedFrameId",
  "acked_frame_id",
  "correlationId",
  "correlation_id",
  "activationId",
  "activation_id",
  "interactionId",
  "interaction_id",
  "routePromiseId",
  "route_promise_id",
  "requestId",
  "request_id",
]);

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

const ROUTE_DELIVERED_STATES = new Set([
  "delivered",
  "memberWritten",
  "memberRead",
  "accepted",
]);
const ROUTE_RELEASED_STATES = new Set(["released", "closed", "expired"]);
const ROUTE_REJECTED_STATES = new Set(["observingUnreachable", "unreachableFor", "rejected"]);

function addRuntimeStreamKey(keys, value) {
  if (Array.isArray(value)) {
    for (const item of value) addRuntimeStreamKey(keys, item);
    return;
  }
  const key = String(value || "").trim();
  if (key) keys.add(key);
}

function addRecordKeys(keys, source) {
  const record = asObject(source);
  for (const field of STREAM_KEY_FIELDS) addRuntimeStreamKey(keys, record[field]);
  addRuntimeStreamKey(keys, runtimeRecordRefId(record.recordRef));
}

export function runtimeRecordRefId(value) {
  return String(asObject(value).id || "").trim();
}

export function collectRuntimeIntentResultKeys(result) {
  const keys = new Set();
  const source = asObject(result);
  const nested = asObject(source.result);
  const sources = [
    source,
    nested,
    asObject(source.frame),
    asObject(nested.frame),
  ];
  for (const item of sources) addRecordKeys(keys, item);
  return keys;
}

export function collectRuntimeStreamFrameKeys(frame = {}, record = {}) {
  const keys = new Set();
  const frameObject = asObject(frame);
  const recordObject = asObject(record);
  const body = asObject(frameObject.body);
  const payload = asObject(body.payload);
  const recordPayload = asObject(recordObject.payload);
  for (const item of [frameObject, payload, recordObject, recordPayload]) addRecordKeys(keys, item);
  addRuntimeStreamKey(keys, runtimeRecordRefId(frameObject.recordRef));
  return keys;
}

export function collectRuntimeObservationKeys(observation = {}) {
  const keys = new Set();
  addRecordKeys(keys, observation);
  return keys;
}

export function collectRuntimeActivationKeys(activation = {}) {
  const keys = new Set();
  addRecordKeys(keys, activation);
  return keys;
}

export function collectRuntimeMediaFulfillmentKeys(posture = {}) {
  const keys = new Set();
  const record = asObject(posture);
  addRecordKeys(keys, record);
  addRecordKeys(keys, asObject(record.latestEvidence));
  const evidenceByKind = asObject(record.evidenceByKind);
  for (const evidence of Object.values(evidenceByKind)) {
    addRecordKeys(keys, asObject(evidence));
  }
  return keys;
}

export function runtimeIntentSource(result) {
  const source = asObject(result);
  return asObject(source.result && typeof source.result === "object" ? source.result : source);
}

export function runtimeIntentFrameId(result) {
  const source = asObject(result);
  const nested = asObject(source.result);
  return String(source.frameId || nested.frameId || asObject(source.frame).frameId || asObject(nested.frame).frameId || "").trim();
}

export function runtimeIntentWaitingAuthority(result) {
  const source = runtimeIntentSource(result);
  const state = String(source.state || source.authorityLifecycleState || "").trim();
  return source.pendingAuthority === true || state === "waitingAuthority";
}

export function runtimeIntentState(result) {
  return String(runtimeIntentSource(result).state || "").trim();
}

export function runtimeRouteObservationPosture(observation = {}) {
  const record = asObject(observation);
  const state = String(record.state || record.status || "").trim();
  const failed = Array.isArray(record.failedPredicates)
    ? record.failedPredicates.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
  const detail = String(record.message || failed.join(", ") || state || "route observation").trim();
  if (ROUTE_DELIVERED_STATES.has(state)) {
    return {
      state,
      routeState: state === "accepted" ? "routeAccepted" : state,
      detail,
      routeDelivered: true,
      routeDegraded: false,
      routeReleased: false,
      routeRejected: false,
    };
  }
  if (state === "degraded") {
    return {
      state,
      routeState: "degraded",
      detail,
      routeDelivered: false,
      routeDegraded: true,
      routeReleased: false,
      routeRejected: false,
    };
  }
  if (ROUTE_RELEASED_STATES.has(state)) {
    return {
      state,
      routeState: state,
      detail,
      routeDelivered: false,
      routeDegraded: false,
      routeReleased: true,
      routeRejected: false,
    };
  }
  if (ROUTE_REJECTED_STATES.has(state)) {
    return {
      state,
      routeState: state,
      detail,
      routeDelivered: false,
      routeDegraded: false,
      routeReleased: false,
      routeRejected: true,
    };
  }
  return {
    state,
    routeState: state,
    detail,
    routeDelivered: false,
    routeDegraded: false,
    routeReleased: false,
    routeRejected: false,
  };
}

export function applyRuntimeRouteObservationToStreamSession(session, observation = {}) {
  const posture = runtimeRouteObservationPosture(observation);
  if (!session || typeof session !== "object") return posture;
  if (posture.routeDelivered || posture.routeDegraded || posture.routeReleased || posture.routeRejected) {
    session.routePending = false;
    session.routeState = posture.routeState;
  }
  return posture;
}

export function runtimeIntentPendingRoute(result) {
  const source = runtimeIntentSource(result);
  const state = runtimeIntentState(result);
  return source.pendingRoute === true
    || state === "waitingRouteBaseline"
    || state === "waitingMemberCandidate";
}

export function applyRuntimeActivationPostureToStreamSession(session, activation = {}) {
  if (!session || typeof session !== "object") return "";
  const record = asObject(activation);
  const state = String(record.state || "").trim();
  const lastError = asObject(record.lastError);
  if (state === "waitingRouteBaseline" || state === "waitingRoute") {
    session.routePending = true;
    session.routeState = state;
    return state;
  }
  if (state === "waitingServiceAcceptance") {
    session.routePending = false;
    session.routeState = "delivered";
    return state;
  }
  if (state === "serviceAdmissionTimedOut") {
    session.routePending = false;
    session.serviceAdmissionTimedOut = true;
    session.runtimeBlockedReason = String(lastError.message || "Stream route delivered but service did not admit.").trim();
    session.routeState = "serviceAdmissionTimedOut";
    return state;
  }
  if (state === "serviceRejected") {
    session.routePending = false;
    session.serviceRejected = true;
    session.runtimeBlockedReason = String(lastError.message || "Stream service rejected.").trim();
    session.routeState = "serviceRejected";
    return state;
  }
  if (state === "waitingServiceAnswer") {
    session.routePending = false;
    session.serviceAccepted = true;
    session.routeState = "serviceAccepted";
    return state;
  }
  if (state === "answerMaterialized") {
    session.routePending = false;
    session.serviceAccepted = true;
    session.answerReceived = true;
    session.routeState = "serviceAccepted";
    return state;
  }
  return state;
}

export function applyRuntimeMediaFulfillmentPostureToStreamSession(session, posture = {}) {
  if (!session || typeof session !== "object") return "";
  const record = asObject(posture);
  const state = String(record.state || "").trim();
  const blockedReasons = Array.isArray(record.blockedReasons)
    ? record.blockedReasons.map((reason) => String(reason || "").trim()).filter(Boolean)
    : [];
  const latestEvidence = asObject(record.latestEvidence);
  const blockedReason = blockedReasons[0] || String(latestEvidence.blockedReason || "").trim();
  session.mediaPathState = state;
  session.mediaBlockedReason = blockedReason;
  session.mediaVisibleFrame = record.visibleFrame === true;
  session.mediaTrackLive = record.trackLive === true;
  session.mediaTransportUsable = record.transportUsable === true;
  if (state === "blocked") {
    session.routePending = false;
    session.routeState = "mediaBlocked";
    session.adapterFailed = true;
    session.adapterFailureReason = blockedReason || "mediaTransportBlocked";
    return state;
  }
  if (state === "released") {
    session.routePending = false;
    session.routeState = "mediaReleased";
    return state;
  }
  if (state === "usable") {
    session.routePending = false;
    session.routeState = "mediaUsable";
    session.adapterFailed = false;
    session.adapterFailureReason = "";
    return state;
  }
  return state;
}

export function runtimeStreamSessionPosture(sessions = []) {
  const uniqueSessions = Array.from(new Set(Array.isArray(sessions) ? sessions : []))
    .filter((session) => session && typeof session === "object");
  const expiresAt = uniqueSessions
    .map((session) => Number(session.expiresAt || 0))
    .filter((value) => value > 0)
    .reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY);
  return {
    sessionCount: uniqueSessions.length,
    waitingRouteCount: uniqueSessions.filter((session) => session.routePending).length,
    waitingServiceAcceptanceCount: uniqueSessions.filter((session) => !session.routePending && !session.serviceAccepted && !session.serviceRejected && !session.serviceAdmissionTimedOut).length,
    serviceAdmissionTimedOutCount: uniqueSessions.filter((session) => session.serviceAdmissionTimedOut).length,
    waitingAnswerCount: uniqueSessions.filter((session) => session.serviceAccepted && !session.answerReceived).length,
    rejectedCount: uniqueSessions.filter((session) => session.serviceRejected).length,
    answerReceivedCount: uniqueSessions.filter((session) => session.answerReceived).length,
    mediaBlockedCount: uniqueSessions.filter((session) => session.mediaPathState === "blocked").length,
    mediaUsableCount: uniqueSessions.filter((session) => session.mediaPathState === "usable").length,
    mediaReleasedCount: uniqueSessions.filter((session) => session.mediaPathState === "released").length,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0,
  };
}
