import {
  defineSurfaceAppContract,
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
  const surfaceApp = asSurfaceApp(surfaceAppOrContract);
  const roleRef = String(role || "");
  const rolePosture = surfaceModuleRolePosture(surfaceApp, roleRef, {
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

export function surfaceAppModuleImplementations(registry, surfaceAppOrContract, roles = []) {
  const surfaceApp = asSurfaceApp(surfaceAppOrContract);
  const selectedRoles = Array.isArray(roles) && roles.length
    ? roles.map((role) => String(role || "")).filter(Boolean)
    : surfaceApp.requiredRoles;
  const postures = selectedRoles.map((role) => surfaceModuleRegistryPosture(registry, surfaceApp, role));
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

function asSurfaceApp(surfaceAppOrContract) {
  if (surfaceAppOrContract?.contract && surfaceAppOrContract?.modulesByRole) return surfaceAppOrContract;
  return defineSurfaceAppContract(surfaceAppOrContract);
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item !== null && item !== undefined && item !== "")
    .map((item) => String(item));
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
