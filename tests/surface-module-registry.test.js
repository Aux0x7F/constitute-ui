import assert from "node:assert/strict";
import test from "node:test";
import {
  createSurfaceModuleRegistry,
  requireSurfaceModuleImplementation,
  surfaceAppModuleImplementations,
  surfaceModuleRegistryPosture,
} from "../src/surface-module-registry.js";
import { defineSurfaceAppContract } from "../src/surface-app-contract.js";

function makeSurfaceApp(overrides = {}) {
  return defineSurfaceAppContract({
    contractId: "surface-app:nvr-ui",
    appId: "constitute-nvr-ui",
    version: "0.1.0",
    requiredModuleRoles: ["runtimeClient", "platformAdapter", "productView"],
    modules: [
      {
        moduleRef: "constitute-ui/runtime-surface-client@0.1.0",
        role: "runtimeClient",
        participantSide: "window",
        fulfillmentMode: "bundled",
        version: "0.1.0",
        primitiveRefs: ["runtime.attach"],
      },
      {
        moduleRef: "constitute-ui/media-webrtc-adapter@0.1.0",
        role: "platformAdapter",
        participantSide: "window",
        fulfillmentMode: "bundled",
        version: "0.1.0",
        primitiveRefs: ["media.transport.path"],
        fallbackRefs: ["constitute-ui/media-webrtc-adapter@0.1.0-local"],
      },
      {
        moduleRef: "constitute-nvr-ui/product-view@0.1.0",
        role: "productView",
        participantSide: "window",
        fulfillmentMode: "bundled",
        version: "0.1.0",
      },
    ],
    ...overrides,
  });
}

test("surface module registry resolves contract role claims to bundled implementations", () => {
  const registry = createSurfaceModuleRegistry([
    {
      moduleRef: "constitute-ui/runtime-surface-client@0.1.0",
      role: "runtimeClient",
      version: "0.1.0",
      implementation: { attach: true },
    },
    {
      moduleRef: "constitute-ui/media-webrtc-adapter@0.1.0",
      role: "platformAdapter",
      version: "0.1.0",
      primitiveRefs: ["media.transport.path"],
      implementation: { bind: true },
    },
    {
      moduleRef: "constitute-nvr-ui/product-view@0.1.0",
      role: "productView",
      version: "0.1.0",
      implementation: { render: true },
    },
  ]);

  assert.equal(registry.has("constitute-ui/media-webrtc-adapter@0.1.0"), true);
  assert.equal(registry.role("platformAdapter").length, 1);

  const posture = surfaceModuleRegistryPosture(registry, makeSurfaceApp(), "platformAdapter", {
    primitiveRef: "media.transport.path",
  });

  assert.equal(posture.state, "ready");
  assert.equal(posture.moduleRef, "constitute-ui/media-webrtc-adapter@0.1.0");
  assert.equal(posture.implementationRef, "constitute-ui/media-webrtc-adapter@0.1.0");
  assert.equal(posture.implementation.implementation.bind, true);
  assert.deepEqual(posture.fallbackTried, ["constitute-ui/media-webrtc-adapter@0.1.0"]);
});

test("surface module registry uses contract fallback refs without moving policy into product UI", () => {
  const registry = createSurfaceModuleRegistry([
    {
      moduleRef: "constitute-ui/media-webrtc-adapter@0.1.0-local",
      role: "platformAdapter",
      version: "0.1.0",
      implementation: { fallback: true },
    },
  ]);

  const posture = surfaceModuleRegistryPosture(registry, makeSurfaceApp(), "platformAdapter");

  assert.equal(posture.state, "ready");
  assert.equal(posture.moduleRef, "constitute-ui/media-webrtc-adapter@0.1.0");
  assert.equal(posture.implementationRef, "constitute-ui/media-webrtc-adapter@0.1.0-local");
  assert.deepEqual(posture.fallbackTried, [
    "constitute-ui/media-webrtc-adapter@0.1.0",
    "constitute-ui/media-webrtc-adapter@0.1.0-local",
  ]);
});

test("surface module registry reports missing implementations as posture", () => {
  const registry = createSurfaceModuleRegistry([]);
  const posture = surfaceModuleRegistryPosture(registry, makeSurfaceApp(), "platformAdapter");

  assert.equal(posture.state, "blocked");
  assert.equal(posture.blockedReason, "missingModuleImplementation");
  assert.throws(
    () => requireSurfaceModuleImplementation(registry, makeSurfaceApp(), "platformAdapter"),
    /missingModuleImplementation/,
  );
});

test("surface app module implementation summary preserves role-level blocked reasons", () => {
  const surfaceApp = makeSurfaceApp();
  const registry = createSurfaceModuleRegistry([
    {
      moduleRef: "constitute-ui/runtime-surface-client@0.1.0",
      role: "runtimeClient",
      version: "0.1.0",
      implementation: { attach: true },
    },
  ]);

  const summary = surfaceAppModuleImplementations(registry, surfaceApp);

  assert.equal(summary.kind, "surface.app.module.implementations");
  assert.equal(summary.state, "blocked");
  assert.equal(summary.implementations.length, 1);
  assert.deepEqual(summary.postures.map((posture) => posture.role), ["runtimeClient", "platformAdapter", "productView"]);
  assert.equal(summary.postures[1].blockedReason, "missingModuleImplementation");
});
