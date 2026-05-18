function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item !== null && item !== undefined && item !== "")
    .map((item) => String(item).trim())
    .filter(Boolean);
}

function uniqueStrings(value) {
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const text = String(item || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function firstString(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

export function serviceSurfaceAdapterPosture(bindingPosture = {}, options = {}) {
  const binding = normalizeObject(bindingPosture);
  const moduleBinding = normalizeObject(binding.moduleBinding);
  const moduleRef = firstString(options.moduleRef, binding.implementationRef, binding.moduleRef, moduleBinding.moduleRef);
  const blockedReasons = uniqueStrings([
    binding.blockedReason,
    ...normalizeStringArray(binding.blockedReasons),
    ...normalizeStringArray(options.blockedReasons),
    ...(moduleRef ? [] : ["missingServiceSurfaceAdapterModuleRef"]),
  ]);
  return Object.freeze({
    kind: "surface.serviceSurface.adapter.posture",
    state: blockedReasons.length ? "blocked" : firstString(binding.state, "ready"),
    blockedReason: blockedReasons[0] || "",
    blockedReasons: Object.freeze(blockedReasons),
    moduleRef,
    implementationRef: firstString(binding.implementationRef, moduleBinding.implementationRef),
    role: firstString(binding.role, "serviceSurfaceAdapter"),
    participantSide: firstString(binding.participantSide, "window"),
    primitiveRefs: Object.freeze(uniqueStrings([
      ...normalizeStringArray(binding.primitiveRefs),
      ...normalizeStringArray(options.primitiveRefs),
    ])),
    actionRefs: Object.freeze(uniqueStrings([
      ...normalizeStringArray(binding.actionRefs),
      ...normalizeStringArray(options.actionRefs),
    ])),
    projectionRefs: Object.freeze(uniqueStrings([
      ...normalizeStringArray(binding.projectionRefs),
      ...normalizeStringArray(options.projectionRefs),
    ])),
    materializationBudgetRefs: Object.freeze(uniqueStrings([
      ...normalizeStringArray(binding.materializationBudgetRefs),
      ...normalizeStringArray(options.materializationBudgetRefs),
    ])),
    releaseRefs: Object.freeze(uniqueStrings([
      ...normalizeStringArray(binding.releaseRefs),
      ...normalizeStringArray(options.releaseRefs),
    ])),
    lifecycle: Object.freeze({
      state: "surfaceMapping",
      ...normalizeObject(binding.lifecycle),
      ...normalizeObject(options.lifecycle),
    }),
    defaultTimeoutMs: Number(options.defaultTimeoutMs || 0),
    issuedAt: Number(options.issuedAt || Date.now()),
    expiresAt: options.expiresAt || binding.expiresAt,
  });
}

export function serviceSurfaceActionTimeoutMs(action, options = {}) {
  const actionTimeouts = normalizeObject(options.actionTimeoutMs);
  const timeout = Number(actionTimeouts[String(action || "")] || 0);
  return timeout > 0 ? timeout : Number(options.defaultTimeoutMs || 0);
}

export function normalizeServiceSurfaceAdapterError(error, fallback = "Service surface request is unavailable.") {
  const message = String(error?.message || error || fallback).trim();
  return message || fallback;
}

export function createServiceSurfaceAdapter(options = {}) {
  const posture = serviceSurfaceAdapterPosture(options.bindingPosture, options);
  const normalizeError = typeof options.normalizeError === "function"
    ? options.normalizeError
    : (error) => normalizeServiceSurfaceAdapterError(error);
  const publishRuntimeIntent = typeof options.publishRuntimeIntent === "function"
    ? options.publishRuntimeIntent
    : null;
  const projectionFallback = typeof options.projectionFallback === "function"
    ? options.projectionFallback
    : null;

  return Object.freeze({
    kind: "surface.serviceSurface.adapter",
    moduleRef: posture.moduleRef,
    posture,
    timeoutMs(action) {
      return serviceSurfaceActionTimeoutMs(action, options);
    },
    async request(action, payload = {}) {
      const actionRef = String(action || "").trim();
      if (!actionRef) throw new Error("service surface action is required");
      if (posture.state === "blocked") {
        throw new Error(posture.blockedReason || "service surface adapter blocked");
      }
      if (!publishRuntimeIntent) {
        throw new Error("service surface runtime intent publisher is unavailable");
      }
      try {
        await publishRuntimeIntent(actionRef, payload, serviceSurfaceActionTimeoutMs(actionRef, options));
        return projectionFallback ? projectionFallback(actionRef, payload, posture) : { action: actionRef, accepted: true };
      } catch (error) {
        throw new Error(normalizeError(error, { action: actionRef, payload, posture }));
      }
    },
  });
}
