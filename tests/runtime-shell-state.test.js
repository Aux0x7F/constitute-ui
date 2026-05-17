import test from "node:test";
import assert from "node:assert/strict";
import {
  browserStorageShellContext,
  deriveRuntimeShellState,
  runtimeShellConnectionToneClass,
} from "../src/runtime-shell-state.js";

test("runtime shell state derives authority and resource posture from snapshots", () => {
  const state = deriveRuntimeShellState({
    buildId: "runtime-test",
    authority: { state: "ready", ready: true, devicePk: "device-1" },
    shell: {
      identity: { identityId: "identity-1", handle: "aux" },
      services: { state: "available" },
    },
    services: { nvr: { service: "nvr" } },
    resource: { state: "withinBudget", profileId: "profile-1" },
    materialization: {
      state: "pressure",
      reason: "projectionStoreMaterializationPressure",
      budgets: [{ budgetId: "runtime.projections.retained" }],
      fanout: 2,
      projectionCount: 3,
      runtimeEventCount: 5,
    },
    retention: { state: "blocked", releaseRequired: true },
  });

  assert.equal(state.identity.handle, "@aux");
  assert.equal(state.identity.authorityState, "ready");
  assert.equal(state.connection.label, "Runtime attached");
  assert.equal(state.services.count, 1);
  assert.equal(state.resource.state, "withinBudget");
  assert.equal(state.materialization.state, "pressure");
  assert.equal(state.materialization.budgetCount, 1);
  assert.equal(state.materialization.fanout, 2);
  assert.equal(state.materialization.projectionCount, 3);
  assert.equal(state.retention.releaseRequired, true);
});

test("runtime shell state separates route acceptance from live adapter posture", () => {
  const routed = deriveRuntimeShellState({}, { routeDelivered: true });
  const accepted = deriveRuntimeShellState({}, { routeDelivered: true, serviceAccepted: true });
  const live = deriveRuntimeShellState({}, { routeDelivered: true, serviceAccepted: true, adapterLive: true });

  assert.equal(routed.connection.code, "routed");
  assert.equal(accepted.connection.code, "accepted");
  assert.equal(live.connection.code, "live");
  assert.equal(live.interaction.adapterLive, true);
});

test("browser storage shell context prepares fallback identity and service evidence", () => {
  const storage = new Map([
    ["swarm.identityCache", JSON.stringify({ records: [{ identityId: "identity-1", handle: "aux" }] })],
    ["swarm.deviceCache", JSON.stringify({
      records: [
        { devicePk: "browser-1", role: "browser", identityId: "identity-1" },
        { devicePk: "gateway-1", role: "gateway" },
        { devicePk: "nvr-1", role: "service", service: "nvr" },
      ],
    })],
  ]);

  const context = browserStorageShellContext({ getItem: (key) => storage.get(key) || null });
  assert.equal(context.identityId, "identity-1");
  assert.equal(context.identityLabel, "aux");
  assert.equal(context.devicePk, "browser-1");
  assert.equal(context.gatewayPk, "gateway-1");
  assert.equal(context.serviceCount, 1);
});

test("runtime shell connection tone classes stay product-safe", () => {
  assert.equal(runtimeShellConnectionToneClass("live"), "connStateText-connected");
  assert.equal(runtimeShellConnectionToneClass("accepted"), "connStateText-limited");
  assert.equal(runtimeShellConnectionToneClass("offline"), "connStateText-offline");
});
