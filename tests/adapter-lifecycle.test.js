import test from "node:test";
import assert from "node:assert/strict";
import {
  adapterReconnectDelayMs,
  adapterReconnectJitterMs,
  adapterReconnectLifecyclePosture,
  adapterReleaseLifecyclePosture,
  surfaceAdapterLifecyclePosture,
} from "../src/adapter-lifecycle.js";

test("adapter lifecycle helper reduces reconnect posture with bounded backoff", () => {
  assert.equal(adapterReconnectJitterMs(1500, () => 0.5), 500);
  assert.equal(adapterReconnectDelayMs(1, 1500, 30_000, 250), 1750);
  assert.equal(adapterReconnectDelayMs(5, 1500, 10_000, 250), 10_000);

  const posture = adapterReconnectLifecyclePosture({
    adapterRef: "adapter:media-webrtc:browser",
    moduleRef: "constitute-ui/media-webrtc-adapter@0.1.0",
    surfaceRef: "surface:nvr-ui",
    subjectRef: "session:nvr-preview-1",
    intentRefs: ["intent:nvr-preview"],
    sessionRefs: ["session:nvr-preview-1"],
    releaseRefs: ["release:nvr-ui:local"],
    attempt: 3,
    delayMs: 6000,
    reason: "inboundRtpStalled",
    openResourceCount: 2,
    observedAt: 1700000000,
  });

  assert.equal(posture.kind, "surface.adapter.lifecycle.posture");
  assert.equal(posture.state, "reconnecting");
  assert.equal(posture.reconnect.attempt, 3);
  assert.equal(posture.reconnect.nextRetryAt, 1700006000);
  assert.equal(posture.cleanup.releaseRequired, true);
  assert.equal(posture.cleanup.openResourceCount, 2);
});

test("adapter lifecycle helper reduces release and blocked posture", () => {
  const released = adapterReleaseLifecyclePosture({
    adapterRef: "adapter:media-webrtc:browser",
    subjectRef: "session:nvr-preview-1",
    releaseRefs: ["release:nvr-ui:local"],
    observedAt: 1700000100,
  });
  assert.equal(released.state, "released");
  assert.equal(released.cleanup.releaseRequired, false);
  assert.equal(released.cleanup.openResourceCount, 0);
  assert(released.releaseRefs.includes("release:nvr-ui:local"));

  const blocked = surfaceAdapterLifecyclePosture({
    adapterRef: "adapter:media-webrtc:browser",
    subjectRef: "session:nvr-preview-2",
    state: "blocked",
    blockedReason: "missingTransportProfile",
    observedAt: 1700000200,
  });
  assert.equal(blocked.state, "blocked");
  assert.deepEqual(blocked.blockedReasons, ["missingTransportProfile"]);
});
