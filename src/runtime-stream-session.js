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
  "fulfillmentSessionId",
  "fulfillment_session_id",
  "operationRef",
  "operation_ref",
  "operationClassRef",
  "operation_class_ref",
  "methodRef",
  "method_ref",
  "pathId",
  "path_id",
  "sourceRef",
  "source_ref",
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

export function collectRuntimeMediaTransportObservationKeys(observation = {}) {
  const keys = new Set();
  const record = asObject(observation);
  addRecordKeys(keys, record);
  addRecordKeys(keys, asObject(record.safeFacts));
  addRuntimeStreamKey(keys, record.observationId);
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
  if (state === "waitingRender") {
    session.routePending = false;
    session.serviceAccepted = true;
    session.answerReceived = true;
    session.routeState = "waitingRender";
    return state;
  }
  if (state === "renderBlocked" || state === "mediaPathBlocked" || state === "mediaBlocked") {
    session.routePending = false;
    session.routeState = state;
    session.adapterFailed = true;
    session.adapterFailureReason = String(lastError.message || state).trim();
    return state;
  }
  if (state === "adapterLive") {
    session.routePending = false;
    session.answerReceived = true;
    session.routeState = "mediaUsable";
    session.adapterFailed = false;
    session.adapterFailureReason = "";
    return state;
  }
  return state;
}

export function applyRuntimeStreamLifecycleToStreamSession(session, lifecycle = {}) {
  if (!session || typeof session !== "object") return "";
  const phase = String(lifecycle.phase || "").trim();
  const record = asObject(lifecycle.record);
  if (phase === "admission") {
    session.serviceAccepted = true;
    session.serviceRejected = false;
    session.serviceAdmissionTimedOut = false;
    session.runtimeBlockedReason = "";
    session.routePending = false;
    session.routeState = "serviceAccepted";
    return phase;
  }
  if (phase === "reject") {
    const reason = String(record.reasonCode || record.reason || "service rejected").trim();
    session.serviceRejected = true;
    session.serviceAdmissionTimedOut = false;
    session.runtimeBlockedReason = reason;
    session.routePending = false;
    session.routeState = "serviceRejected";
    return phase;
  }
  if (phase === "answer") {
    session.serviceAccepted = true;
    session.serviceRejected = false;
    session.serviceAdmissionTimedOut = false;
    session.runtimeBlockedReason = "";
    session.routePending = false;
    session.routeState = "serviceAccepted";
    session.answerReceived = true;
    return phase;
  }
  if (phase === "health") {
    session.healthStatus = String(record.status || "").trim();
    return phase;
  }
  return phase;
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
  const postureState = String(record.postureState || "").trim();
  session.mediaPathState = state;
  session.mediaPostureState = postureState;
  session.mediaBlockedReason = blockedReason;
  session.mediaVisibleFrame = record.visibleFrame === true;
  session.mediaTrackLive = record.trackLive === true;
  session.mediaTransportUsable = record.transportUsable === true;
  session.mediaRenderReadinessState = String(record.renderReadinessState || asObject(latestEvidence.safeFacts).readinessState || "").trim();
  if (state === "blocked") {
    session.routePending = false;
    session.routeState = postureState || "mediaBlocked";
    session.adapterFailed = true;
    session.adapterFailureReason = blockedReason || postureState || "mediaTransportBlocked";
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
  if (postureState === "waitingRender") {
    session.routePending = false;
    session.routeState = "waitingRender";
    session.adapterFailed = false;
    session.adapterFailureReason = "";
    return state;
  }
  return state;
}

function normalizeTransportObservations(source = {}) {
  if (Array.isArray(source)) return source.map(asObject).filter((item) => Object.keys(item).length > 0);
  const record = asObject(source);
  const observations = Array.isArray(record.observations)
    ? record.observations
    : Array.isArray(record.mediaTransportObservations)
      ? record.mediaTransportObservations
      : Array.isArray(record.records)
        ? record.records
        : [];
  if (observations.length > 0) return observations.map(asObject).filter((item) => Object.keys(item).length > 0);
  return Object.keys(record).length > 0 ? [record] : [];
}

function firstObservationString(observations, field, fallback = "") {
  for (const observation of observations) {
    const value = String(asObject(observation)[field] || "").trim();
    if (value) return value;
  }
  return String(fallback || "").trim();
}

function latestObservation(observations, predicate = () => true) {
  return observations
    .filter((observation) => predicate(asObject(observation)))
    .sort((left, right) => Number(asObject(right).observedAt || 0) - Number(asObject(left).observedAt || 0))[0] || null;
}

function latestObservationValue(observations, field) {
  const found = latestObservation(observations, (observation) => String(observation[field] || "").trim());
  return found ? String(asObject(found)[field] || "").trim() : "";
}

function observationSafeFacts(observation) {
  return asObject(asObject(observation).safeFacts);
}

function collectTransportBlockedReasons(observations) {
  const reasons = [];
  for (const observation of observations) {
    const record = asObject(observation);
    const reason = String(record.blockedReason || record.reason || "").trim();
    if (String(record.state || "").trim() === "blocked" && reason) reasons.push(reason);
    const facts = observationSafeFacts(record);
    const readiness = String(facts.readinessState || "").trim();
    if (readiness === "renderBlocked") reasons.push("renderBlocked");
  }
  return Array.from(new Set(reasons));
}

export function runtimeMediaTransportReadModel(source = {}, options = {}) {
  const sourceObject = asObject(source);
  const observations = normalizeTransportObservations(source);
  const fulfillmentSessionId = firstObservationString(
    observations,
    "fulfillmentSessionId",
    options.fulfillmentSessionId || sourceObject.fulfillmentSessionId,
  );
  const sessionId = firstObservationString(observations, "sessionId", options.sessionId || sourceObject.sessionId);
  const pathId = firstObservationString(observations, "pathId", options.pathId || sourceObject.pathId);
  const serviceObservation = latestObservation(observations, (observation) => String(observation.participantRole || "").trim() === "service");
  const browserObservation = latestObservation(observations, (observation) => String(observation.participantRole || "").trim() === "browser");
  const latest = latestObservation(observations);
  const latestByRole = Array.from(new Set([serviceObservation, browserObservation, latest].filter(Boolean)));
  const blockedReasons = collectTransportBlockedReasons(latestByRole);
  const selectedPairState = latestObservationValue(observations, "selectedPairState");
  const inboundRtpState = latestObservationValue(observations, "inboundRtpState");
  const trackState = latestObservationValue(observations, "trackState");
  const renderState = latestObservationValue(observations, "renderState");
  const latestState = String(asObject(latest).state || "").trim();
  const latestFacts = observationSafeFacts(latest);
  const visibleFrame = renderState === "visible" || latestFacts.visibleFrame === true;
  const trackLive = trackState === "live";
  const selectedPairUsable = selectedPairState === "selected";
  const inboundFlowing = inboundRtpState === "flowing";
  const released = ["released", "closed"].includes(latestState)
    || selectedPairState === "none"
    || trackState === "released";
  const blocked = blockedReasons.length > 0
    || latestState === "blocked"
    || selectedPairState === "failed"
    || inboundRtpState === "blocked"
    || trackState === "blocked"
    || renderState === "blocked";
  const transportUsable = selectedPairUsable && (inboundFlowing || trackLive || visibleFrame);

  let state = "pending";
  let postureState = "waitingTransport";
  if (blocked) {
    state = "blocked";
    postureState = renderState === "blocked" ? "renderBlocked" : "mediaPathBlocked";
  } else if (released) {
    state = "released";
    postureState = "released";
  } else if (visibleFrame && trackLive && transportUsable) {
    state = "usable";
    postureState = "transportUsable";
  } else if (transportUsable && !visibleFrame) {
    postureState = "waitingRender";
  } else if (selectedPairUsable || latestState === "connected") {
    postureState = "transportDegraded";
  }

  return {
    kind: "runtime.media.transport.read-model",
    fulfillmentSessionId,
    sessionId,
    pathId,
    state,
    postureState,
    selectedPairState,
    inboundRtpState,
    trackState,
    renderState,
    blockedReasons,
    serviceObserved: Boolean(serviceObservation),
    browserObserved: Boolean(browserObservation),
    transportUsable,
    trackLive,
    visibleFrame,
    latestObservedAt: Number(asObject(latest).observedAt || 0) || 0,
    observationCount: observations.length,
    latestObservation: latest ? Object.freeze({ ...asObject(latest) }) : null,
    serviceObservation: serviceObservation ? Object.freeze({ ...asObject(serviceObservation) }) : null,
    browserObservation: browserObservation ? Object.freeze({ ...asObject(browserObservation) }) : null,
  };
}

export function applyRuntimeMediaTransportReadModelToStreamSession(session, source = {}, options = {}) {
  if (!session || typeof session !== "object") return "";
  const posture = String(asObject(source).kind || "") === "runtime.media.transport.read-model"
    ? asObject(source)
    : runtimeMediaTransportReadModel(source, options);
  session.fulfillmentSessionId = String(posture.fulfillmentSessionId || session.fulfillmentSessionId || "").trim();
  session.mediaPathId = String(posture.pathId || session.mediaPathId || "").trim();
  session.mediaPathState = String(posture.state || "").trim();
  session.mediaPostureState = String(posture.postureState || "").trim();
  session.mediaBlockedReason = Array.isArray(posture.blockedReasons) ? String(posture.blockedReasons[0] || "").trim() : "";
  session.mediaVisibleFrame = posture.visibleFrame === true;
  session.mediaTrackLive = posture.trackLive === true;
  session.mediaTransportUsable = posture.transportUsable === true;
  session.mediaRenderReadinessState = String(posture.renderState || "").trim();
  session.serviceMediaObserved = posture.serviceObserved === true;
  session.browserMediaObserved = posture.browserObserved === true;
  if (posture.state === "blocked") {
    session.routePending = false;
    session.routeState = posture.postureState || "mediaPathBlocked";
    session.adapterFailed = true;
    session.adapterFailureReason = session.mediaBlockedReason || session.routeState;
    return posture.state;
  }
  if (posture.state === "released") {
    session.routePending = false;
    session.routeState = "mediaReleased";
    return posture.state;
  }
  if (posture.state === "usable") {
    session.routePending = false;
    session.routeState = "mediaUsable";
    session.adapterFailed = false;
    session.adapterFailureReason = "";
    return posture.state;
  }
  if (posture.postureState === "waitingRender" || posture.postureState === "transportDegraded") {
    session.routePending = false;
    session.routeState = posture.postureState;
    session.adapterFailed = false;
    session.adapterFailureReason = "";
  }
  return posture.state || "";
}

export function runtimeStreamSessionPosture(sessions = []) {
  const uniqueSessions = Array.from(new Set(Array.isArray(sessions) ? sessions : []))
    .filter((session) => session && typeof session === "object");
  const expiresAt = uniqueSessions
    .map((session) => Number(session.expiresAt || 0))
    .filter((value) => value > 0)
    .reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY);
  const waitingServiceAdmissionCount = uniqueSessions
    .filter((session) => !session.routePending && !session.serviceAccepted && !session.serviceRejected && !session.serviceAdmissionTimedOut)
    .length;
  return {
    sessionCount: uniqueSessions.length,
    waitingRouteCount: uniqueSessions.filter((session) => session.routePending).length,
    waitingServiceAdmissionCount,
    waitingServiceAcceptanceCount: waitingServiceAdmissionCount,
    serviceAdmissionTimedOutCount: uniqueSessions.filter((session) => session.serviceAdmissionTimedOut).length,
    waitingAnswerCount: uniqueSessions.filter((session) => session.serviceAccepted && !session.answerReceived).length,
    rejectedCount: uniqueSessions.filter((session) => session.serviceRejected).length,
    answerReceivedCount: uniqueSessions.filter((session) => session.answerReceived).length,
    mediaBlockedCount: uniqueSessions.filter((session) => session.mediaPathState === "blocked").length,
    mediaUsableCount: uniqueSessions.filter((session) => session.mediaPathState === "usable").length,
    mediaReleasedCount: uniqueSessions.filter((session) => session.mediaPathState === "released").length,
    mediaWaitingRenderCount: uniqueSessions.filter((session) => session.mediaPostureState === "waitingRender").length,
    mediaTransportDegradedCount: uniqueSessions.filter((session) => session.mediaPostureState === "transportDegraded").length,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0,
  };
}
