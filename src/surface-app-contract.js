export const SURFACE_CONTRACT_ROLE_ORDER = Object.freeze([
  "runtimeClient",
  "projectionModel",
  "platformAdapter",
  "serviceSurfaceAdapter",
  "productView",
  "operatorHelper",
  "releaseHelper",
]);

export function defineSurfaceAppContract(contract, { validate } = {}) {
  const validated = typeof validate === "function" ? validate(contract) : contract;
  if (!isObject(validated)) throw new Error("surface app contract is required");

  const modules = normalizeModules(validated.modules);
  const requiredRoles = normalizeStringArray(validated.requiredModuleRoles);
  const modulesByRole = indexModulesByRole(modules);
  const missingRoles = requiredRoles.filter((role) => !modulesByRole[role]?.length);
  const posture = Object.freeze({
    state: missingRoles.length ? "blocked" : "ready",
    blockedReason: missingRoles.length ? "missingModuleRole" : "",
    missingRoles: Object.freeze([...missingRoles]),
    moduleCount: modules.length,
  });

  const surfaceApp = {
    contract: freezeContract(validated, modules, requiredRoles),
    modules,
    modulesByRole,
    requiredRoles: Object.freeze([...requiredRoles]),
    missingRoles: Object.freeze([...missingRoles]),
    posture,
    hasRole(role) {
      return Boolean(modulesByRole[String(role || "")]?.length);
    },
    moduleForRole(role) {
      return modulesByRole[String(role || "")]?.[0] || null;
    },
    modulesForRole(role) {
      return Object.freeze([...(modulesByRole[String(role || "")] || [])]);
    },
    attachContext(extra = {}) {
      return surfaceAppAttachContext(surfaceApp, extra);
    },
  };

  return Object.freeze(surfaceApp);
}

export function surfaceAppContractPosture(surfaceAppOrContract) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  return surfaceApp.posture;
}

export function surfaceAppAttachContext(surfaceAppOrContract, extra = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const contract = surfaceApp.contract;
  return Object.freeze({
    kind: "surface.app.attachContext",
    contractId: String(contract.contractId || ""),
    appId: String(contract.appId || ""),
    appRef: String(contract.appRef || ""),
    serviceRef: String(contract.serviceRef || ""),
    surfaceRef: String(contract.surfaceRef || ""),
    version: String(contract.version || ""),
    displayName: String(contract.displayName || ""),
    posture: surfaceApp.posture,
    requiredModuleRoles: Object.freeze([...surfaceApp.requiredRoles]),
    moduleRefs: Object.freeze(surfaceApp.modules.map((module) => Object.freeze({
      moduleRef: module.moduleRef,
      role: module.role,
      participantSide: module.participantSide,
      fulfillmentMode: module.fulfillmentMode,
      version: module.version,
      buildId: module.buildId || "",
    }))),
    updatePosture: isObject(contract.updatePosture) ? Object.freeze({ ...contract.updatePosture }) : undefined,
    ...extra,
  });
}

export function surfaceModuleRolePosture(surfaceAppOrContract, role, options = {}) {
  const surfaceApp = isDefinedSurfaceApp(surfaceAppOrContract)
    ? surfaceAppOrContract
    : defineSurfaceAppContract(surfaceAppOrContract);
  const roleRef = String(role || "");
  const moduleRef = String(options.moduleRef || "").trim();
  const primitiveRef = String(options.primitiveRef || "").trim();
  const modules = surfaceApp.modulesForRole(roleRef)
    .filter((module) => !moduleRef || String(module.moduleRef || "") === moduleRef)
    .filter((module) => !primitiveRef || module.primitiveRefs.includes(primitiveRef));
  const state = modules.length ? "ready" : "blocked";
  return Object.freeze({
    kind: "surface.module.role.posture",
    state,
    blockedReason: state === "ready" ? "" : surfaceModuleBlockedReason(surfaceApp, roleRef, moduleRef, primitiveRef),
    role: roleRef,
    moduleRef,
    primitiveRef,
    moduleCount: modules.length,
    modules: Object.freeze([...modules]),
  });
}

export function requireSurfaceModuleRole(surfaceAppOrContract, role, options = {}) {
  const posture = surfaceModuleRolePosture(surfaceAppOrContract, role, options);
  if (posture.state !== "ready") {
    const detail = [posture.blockedReason, posture.role, posture.moduleRef, posture.primitiveRef]
      .filter(Boolean)
      .join(" ");
    throw new Error(`surface module role unavailable: ${detail}`.trim());
  }
  return posture.modules[0];
}

function normalizeModules(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(value
    .filter(isObject)
    .map((module) => Object.freeze({
      ...module,
      primitiveRefs: Object.freeze(normalizeStringArray(module.primitiveRefs)),
      requiredCapabilities: Object.freeze(normalizeStringArray(module.requiredCapabilities)),
      inputs: Object.freeze(normalizeStringArray(module.inputs)),
      outputs: Object.freeze(normalizeStringArray(module.outputs)),
      fallbackRefs: Object.freeze(normalizeStringArray(module.fallbackRefs)),
    })));
}

function indexModulesByRole(modules) {
  const index = {};
  for (const role of SURFACE_CONTRACT_ROLE_ORDER) index[role] = [];
  for (const module of modules) {
    const role = String(module.role || "");
    if (!role) continue;
    if (!index[role]) index[role] = [];
    index[role].push(module);
  }
  for (const [role, roleModules] of Object.entries(index)) {
    index[role] = Object.freeze([...roleModules]);
  }
  return Object.freeze(index);
}

function freezeContract(contract, modules, requiredRoles) {
  return Object.freeze({
    ...contract,
    requiredPrimitives: Object.freeze(normalizeStringArray(contract.requiredPrimitives)),
    requiredModuleRoles: Object.freeze([...requiredRoles]),
    modules,
    projectionSubscriptions: Object.freeze(normalizeArray(contract.projectionSubscriptions)),
    permissionRequirements: Object.freeze(normalizeArray(contract.permissionRequirements)),
    capabilityRequirements: Object.freeze(normalizeArray(contract.capabilityRequirements)),
    materializationBudgets: Object.freeze(normalizeArray(contract.materializationBudgets)),
  });
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item !== null && item !== undefined && item !== "")
    .map((item) => String(item));
}

function normalizeArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

function surfaceModuleBlockedReason(surfaceApp, role, moduleRef, primitiveRef) {
  if (!role) return "missingRole";
  if (!surfaceApp.hasRole(role)) return "missingModuleRole";
  if (moduleRef) return "missingModuleRef";
  if (primitiveRef) return "missingPrimitiveRef";
  return "missingModule";
}

function isDefinedSurfaceApp(value) {
  return Boolean(value && typeof value === "object" && value.contract && value.modulesByRole && value.posture);
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
