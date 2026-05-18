import assert from "node:assert/strict";
import test from "node:test";
import {
  createSurfaceModuleRegistry,
  requireSurfaceModuleBinding,
  requireSurfaceModuleImplementation,
  surfaceAppModuleBindings,
  surfaceAppModuleImplementations,
  surfaceModuleBinding,
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

test("surface module registry reduces contract claims into reusable module bindings", () => {
  const registry = createSurfaceModuleRegistry([
    {
      moduleRef: "constitute-ui/runtime-surface-client@0.1.0",
      role: "runtimeClient",
      version: "0.1.0",
      primitiveRefs: ["runtime.attach"],
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

  const platformBinding = surfaceModuleBinding(registry, makeSurfaceApp(), "platformAdapter");

  assert.equal(platformBinding.kind, "surface.module.binding");
  assert.equal(platformBinding.state, "ready");
  assert.equal(platformBinding.role, "platformAdapter");
  assert.equal(platformBinding.participantSide, "window");
  assert.equal(platformBinding.fulfillmentMode, "bundled");
  assert.deepEqual(platformBinding.primitiveRefs, ["media.transport.path"]);
  assert.equal(platformBinding.implementation.bind, true);
  assert.equal(
    requireSurfaceModuleBinding(registry, makeSurfaceApp(), "platformAdapter").implementation,
    platformBinding.implementation,
  );

  const bindings = surfaceAppModuleBindings(registry, makeSurfaceApp(), {
    runtimeClient: "runtimeClient",
    media: { role: "platformAdapter", options: { primitiveRef: "media.transport.path" } },
    view: "productView",
  });

  assert.equal(bindings.kind, "surface.app.module.bindings");
  assert.equal(bindings.state, "ready");
  assert.deepEqual(bindings.keys, ["runtimeClient", "media", "view"]);
  assert.equal(bindings.byKey.media.implementation.bind, true);
  assert.equal(bindings.byRole.platformAdapter[0], bindings.byKey.media);
  assert.deepEqual(bindings.implementations, [{ attach: true }, { bind: true }, { render: true }]);
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
