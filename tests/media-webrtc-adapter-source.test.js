import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

function source(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("media webrtc adapter owns runtime media transport profile helpers", () => {
  const adapter = source("src/media-webrtc-adapter.ts");

  assert.match(adapter, /export type RuntimeMediaTransportProfile/);
  assert.match(adapter, /export function runtimeMediaIceServers/);
  assert.match(adapter, /export function runtimeMediaIceServerUrls/);
  assert.match(adapter, /export function runtimeMediaTransportContract/);
  assert.match(adapter, /export function runtimeMediaTransportBlockedDetail/);
  assert.match(adapter, /export function isRuntimeMediaTransportProfileFailure/);
  assert.match(adapter, /RUNTIME_MEDIA_TRANSPORT_PROFILE_GET = "runtime\.media\.transport\.profile\.get"/);
  assert.match(adapter, /MEDIA_CORRELATION_MATERIALIZATION_BUDGET_ID = "media-webrtc\.correlation"/);
  assert.match(adapter, /MEDIA_RENDER_WAITING_GRACE_MS = 5_000/);
  assert.match(adapter, /MEDIA_RENDER_BLOCKED_GRACE_MS = 10_000/);
  assert.match(adapter, /function mediaCorrelationKeys\(/);
  assert.match(adapter, /function mediaCorrelationMaterializationBudget\(/);
  assert.match(adapter, /lastRenderCurrentTime/);
  assert.match(adapter, /playbackAdvanced/);
  assert.match(adapter, /renderPlaybackStalled/);
  assert.match(adapter, /renderDimensionsMissing/);
  assert.match(adapter, /assertMaterializationBudget/);
  assert.match(adapter, /correlationBudget: mediaCorrelationMaterializationBudget\(correlationKeys, issuedAt\)/);
  assert.doesNotMatch(adapter, /correlationKeys: new Set\(\[options\.sessionId, options\.nonce\]\.filter\(Boolean\)\)/);
  assert.match(adapter, /profile\.iceServers/);
  assert.match(adapter, /iceServerCount: runtimeMediaIceServers\(profile\)\.length/);
});
