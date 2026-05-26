import test from "node:test";
import assert from "node:assert/strict";
import {
  applyRuntimeActivationPostureToStreamSession,
  applyRuntimeMediaFulfillmentPostureToStreamSession,
  applyRuntimeMediaTransportReadModelToStreamSession,
  applyRuntimeRouteObservationToStreamSession,
  applyRuntimeStreamLifecycleToStreamSession,
  collectRuntimeActivationKeys,
  collectRuntimeIntentResultKeys,
  collectRuntimeMediaFulfillmentKeys,
  collectRuntimeMediaTransportObservationKeys,
  collectRuntimeObservationKeys,
  collectRuntimeStreamFrameKeys,
  runtimeMediaTransportReadModel,
  runtimeIntentFrameId,
  runtimeIntentPendingRoute,
  runtimeIntentWaitingAuthority,
  runtimeRouteObservationPosture,
  runtimeStreamSessionPosture,
} from "../src/runtime-stream-session.js";

test("runtime stream keys collect common frame intent and observation correlation refs", () => {
  assert.deepEqual(
    Array.from(collectRuntimeIntentResultKeys({
      frameId: "frame-1",
      result: {
        activationId: "activation-1",
        frame: { routePromiseId: "route-1", recordRef: { id: "record-1" } },
      },
    })).sort(),
    ["activation-1", "frame-1", "record-1", "route-1"],
  );

  assert.deepEqual(
    Array.from(collectRuntimeStreamFrameKeys({
      frameId: "frame-2",
      body: {
        payload: {
          sessionId: "session-1",
          nonce: "nonce-1",
        },
      },
    }, {
      payload: {
        interaction_id: "interaction-1",
      },
    })).sort(),
    ["frame-2", "interaction-1", "nonce-1", "session-1"],
  );

  assert.deepEqual(
    Array.from(collectRuntimeObservationKeys({
      ackedFrameId: "frame-3",
      correlation_id: "correlation-1",
      routePromiseId: "route-2",
    })).sort(),
    ["correlation-1", "frame-3", "route-2"],
  );

  assert.deepEqual(
    Array.from(collectRuntimeActivationKeys({
      activationId: "activation-2",
      routePromiseId: "route-3",
    })).sort(),
    ["activation-2", "route-3"],
  );

  assert.deepEqual(
    Array.from(collectRuntimeMediaFulfillmentKeys({
      sessionId: "session-2",
      latestEvidence: { routePromiseId: "route-4" },
      evidenceByKind: {
        transportState: { correlationId: "frame-4" },
      },
    })).sort(),
    ["frame-4", "route-4", "session-2"],
  );
});

test("runtime intent posture helpers reduce nested runtime responses", () => {
  const result = {
    result: {
      state: "waitingMemberCandidate",
      pendingRoute: true,
      frame: { frameId: "frame-nested" },
    },
  };

  assert.equal(runtimeIntentFrameId(result), "frame-nested");
  assert.equal(runtimeIntentPendingRoute(result), true);
  assert.equal(runtimeIntentWaitingAuthority({ result: { state: "waitingAuthority" } }), true);
});

test("runtime activation posture applies service admission lifecycle to stream session", () => {
  const session = {
    routePending: true,
    serviceAccepted: false,
    serviceRejected: false,
    answerReceived: false,
    serviceAdmissionTimedOut: false,
    routeState: "",
    runtimeBlockedReason: "",
    expiresAt: Date.now() + 30_000,
  };

  assert.equal(applyRuntimeActivationPostureToStreamSession(session, { state: "waitingServiceAcceptance" }), "waitingServiceAcceptance");
  assert.equal(session.routePending, false);
  assert.equal(session.routeState, "delivered");

  assert.equal(applyRuntimeActivationPostureToStreamSession(session, { state: "waitingServiceAnswer" }), "waitingServiceAnswer");
  assert.equal(session.serviceAccepted, true);
  assert.equal(session.routeState, "serviceAccepted");

  assert.equal(applyRuntimeActivationPostureToStreamSession(session, { state: "answerMaterialized" }), "answerMaterialized");
  assert.equal(session.answerReceived, true);
  assert.equal(session.routeState, "serviceAccepted");

  assert.deepEqual(runtimeStreamSessionPosture([session]), {
    sessionCount: 1,
    waitingRouteCount: 0,
    waitingServiceAdmissionCount: 0,
    waitingServiceAcceptanceCount: 0,
    serviceAdmissionTimedOutCount: 0,
    waitingAnswerCount: 0,
    rejectedCount: 0,
    answerReceivedCount: 1,
    mediaBlockedCount: 0,
    mediaUsableCount: 0,
    mediaReleasedCount: 0,
    mediaWaitingRenderCount: 0,
    mediaTransportDegradedCount: 0,
    expiresAt: session.expiresAt,
  });
});

test("runtime stream lifecycle frames apply service posture to stream session", () => {
  const session = {
    routePending: true,
    serviceAccepted: false,
    serviceRejected: false,
    answerReceived: false,
    serviceAdmissionTimedOut: false,
    routeState: "",
    runtimeBlockedReason: "",
    healthStatus: "",
  };

  assert.equal(applyRuntimeStreamLifecycleToStreamSession(session, { phase: "admission" }), "admission");
  assert.equal(session.routePending, false);
  assert.equal(session.serviceAccepted, true);
  assert.equal(session.routeState, "serviceAccepted");

  assert.equal(applyRuntimeStreamLifecycleToStreamSession(session, { phase: "answer" }), "answer");
  assert.equal(session.answerReceived, true);
  assert.equal(session.serviceRejected, false);
  assert.equal(session.runtimeBlockedReason, "");

  assert.equal(applyRuntimeStreamLifecycleToStreamSession(session, {
    phase: "reject",
    record: { reasonCode: "unsupportedSource" },
  }), "reject");
  assert.equal(session.serviceRejected, true);
  assert.equal(session.serviceAdmissionTimedOut, false);
  assert.equal(session.runtimeBlockedReason, "unsupportedSource");
  assert.equal(session.routeState, "serviceRejected");

  assert.equal(applyRuntimeStreamLifecycleToStreamSession(session, {
    phase: "health",
    record: { status: "closed" },
  }), "health");
  assert.equal(session.healthStatus, "closed");
});

test("runtime route observations remain route posture rather than service admission", () => {
  const session = {
    routePending: true,
    routeState: "",
    serviceAccepted: false,
    expiresAt: Date.now() + 30_000,
  };

  const routeAccepted = runtimeRouteObservationPosture({ state: "accepted" });
  assert.equal(routeAccepted.routeDelivered, true);
  assert.equal(routeAccepted.routeState, "routeAccepted");

  assert.equal(applyRuntimeRouteObservationToStreamSession(session, { state: "accepted" }).routeState, "routeAccepted");
  assert.equal(session.routePending, false);
  assert.equal(session.routeState, "routeAccepted");
  assert.equal(session.serviceAccepted, false);

  assert.equal(applyRuntimeRouteObservationToStreamSession(session, { state: "memberRead" }).routeState, "memberRead");
  assert.equal(session.routeState, "memberRead");
  assert.equal(session.serviceAccepted, false);
});

test("runtime media fulfillment posture applies recovery state to stream session", () => {
  const session = {
    routePending: false,
    routeState: "serviceAccepted",
    serviceAccepted: true,
    answerReceived: true,
    adapterFailed: false,
    adapterFailureReason: "",
    expiresAt: Date.now() + 30_000,
  };

  assert.equal(applyRuntimeMediaFulfillmentPostureToStreamSession(session, {
    state: "blocked",
    postureState: "mediaPathBlocked",
    blockedReasons: ["inboundRtpStalled"],
    visibleFrame: false,
    trackLive: true,
    transportUsable: true,
  }), "blocked");
  assert.equal(session.routeState, "mediaPathBlocked");
  assert.equal(session.mediaPostureState, "mediaPathBlocked");
  assert.equal(session.adapterFailed, true);
  assert.equal(session.adapterFailureReason, "inboundRtpStalled");

  assert.deepEqual(runtimeStreamSessionPosture([session]), {
    sessionCount: 1,
    waitingRouteCount: 0,
    waitingServiceAdmissionCount: 0,
    waitingServiceAcceptanceCount: 0,
    serviceAdmissionTimedOutCount: 0,
    waitingAnswerCount: 0,
    rejectedCount: 0,
    answerReceivedCount: 1,
    mediaBlockedCount: 1,
    mediaUsableCount: 0,
    mediaReleasedCount: 0,
    mediaWaitingRenderCount: 0,
    mediaTransportDegradedCount: 0,
    expiresAt: session.expiresAt,
  });

  assert.equal(applyRuntimeMediaFulfillmentPostureToStreamSession(session, {
    state: "pending",
    postureState: "waitingRender",
    renderReadinessState: "waitingRender",
    visibleFrame: false,
    trackLive: true,
    transportUsable: true,
  }), "pending");
  assert.equal(session.routeState, "waitingRender");
  assert.equal(session.adapterFailed, false);
  assert.equal(session.mediaRenderReadinessState, "waitingRender");

  assert.equal(applyRuntimeMediaFulfillmentPostureToStreamSession(session, {
    state: "usable",
    postureState: "adapterLive",
    visibleFrame: true,
    trackLive: true,
    transportUsable: true,
  }), "usable");
  assert.equal(session.routeState, "mediaUsable");
  assert.equal(session.adapterFailed, false);
});

test("runtime media transport read model reduces browser and service observations by fulfillment session", () => {
  assert.deepEqual(
    Array.from(collectRuntimeMediaTransportObservationKeys({
      observationId: "obs-1",
      fulfillmentSessionId: "fulfillment:preview:nvr-preview-1",
      pathId: "nvr-preview-1:path:browserWebRtc",
      safeFacts: { sourceRef: "camera:front" },
    })).sort(),
    [
      "camera:front",
      "fulfillment:preview:nvr-preview-1",
      "nvr-preview-1:path:browserWebRtc",
      "obs-1",
    ],
  );

  const observations = [
    {
      kind: "media.transport.observation",
      observationId: "service-1",
      fulfillmentSessionId: "fulfillment:preview:nvr-preview-1",
      sessionId: "nvr-preview-1",
      pathId: "nvr-preview-1:path:browserWebRtc",
      participantRole: "service",
      state: "connected",
      selectedPairState: "selected",
      inboundRtpState: "flowing",
      trackState: "live",
      observedAt: 1_700_000_001,
    },
    {
      kind: "media.transport.observation",
      observationId: "browser-1",
      fulfillmentSessionId: "fulfillment:preview:nvr-preview-1",
      sessionId: "nvr-preview-1",
      pathId: "nvr-preview-1:path:browserWebRtc",
      participantRole: "browser",
      state: "connected",
      selectedPairState: "selected",
      inboundRtpState: "flowing",
      trackState: "live",
      renderState: "pending",
      observedAt: 1_700_000_002,
    },
  ];
  const waiting = runtimeMediaTransportReadModel(observations);
  assert.equal(waiting.kind, "runtime.media.transport.read-model");
  assert.equal(waiting.fulfillmentSessionId, "fulfillment:preview:nvr-preview-1");
  assert.equal(waiting.serviceObserved, true);
  assert.equal(waiting.browserObserved, true);
  assert.equal(waiting.state, "pending");
  assert.equal(waiting.postureState, "waitingRender");
  assert.equal(waiting.transportUsable, true);
  assert.equal(waiting.trackLive, true);
  assert.equal(waiting.visibleFrame, false);

  const session = {
    routePending: false,
    routeState: "serviceAccepted",
    serviceAccepted: true,
    answerReceived: true,
    adapterFailed: false,
    adapterFailureReason: "",
    expiresAt: Date.now() + 30_000,
  };
  assert.equal(applyRuntimeMediaTransportReadModelToStreamSession(session, waiting), "pending");
  assert.equal(session.routeState, "waitingRender");
  assert.equal(session.fulfillmentSessionId, "fulfillment:preview:nvr-preview-1");
  assert.equal(session.mediaTransportUsable, true);
  assert.equal(session.serviceMediaObserved, true);
  assert.equal(session.browserMediaObserved, true);

  const usable = runtimeMediaTransportReadModel([
    ...observations,
    { ...observations[1], observationId: "browser-2", renderState: "visible", observedAt: 1_700_000_003 },
  ]);
  assert.equal(usable.state, "usable");
  assert.equal(usable.postureState, "transportUsable");
  assert.equal(applyRuntimeMediaTransportReadModelToStreamSession(session, usable), "usable");
  assert.equal(session.routeState, "mediaUsable");

  const blocked = runtimeMediaTransportReadModel([
    ...observations,
    {
      ...observations[0],
      observationId: "service-2",
      state: "blocked",
      inboundRtpState: "blocked",
      trackState: "blocked",
      blockedReason: "sourceRtpUnavailable",
      observedAt: 1_700_000_004,
    },
  ]);
  assert.equal(blocked.state, "blocked");
  assert.equal(blocked.postureState, "mediaPathBlocked");
  assert.deepEqual(blocked.blockedReasons, ["sourceRtpUnavailable"]);
});
