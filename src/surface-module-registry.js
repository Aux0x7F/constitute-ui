import {
  defineSurfaceAppContract,
  surfaceModuleTaxonomyPosture,
  surfaceModuleRolePosture,
} from "./surface-app-contract.js";

export function createSurfaceModuleRegistry(entries = []) {
  const modules = normalizeRegistryEntries(entries);
  const byRef = new Map();
  const byRole = new Map();

  for (const entry of modules) {
    byRef.set(entry.moduleRef, entry);
    if (!byRole.has(entry.role)) byRole.set(entry.role, []);
    byRole.get(entry.role).push(entry);
  }

  const registry = {
    kind: "surface.module.registry",
    entries: Object.freeze([...modules]),
    has(moduleRef) {
      return byRef.has(String(moduleRef || ""));
    },
    get(moduleRef) {
      return byRef.get(String(moduleRef || "")) || null;
    },
    role(role) {
      return Object.freeze([...(byRole.get(String(role || "")) || [])]);
    },
    resolve(surfaceAppOrContract, role, options = {}) {
      return surfaceModuleRegistryPosture(registry, surfaceAppOrContract, role, options);
    },
    require(surfaceAppOrContract, role, options = {}) {
      return requireSurfaceModuleImplementation(registry, surfaceAppOrContract, role, options);
    },
  };

  return Object.freeze(registry);
}

export function surfaceModuleRegistryPosture(registry, surfaceAppOrContract, role, options = {}) {
  const resolutionSource = surfaceModuleResolutionSource(surfaceAppOrContract);
  const surfaceApp = resolutionSource.surfaceApp;
  const roleRef = String(role || "");
  const blockedSourceReason = sourceBlockedReason(resolutionSource, options);
  if (blockedSourceReason || !surfaceApp) {
    return Object.freeze({
      kind: "surface.module.registry.posture",
      state: "blocked",
      blockedReason: blockedSourceReason || "missingBundledContract",
      role: roleRef,
      moduleRef: String(options.moduleRef || ""),
      implementationRef: "",
      fallbackRefs: Object.freeze([]),
      fallbackTried: Object.freeze([]),
      sourceMode: resolutionSource.sourceMode,
      sourcePosture: resolutionSource.sourcePosture,
      runtimeSelectionPosture: resolutionSource.runtimeSelectionPosture,
      claim: null,
      implementation: null,
    });
  }

  const rolePosture = resolutionRolePosture(resolutionSource, roleRef, {
    moduleRef: options.moduleRef,
    primitiveRef: options.primitiveRef,
  });

  if (rolePosture.state !== "ready") {
    return Object.freeze({
      kind: "surface.module.registry.posture",
      state: "blocked",
      blockedReason: rolePosture.blockedReason,
      role: roleRef,
      moduleRef: String(options.moduleRef || ""),
      implementationRef: "",
      fallbackRefs: Object.freeze([]),
      fallbackTried: Object.freeze([]),
      sourceMode: resolutionSource.sourceMode,
      sourcePosture: resolutionSource.sourcePosture,
      runtimeSelectionPosture: resolutionSource.runtimeSelectionPosture,
      claim: null,
      implementation: null,
    });
  }

  const claim = rolePosture.modules[0];
  const fallbackRefs = claim.fallbackRefs || [];
  const candidates = [claim.moduleRef, ...fallbackRefs].filter(Boolean);
  const fallbackTried = [];
  for (const moduleRef of candidates) {
    const implementation = registry?.get?.(moduleRef) || null;
    fallbackTried.push(moduleRef);
    if (!implementation) continue;
    if (implementation.role && implementation.role !== roleRef) continue;
    return Object.freeze({
      kind: "surface.module.registry.posture",
      state: "ready",
      blockedReason: "",
      role: roleRef,
      moduleRef: claim.moduleRef,
      implementationRef: implementation.moduleRef,
      fallbackRefs: Object.freeze([...fallbackRefs]),
      fallbackTried: Object.freeze([...fallbackTried]),
      sourceMode: resolutionSource.sourceMode,
      sourcePosture: resolutionSource.sourcePosture,
      runtimeSelectionPosture: resolutionSource.runtimeSelectionPosture,
      claim,
      implementation,
    });
  }

  return Object.freeze({
    kind: "surface.module.registry.posture",
    state: "blocked",
    blockedReason: "missingModuleImplementation",
    role: roleRef,
    moduleRef: claim.moduleRef,
    implementationRef: "",
    fallbackRefs: Object.freeze([...fallbackRefs]),
    fallbackTried: Object.freeze([...fallbackTried]),
    sourceMode: resolutionSource.sourceMode,
    sourcePosture: resolutionSource.sourcePosture,
    runtimeSelectionPosture: resolutionSource.runtimeSelectionPosture,
    claim,
    implementation: null,
  });
}

export function requireSurfaceModuleImplementation(registry, surfaceAppOrContract, role, options = {}) {
  const posture = surfaceModuleRegistryPosture(registry, surfaceAppOrContract, role, options);
  if (posture.state !== "ready") {
    const detail = [posture.blockedReason, posture.role, posture.moduleRef]
      .filter(Boolean)
      .join(" ");
    throw new Error(`surface module implementation unavailable: ${detail}`.trim());
  }
  return posture.implementation;
}

export function surfaceModuleBinding(registry, surfaceAppOrContract, role, options = {}) {
  const posture = surfaceModuleRegistryPosture(registry, surfaceAppOrContract, role, options);
  const claim = posture.claim || {};
  const implementationRecord = posture.implementation || {};
  const implementation = posture.state === "ready" ? implementationRecord.implementation : null;
  return Object.freeze({
    kind: "surface.module.binding",
    state: posture.state,
    blockedReason: posture.blockedReason,
    role: posture.role,
    moduleRef: posture.moduleRef,
    implementationRef: posture.implementationRef,
    version: String(claim.version || implementationRecord.version || ""),
    participantSide: String(claim.participantSide || ""),
    fulfillmentMode: String(claim.fulfillmentMode || ""),
    primitiveRefs: Object.freeze(uniqueStrings([
      ...normalizeStringArray(claim.primitiveRefs),
      ...normalizeStringArray(implementationRecord.primitiveRefs),
    ])),
    requiredCapabilities: Object.freeze(uniqueStrings([
      ...normalizeStringArray(claim.requiredCapabilities),
      ...normalizeStringArray(implementationRecord.requiredCapabilities),
    ])),
    inputs: Object.freeze(normalizeStringArray(claim.inputs)),
    outputs: Object.freeze(normalizeStringArray(claim.outputs)),
    fallbackRefs: posture.fallbackRefs,
    fallbackTried: posture.fallbackTried,
    sourceMode: posture.sourceMode || "",
    sourcePosture: posture.sourcePosture || null,
    runtimeSelectionPosture: posture.runtimeSelectionPosture || null,
    claim: posture.claim,
    implementationRecord: posture.implementation,
    implementation,
  });
}

export function surfaceAdapterBindingPosture(registry, surfaceAppOrContract, options = {}) {
  const role = String(options.role || "platformAdapter").trim();
  const binding = surfaceModuleBinding(registry, surfaceAppOrContract, role, options);
  const claim = binding.claim || {};
  const implementationRecord = binding.implementationRecord || {};
  const taxonomyRole = surfaceAdapterTaxonomyRolePosture(surfaceAppOrContract, role, options);
  const blockedReasons = uniqueStrings([
    binding.blockedReason,
    ...normalizeStringArray(taxonomyRole?.blockedReasons),
    ...normalizeStringArray(options.blockedReasons),
  ]);
  const state = binding.state === "ready" && blockedReasons.length === 0 ? "ready" : "blocked";
  const materializationBudgetRefs = uniqueStrings([
    ...normalizeStringArray(taxonomyRole?.materializationBudgetRefs),
    ...normalizeStringArray(claim.materializationBudgetRefs),
    ...normalizeStringArray(implementationRecord.materializationBudgetRefs),
    ...normalizeStringArray(options.materializationBudgetRefs),
  ]);
  const releaseRefs = uniqueStrings([
    ...normalizeStringArray(taxonomyRole?.releaseRefs),
    ...normalizeStringArray(claim.releaseRefs),
    claim.releaseRef,
    implementationRecord.releaseRef,
    ...normalizeStringArray(implementationRecord.releaseRefs),
    ...normalizeStringArray(options.releaseRefs),
  ]);
  const transportProfileRefs = uniqueStrings([
    claim.transportProfileRef,
    implementationRecord.transportProfileRef,
    ...normalizeStringArray(claim.transportProfileRefs),
    ...normalizeStringArray(implementationRecord.transportProfileRefs),
    ...normalizeStringArray(options.transportProfileRefs),
  ]);
  const renderEvidenceBudgetRef = String(
    options.renderEvidenceBudgetRef
      || claim.renderEvidenceBudgetRef
      || implementationRecord.renderEvidenceBudgetRef
      || materializationBudgetRefs.find((ref) => String(ref).includes("render"))
      || "",
  ).trim();

  return Object.freeze({
    kind: "surface.adapter.binding.posture",
    state,
    blockedReason: blockedReasons[0] || "",
    blockedReasons: Object.freeze(blockedReasons),
    role: binding.role,
    taxonomyKey: String(taxonomyRole?.taxonomyKey || binding.role || ""),
    moduleRef: binding.moduleRef,
    implementationRef: binding.implementationRef,
    version: binding.version,
    participantSide: binding.participantSide,
    fulfillmentMode: binding.fulfillmentMode,
    primitiveRefs: binding.primitiveRefs,
    requiredCapabilities: binding.requiredCapabilities,
    evidenceChannels: Object.freeze(uniqueStrings([
      ...normalizeStringArray(taxonomyRole?.evidenceChannels),
      ...normalizeStringArray(claim.evidenceChannels),
      ...normalizeStringArray(implementationRecord.evidenceChannels),
      ...normalizeStringArray(options.evidenceChannels),
    ])),
    lifecycle: Object.freeze({
      ...(isObject(taxonomyRole?.lifecycle) ? taxonomyRole.lifecycle : {}),
      ...(isObject(claim.lifecycle) ? claim.lifecycle : {}),
      ...(isObject(implementationRecord.lifecycle) ? implementationRecord.lifecycle : {}),
      ...(isObject(options.lifecycle) ? options.lifecycle : {}),
    }),
    transportProfileRefs: Object.freeze(transportProfileRefs),
    renderEvidenceBudgetRef,
    materializationBudgetRefs: Object.freeze(materializationBudgetRefs),
    releaseRefs: Object.freeze(releaseRefs),
    sourceMode: binding.sourceMode,
    sourcePosture: binding.sourcePosture,
    runtimeSelectionPosture: binding.runtimeSelectionPosture,
    moduleBinding: binding,
  });
}

export function surfacePlatformAdapterBindingPosture(registry, surfaceAppOrContract, options = {}) {
  return surfaceAdapterBindingPosture(registry, surfaceAppOrContract, {
    primitiveRef: "media.transport.path",
    ...options,
    role: options.role || "platformAdapter",
  });
}

export function surfaceServiceSurfaceAdapterBindingPosture(registry, surfaceAppOrContract, options = {}) {
  return surfaceAdapterBindingPosture(registry, surfaceAppOrContract, {
    primitiveRef: "runtime.intent",
    ...options,
    role: options.role || "serviceSurfaceAdapter",
  });
}

export function surfaceServiceEdgeAdapterBindingPosture(registry, surfaceAppOrContract, options = {}) {
  return surfaceAdapterBindingPosture(registry, surfaceAppOrContract, {
    primitiveRef: "service.edge.adapter.posture",
    ...options,
    allowRemote: options.allowRemote ?? true,
    role: options.role || "serviceEdgeAdapter",
  });
}

export function requireSurfaceModuleBinding(registry, surfaceAppOrContract, role, options = {}) {
  const binding = surfaceModuleBinding(registry, surfaceAppOrContract, role, options);
  if (binding.state !== "ready" || !binding.implementation) {
    const detail = [binding.blockedReason, binding.role, binding.moduleRef]
      .filter(Boolean)
      .join(" ");
    throw new Error(`surface module binding unavailable: ${detail}`.trim());
  }
  return binding;
}

export function surfaceAppModuleBindings(registry, surfaceAppOrContract, roleMapOrRoles = []) {
  const resolutionSource = surfaceModuleResolutionSource(surfaceAppOrContract);
  const entries = normalizeRoleEntries(resolutionSource, roleMapOrRoles);
  const bindings = entries.map(({ key, role, options }) => {
    const binding = surfaceModuleBinding(registry, surfaceAppOrContract, role, options);
    return Object.freeze({ key, ...binding });
  });
  const blocked = bindings.filter((binding) => binding.state !== "ready");
  const byKey = {};
  const byRole = {};
  for (const binding of bindings) {
    byKey[binding.key] = binding;
    if (!byRole[binding.role]) byRole[binding.role] = [];
    byRole[binding.role].push(binding);
  }
  for (const roleKey of Object.keys(byRole)) byRole[roleKey] = Object.freeze([...byRole[roleKey]]);
  return Object.freeze({
    kind: "surface.app.module.bindings",
    state: blocked.length ? "blocked" : "ready",
    blockedReason: blocked.length ? "missingModuleBinding" : "",
    roles: Object.freeze(entries.map((entry) => entry.role)),
    keys: Object.freeze(entries.map((entry) => entry.key)),
    bindings: Object.freeze(bindings),
    postures: Object.freeze(bindings),
    byKey: Object.freeze(byKey),
    byRole: Object.freeze(byRole),
    implementations: Object.freeze(bindings
      .filter((binding) => binding.state === "ready")
      .map((binding) => binding.implementation)),
    blockedReasons: Object.freeze(blocked.map((binding) => binding.blockedReason).filter(Boolean)),
  });
}

export function surfaceAppModuleImplementations(registry, surfaceAppOrContract, roles = []) {
  const resolutionSource = surfaceModuleResolutionSource(surfaceAppOrContract);
  const selectedRoles = Array.isArray(roles) && roles.length
    ? roles.map((role) => String(role || "")).filter(Boolean)
    : resolutionSource.requiredRoles;
  const postures = selectedRoles.map((role) => surfaceModuleRegistryPosture(registry, surfaceAppOrContract, role));
  const blocked = postures.filter((posture) => posture.state !== "ready");
  return Object.freeze({
    kind: "surface.app.module.implementations",
    state: blocked.length ? "blocked" : "ready",
    blockedReason: blocked.length ? "missingModuleImplementation" : "",
    roles: Object.freeze([...selectedRoles]),
    postures: Object.freeze(postures),
    implementations: Object.freeze(postures
      .filter((posture) => posture.state === "ready")
      .map((posture) => posture.implementation)),
  });
}

function normalizeRegistryEntries(entries) {
  if (!Array.isArray(entries)) return Object.freeze([]);
  return Object.freeze(entries
    .filter(isObject)
    .map((entry) => Object.freeze({
      ...entry,
      moduleRef: String(entry.moduleRef || "").trim(),
      role: String(entry.role || "").trim(),
      version: String(entry.version || "").trim(),
      primitiveRefs: Object.freeze(normalizeStringArray(entry.primitiveRefs)),
      requiredCapabilities: Object.freeze(normalizeStringArray(entry.requiredCapabilities)),
    }))
    .filter((entry) => entry.moduleRef && entry.role));
}

function normalizeRoleEntries(resolutionSource, roleMapOrRoles) {
  if (Array.isArray(roleMapOrRoles) && roleMapOrRoles.length) {
    return roleMapOrRoles
      .map((role) => ({ key: String(role || ""), role: String(role || ""), options: {} }))
      .filter((entry) => entry.role);
  }
  if (isObject(roleMapOrRoles) && Object.keys(roleMapOrRoles).length) {
    return Object.entries(roleMapOrRoles)
      .map(([key, value]) => {
        if (isObject(value)) {
          return {
            key: String(key || ""),
            role: String(value.role || value.moduleRole || ""),
            options: isObject(value.options) ? value.options : {},
          };
        }
        return { key: String(key || ""), role: String(value || ""), options: {} };
      })
      .filter((entry) => entry.key && entry.role);
  }
  return resolutionSource.requiredRoles.map((role) => ({ key: role, role, options: {} }));
}

function asSurfaceApp(surfaceAppOrContract) {
  if (surfaceAppOrContract?.contract && surfaceAppOrContract?.modulesByRole) return surfaceAppOrContract;
  return defineSurfaceAppContract(surfaceAppOrContract);
}

function surfaceModuleResolutionSource(surfaceAppOrContract) {
  const runtimeSelectionPosture = isRuntimeSelectionPosture(surfaceAppOrContract)
    ? surfaceAppOrContract
    : null;
  const surfaceApp = runtimeSelectionPosture
    ? runtimeSelectionPosture.manifestSelection?.surfaceApp || null
    : asSurfaceApp(surfaceAppOrContract);
  const sourceMode = String(runtimeSelectionPosture?.sourceMode || dominantFulfillmentMode(surfaceApp?.modules) || "bundled");
  const sourcePosture = runtimeSelectionPosture?.sourceTrustResult || Object.freeze({
    kind: "surface.app.runtime.source.trust.result",
    state: "ready",
    sourceMode,
    sourceRefs: Object.freeze([]),
    releaseContractRef: "",
    bundled: !nonBundledSourceMode(sourceMode),
    blockedReasons: Object.freeze([]),
  });
  const requiredRoles = uniqueStrings([
    ...normalizeStringArray(runtimeSelectionPosture?.requiredModuleRoles),
    ...normalizeStringArray(surfaceApp?.requiredRoles),
  ]);
  return Object.freeze({
    runtimeSelectionPosture,
    surfaceApp,
    sourceMode,
    sourcePosture,
    requiredRoles: Object.freeze(requiredRoles),
  });
}

function resolutionRolePosture(resolutionSource, role, options = {}) {
  if (!resolutionSource.runtimeSelectionPosture || options.moduleRef || options.primitiveRef) {
    return surfaceModuleRolePosture(resolutionSource.surfaceApp, role, options);
  }
  const posture = (resolutionSource.runtimeSelectionPosture.modulePostures || [])
    .find((entry) => String(entry?.role || "") === String(role || ""));
  return posture || surfaceModuleRolePosture(resolutionSource.surfaceApp, role, options);
}

function sourceBlockedReason(resolutionSource, options = {}) {
  const selection = resolutionSource.runtimeSelectionPosture;
  const sourcePosture = resolutionSource.sourcePosture || {};
  const sourceMode = String(resolutionSource.sourceMode || "");
  if (selection?.state === "blocked") {
    return firstReason(selection.blockedReasons, "runtimeSelectionBlocked");
  }
  if (sourcePosture.state === "blocked") {
    return nonBundledSourceMode(sourceMode)
      ? firstReason(sourcePosture.blockedReasons, "remoteSourceUntrusted")
      : firstReason(sourcePosture.blockedReasons, "sourceUntrusted");
  }
  if (nonBundledSourceMode(sourceMode) && options.allowRemote !== true) {
    return "unsupportedRemoteModuleSource";
  }
  return "";
}

function isRuntimeSelectionPosture(value) {
  return Boolean(value && typeof value === "object" && value.kind === "surface.app.runtime.selection.posture");
}

function surfaceAdapterTaxonomyRolePosture(surfaceAppOrContract, role, options = {}) {
  const source = isRuntimeSelectionPosture(surfaceAppOrContract)
    ? (surfaceAppOrContract.manifestSelection?.surfaceApp || surfaceAppOrContract.manifestSelection?.contract || null)
    : surfaceAppOrContract;
  if (!source) return null;
  try {
    const posture = surfaceModuleTaxonomyPosture(source, options);
    return posture.byRole?.[String(role || "")] || null;
  } catch {
    return null;
  }
}

function firstReason(value, fallback) {
  const reasons = normalizeStringArray(value);
  return reasons[0] || fallback;
}

function nonBundledSourceMode(sourceMode) {
  return ["swarmPackage", "storageObject", "nativeInstalled"].includes(String(sourceMode || ""));
}

function dominantFulfillmentMode(modules) {
  if (!Array.isArray(modules)) return "";
  const counts = new Map();
  for (const module of modules) {
    const mode = String(module?.fulfillmentMode || "").trim();
    if (!mode) continue;
    counts.set(mode, (counts.get(mode) || 0) + 1);
  }
  let best = "";
  let bestCount = -1;
  for (const [mode, count] of counts.entries()) {
    if (count > bestCount) {
      best = mode;
      bestCount = count;
    }
  }
  return best;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item !== null && item !== undefined && item !== "")
    .map((item) => String(item));
}

function uniqueStrings(value) {
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const normalized = String(item || "").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
