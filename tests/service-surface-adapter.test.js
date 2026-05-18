import assert from "node:assert/strict";
import test from "node:test";
import {
  createServiceSurfaceAdapter,
  serviceSurfaceActionTimeoutMs,
  serviceSurfaceAdapterPosture,
} from "../src/service-surface-adapter.js";

test("service surface adapter reduces binding posture and owns request fallback mechanics", async () => {
  const calls = [];
  const bindingPosture = {
    state: "ready",
    moduleRef: "service-ui/service-surface-adapter@0.1.0",
    implementationRef: "service-ui/service-surface-adapter@0.1.0",
    role: "serviceSurfaceAdapter",
    participantSide: "window",
    primitiveRefs: ["runtime.intent"],
    actionRefs: ["service.refresh"],
    projectionRefs: ["service.projection"],
    materializationBudgetRefs: ["service-ui.actions"],
    releaseRefs: ["release:service-ui"],
  };
  const adapter = createServiceSurfaceAdapter({
    bindingPosture,
    defaultTimeoutMs: 1000,
    actionTimeoutMs: { "service.refresh": 3000 },
    publishRuntimeIntent: async (action, payload, timeoutMs) => {
      calls.push({ action, payload, timeoutMs });
    },
    projectionFallback: (action, payload, posture) => ({
      action,
      payload,
      moduleRef: posture.moduleRef,
      accepted: true,
    }),
  });

  assert.equal(adapter.kind, "surface.serviceSurface.adapter");
  assert.equal(adapter.moduleRef, "service-ui/service-surface-adapter@0.1.0");
  assert.equal(adapter.posture.state, "ready");
  assert.deepEqual(adapter.posture.primitiveRefs, ["runtime.intent"]);
  assert.deepEqual(adapter.posture.actionRefs, ["service.refresh"]);
  assert.deepEqual(adapter.posture.projectionRefs, ["service.projection"]);
  assert.equal(adapter.timeoutMs("service.refresh"), 3000);
  assert.equal(serviceSurfaceActionTimeoutMs("other", { defaultTimeoutMs: 1000 }), 1000);

  const result = await adapter.request("service.refresh", { refresh: true });
  assert.deepEqual(calls, [{ action: "service.refresh", payload: { refresh: true }, timeoutMs: 3000 }]);
  assert.equal(result.moduleRef, "service-ui/service-surface-adapter@0.1.0");
});

test("service surface adapter blocks missing module refs before runtime intent", async () => {
  const posture = serviceSurfaceAdapterPosture(null);
  assert.equal(posture.state, "blocked");
  assert.equal(posture.blockedReason, "missingServiceSurfaceAdapterModuleRef");

  const adapter = createServiceSurfaceAdapter({
    bindingPosture: posture,
    publishRuntimeIntent: async () => {},
  });

  await assert.rejects(() => adapter.request("service.refresh"), /missingServiceSurfaceAdapterModuleRef/);
});
