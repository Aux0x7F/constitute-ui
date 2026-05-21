import { deriveRuntimeMaterializationPosture } from "./runtime-shell-state.js";

function normalizedArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value) {
  return String(value || "").trim();
}

function titleCaseWords(value) {
  return text(value)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeServiceRecord(entry, source) {
  const service = text(entry.service || entry.slug || entry.name).toLowerCase();
  const servicePk = text(entry.servicePk || entry.service_pk || entry.devicePk || entry.device_pk || entry.pk);
  const hostGatewayPk = text(entry.hostGatewayPk || entry.host_gateway_pk || entry.gatewayPk || entry.gateway_pk);
  const health = normalizeObject(entry.health || entry.surface?.health);
  const label = text(entry.label || entry.displayName || entry.surface?.displayName || entry.surface?.display?.name || titleCaseWords(service));
  return {
    ...entry,
    service,
    servicePk,
    devicePk: servicePk,
    pk: servicePk,
    hostGatewayPk,
    label,
    status: text(health.status || health.state || entry.status),
    health,
    __registrySource: source,
  };
}

export function preparedServiceRegistry(snapshot = {}, options = {}) {
  const catalog = normalizeObject(snapshot.serviceCatalog);
  const registry = normalizeObject(catalog.registry);
  const registryServices = normalizedArray(registry.services);
  const catalogServices = normalizedArray(catalog.services);
  const source = registryServices.length || registry.kind === "service.registry.materialization"
    ? "serviceRegistry"
    : "serviceCatalog";
  const services = (source === "serviceRegistry" ? registryServices : catalogServices)
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => normalizeServiceRecord(entry, source))
    .filter((entry) => entry.service && entry.servicePk);
  const blockedReasons = normalizedArray(registry.blockedReasons).map(text).filter(Boolean);
  const state = text(registry.state)
    || (blockedReasons.length ? "blocked" : services.length ? "ready" : "missing");
  const updatedAt = Number(registry.issuedAt || catalog.updatedAt || snapshot.updatedAt || 0) || 0;
  const materializationPosture = deriveRuntimeMaterializationPosture(snapshot, {
    clientId: text(options.clientId || "service-registry"),
    surface: text(options.surface || "service-registry"),
    materializationBudget: options.materializationBudget,
    consumerFloor: options.consumerFloor,
  });
  return Object.freeze({
    source,
    state,
    registryId: text(registry.registryId || catalog.registryId),
    updatedAt,
    serviceCount: services.length,
    claimCount: normalizedArray(registry.claimRefs).length,
    participantCount: normalizedArray(registry.participantRefs).length,
    entryCount: normalizedArray(registry.entries).length,
    blockedReasons: Object.freeze(blockedReasons),
    materializationPosture,
    services: Object.freeze(services.map((service) => Object.freeze(service))),
  });
}

export function preparedServiceRegistryServices(snapshot = {}, options = {}) {
  return preparedServiceRegistry(snapshot, options).services;
}
