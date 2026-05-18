import assert from "node:assert/strict";
import test from "node:test";
import {
  createSurfaceModuleRegistry,
  requireSurfaceModuleBinding,
  requireSurfaceModuleImplementation,
  surfaceAdapterBindingPosture,
  surfaceAppModuleBindings,
  surfaceAppModuleImplementations,
  surfaceModuleBinding,
  surfaceModuleRegistryPosture,
  surfacePlatformAdapterBindingPosture,
  surfaceServiceEdgeAdapterBindingPosture,
  surfaceServiceSurfaceAdapterBindingPosture,
} from "../src/surface-module-registry.js";
import {
  defineSurfaceAppContract,
  surfaceAppRuntimeSelectionPosture,
} from "../src/surface-app-contract.js";

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
        evidenceChannels: ["media.transport.observation"],
        lifecycle: { state: "platformBinding", owner: "runtime" },
        materializationBudgetRefs: ["media-webrtc.correlation"],
        renderEvidenceBudgetRef: "media-webrtc.render",
        releaseRefs: ["release:media-webrtc"],
        transportProfileRefs: ["media.transport.profile:browser-webrtc"],
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

test("surface adapter binding posture carries platform contract refs without moving policy into UI", () => {
  const registry = createSurfaceModuleRegistry([
    {
      moduleRef: "constitute-ui/media-webrtc-adapter@0.1.0",
      role: "platformAdapter",
      version: "0.1.0",
      primitiveRefs: ["media.transport.path"],
      evidenceChannels: ["adapter.evidence"],
      materializationBudgetRefs: ["media-webrtc.adapter"],
      transportProfileRefs: ["media.transport.profile:runtime"],
      implementation: { bind: true },
    },
  ]);

  const posture = surfacePlatformAdapterBindingPosture(registry, makeSurfaceApp(), {
    renderEvidenceBudgetRef: "media-webrtc.render",
  });

  assert.equal(posture.kind, "surface.adapter.binding.posture");
  assert.equal(posture.state, "ready");
  assert.equal(posture.role, "platformAdapter");
  assert.equal(posture.taxonomyKey, "platformAdapter");
  assert.equal(posture.moduleRef, "constitute-ui/media-webrtc-adapter@0.1.0");
  assert.equal(posture.implementationRef, "constitute-ui/media-webrtc-adapter@0.1.0");
  assert.equal(posture.participantSide, "window");
  assert.deepEqual(posture.primitiveRefs, ["media.transport.path"]);
  assert.deepEqual(posture.evidenceChannels, ["adapter.evidence", "media.transport.observation"]);
  assert.deepEqual(posture.transportProfileRefs, [
    "media.transport.profile:browser-webrtc",
    "media.transport.profile:runtime",
  ]);
  assert.equal(posture.renderEvidenceBudgetRef, "media-webrtc.render");
  assert.deepEqual(posture.materializationBudgetRefs, [
    "media-webrtc.correlation",
    "media-webrtc.adapter",
  ]);
  assert.deepEqual(posture.releaseRefs, ["release:media-webrtc"]);
  assert.equal(posture.moduleBinding.implementation.bind, true);

  const genericPosture = surfaceAdapterBindingPosture(registry, makeSurfaceApp(), {
    role: "platformAdapter",
    primitiveRef: "media.transport.path",
  });
  assert.equal(genericPosture.state, "ready");
});

test("surface service adapter binding posture defaults to runtime intent primitive", () => {
  const surfaceApp = makeSurfaceApp({
    requiredModuleRoles: ["serviceSurfaceAdapter"],
    modules: [
      {
        moduleRef: "service-ui/service-surface-adapter@0.1.0",
        role: "serviceSurfaceAdapter",
        participantSide: "window",
        fulfillmentMode: "bundled",
        version: "0.1.0",
        primitiveRefs: ["runtime.intent"],
        actionRefs: ["service.refresh"],
      },
    ],
  });
  const registry = createSurfaceModuleRegistry([
    {
      moduleRef: "service-ui/service-surface-adapter@0.1.0",
      role: "serviceSurfaceAdapter",
      version: "0.1.0",
      primitiveRefs: ["runtime.intent"],
      implementation: { request: true },
    },
  ]);

  const posture = surfaceServiceSurfaceAdapterBindingPosture(registry, surfaceApp);

  assert.equal(posture.kind, "surface.adapter.binding.posture");
  assert.equal(posture.state, "ready");
  assert.equal(posture.role, "serviceSurfaceAdapter");
  assert.equal(posture.taxonomyKey, "serviceSurfaceAdapter");
  assert.deepEqual(posture.primitiveRefs, ["runtime.intent"]);
  assert.deepEqual(posture.evidenceChannels, ["runtime.intent", "adapter.evidence"]);
});

test("surface service edge adapter binding posture defaults to service edge primitive", () => {
  const surfaceApp = makeSurfaceApp({
    requiredModuleRoles: ["serviceEdgeAdapter"],
    modules: [
      {
        moduleRef: "service/service-edge-adapter@0.1.0",
        role: "serviceEdgeAdapter",
        participantSide: "service",
        fulfillmentMode: "nativeInstalled",
        version: "0.1.0",
        primitiveRefs: ["service.edge.adapter.posture"],
        evidenceChannels: ["service.admission"],
        materializationBudgetRefs: ["service-edge.responses"],
        releaseRefs: ["release:service-edge"],
      },
    ],
  });
  const registry = createSurfaceModuleRegistry([
    {
      moduleRef: "service/service-edge-adapter@0.1.0",
      role: "serviceEdgeAdapter",
      version: "0.1.0",
      primitiveRefs: ["service.edge.adapter.posture"],
      evidenceChannels: ["service.response", "projection.delta"],
      implementation: { admit: true },
    },
  ]);

  const posture = surfaceServiceEdgeAdapterBindingPosture(registry, surfaceApp);

  assert.equal(posture.kind, "surface.adapter.binding.posture");
  assert.equal(posture.state, "ready");
  assert.equal(posture.role, "serviceEdgeAdapter");
  assert.equal(posture.taxonomyKey, "serviceEdgeAdapter");
  assert.equal(posture.participantSide, "service");
  assert.deepEqual(posture.primitiveRefs, ["service.edge.adapter.posture"]);
  assert.deepEqual(posture.evidenceChannels, [
    "service.admission",
    "service.response",
    "projection.delta",
  ]);
  assert.deepEqual(posture.materializationBudgetRefs, ["service-edge.responses"]);
  assert.deepEqual(posture.releaseRefs, ["release:service-edge"]);
  assert.equal(posture.moduleBinding.implementation.admit, true);
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

test("surface module registry resolves runtime selection posture roles", () => {
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
  const surfaceApp = makeSurfaceApp();
  const posture = surfaceAppRuntimeSelectionPosture(makeManifest({
    requiredModuleRoles: ["runtimeClient", "platformAdapter", "productView"],
  }), [surfaceApp], {
    runtimeVersion: "0.1.0",
    issuedAt: 1234,
  });

  const bindings = surfaceAppModuleBindings(registry, posture);

  assert.equal(bindings.state, "ready");
  assert.deepEqual(bindings.roles, ["runtimeClient", "platformAdapter", "productView"]);
  assert.equal(bindings.byKey.platformAdapter.runtimeSelectionPosture, posture);
  assert.equal(bindings.byKey.platformAdapter.sourceMode, "bundled");
  assert.equal(bindings.byKey.platformAdapter.implementation.bind, true);
});

test("surface module registry blocks untrusted and unsupported remote module sources", () => {
  const registry = createSurfaceModuleRegistry([
    {
      moduleRef: "constitute-ui/media-webrtc-adapter@0.1.0",
      role: "platformAdapter",
      version: "0.1.0",
      implementation: { bind: true },
    },
  ]);
  const surfaceApp = makeSurfaceApp();
  const untrusted = surfaceAppRuntimeSelectionPosture(makeManifest({
    sourceMode: "swarmPackage",
    remoteSourceRefs: [],
    releaseContractRef: "release:nvr-ui:0.1.0",
    requiredModuleRoles: ["platformAdapter"],
  }), [surfaceApp], {
    runtimeVersion: "0.1.0",
    issuedAt: 1234,
  });
  const blockedTrust = surfaceModuleRegistryPosture(registry, untrusted, "platformAdapter");
  assert.equal(blockedTrust.state, "blocked");
  assert.equal(blockedTrust.blockedReason, "manifest:missingRemoteSourceRef");

  const trustedRemote = surfaceAppRuntimeSelectionPosture(makeManifest({
    sourceMode: "swarmPackage",
    remoteSourceRefs: ["storage-object:nvr-ui@0.1.0"],
    releaseContractRef: "release:nvr-ui:0.1.0",
    digestRefs: ["sha256:nvr-ui@0.1.0"],
    signatureRefs: ["sig:nvr-ui@0.1.0"],
    proofDigestRefs: ["proof-digest:nvr-ui@0.1.0"],
    rollbackRefs: ["rollback:nvr-ui:0.0.9"],
    secretBoundaryRefs: ["secret-boundary:nvr-ui"],
    trustRefs: ["trust:nvr-ui@0.1.0"],
    requiredModuleRoles: ["platformAdapter"],
  }), [surfaceApp], {
    runtimeVersion: "0.1.0",
    runnerPlanOptions: {
      releaseContractOptions: {
        buildRef: "build:nvr-ui:0.1.0",
        releaseRef: "release:nvr-ui:0.1.0",
        rollbackRef: "rollback:nvr-ui:0.0.9",
      },
    },
    issuedAt: 1234,
  });
  const unsupported = surfaceModuleRegistryPosture(registry, trustedRemote, "platformAdapter");
  assert.equal(trustedRemote.state, "ready");
  assert.equal(unsupported.state, "blocked");
  assert.equal(unsupported.blockedReason, "unsupportedRemoteModuleSource");
  assert.equal(unsupported.sourceMode, "swarmPackage");

  const allowed = surfaceModuleRegistryPosture(registry, trustedRemote, "platformAdapter", {
    allowRemote: true,
  });
  assert.equal(allowed.state, "ready");
  assert.equal(allowed.implementation.implementation.bind, true);
});

function makeManifest(overrides = {}) {
  const sourceMode = overrides.sourceMode || "bundled";
  return {
    kind: "surface.app.manifest",
    manifestId: "manifest:nvr-ui",
    appId: "constitute-nvr-ui",
    currentAppContractRef: "surface-app:nvr-ui",
    currentVersion: "0.1.0",
    defaultSourceMode: sourceMode,
    versions: [
      {
        appContractRef: "surface-app:nvr-ui",
        version: "0.1.0",
        state: "current",
        sourceMode,
        requiredModuleRoles: overrides.requiredModuleRoles || ["runtimeClient", "platformAdapter", "productView"],
        compatibilityWindow: {
          minVersion: "0.1.0",
          maxVersion: "0.1.x",
          protocolRef: "protocol:surface-app:v1",
        },
        bundledSourceRefs: ["bundle:nvr-ui@0.1.0"],
        remoteSourceRefs: overrides.remoteSourceRefs || [],
        releaseContractRef: overrides.releaseContractRef || "",
        runnerRequirementRefs: ["runner:req:nvr-ui"],
        serviceManagerRequirementRefs: ["service-manager:req:nvr-ui"],
      },
    ],
    requiredModuleRoles: overrides.requiredModuleRoles || ["runtimeClient", "platformAdapter", "productView"],
    bundledSourceRefs: ["bundle:nvr-ui@0.1.0"],
    issuedAt: 1234,
    ...overrides,
  };
}
