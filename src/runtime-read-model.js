import { projectionPostureSummary } from "./projection-read-model.js";
import { preparedServiceRegistry } from "./service-registry-model.js";
import {
  deriveRuntimeMaterializationPosture,
  deriveRuntimeShellState,
} from "./runtime-shell-state.js";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value) {
  return String(value || "").trim();
}

function number(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function bool(value) {
  return value === true;
}

function countObject(value) {
  return Object.keys(record(value)).length;
}

function summarizeBroker(snapshot) {
  const broker = record(snapshot.broker);
  return Object.freeze({
    state: text(broker.state || broker.status || (broker.available === true ? "available" : "")) || "unknown",
    available: bool(broker.available),
    reason: text(broker.reason),
    pendingCount: number(broker.pendingCount || broker.pending),
  });
}

function summarizeEdge(snapshot) {
  const edge = record(snapshot.edge);
  return Object.freeze({
    state: text(edge.state || edge.status || (edge.connected === true ? "connected" : "")) || "unknown",
    mode: text(edge.mode),
    connected: bool(edge.connected),
    reason: text(edge.reason || edge.error),
    endpointRef: text(edge.endpointRef || edge.endpoint || edge.url),
    memberRef: text(edge.memberRef),
  });
}

function summarizeAuthority(snapshot) {
  const authority = record(snapshot.authority);
  return Object.freeze({
    state: text(authority.state || (authority.ready === true ? "ready" : "")) || "unknown",
    ready: bool(authority.ready) || text(authority.state) === "ready",
    reason: text(authority.reason),
    devicePk: text(authority.devicePk),
  });
}

function summarizeResource(snapshot) {
  const resource = record(snapshot.resource);
  return Object.freeze({
    state: text(resource.state) || "unknown",
    reason: text(resource.reason),
    profileId: text(resource.profileId),
    cleanupAllowed: bool(resource.cleanupAllowed),
  });
}

function summarizeRetention(snapshot) {
  const retention = record(snapshot.retention);
  return Object.freeze({
    state: text(retention.state) || "unknown",
    reason: text(retention.reason),
    releaseRequired: retention.releaseRequired !== false,
    destructiveAction: bool(retention.destructiveAction),
  });
}

export function prepareRuntimeReadModel(snapshot = {}, options = {}) {
  const snap = record(snapshot);
  const now = number(options.now, Date.now());
  const observedAt = number(snap.observedAt || snap.updatedAt || snap.createdAt, 0);
  const materialization = deriveRuntimeMaterializationPosture(snap, options);
  const shell = deriveRuntimeShellState(snap, options);
  const serviceRegistry = preparedServiceRegistry(snap, options);
  const projection = projectionPostureSummary(snap);
  const snapshotPresent = countObject(snap) > 0;
  const ready = Boolean(
    snapshotPresent
      && (
        text(snap.buildId)
        || text(snap.runtimeSessionId)
        || serviceRegistry.serviceCount > 0
        || projection.projectionCount > 0
        || record(snap.broker).available === true
      ),
  );
  const blockedReasons = [];
  if (!snapshotPresent) blockedReasons.push("runtimeSnapshotMissing");
  if (materialization.blockedReasons.length) blockedReasons.push(...materialization.blockedReasons);

  return Object.freeze({
    kind: "runtime.surface.read-model",
    state: ready ? "ready" : "pending",
    ready,
    blockedReasons: Object.freeze(blockedReasons),
    buildId: text(snap.buildId),
    runtimeSessionId: text(snap.runtimeSessionId),
    updatedAt: observedAt,
    snapshotAgeMs: observedAt ? Math.max(0, now - observedAt) : 0,
    snapshotKeyCount: countObject(snap),
    shell,
    authority: summarizeAuthority(snap),
    broker: summarizeBroker(snap),
    edge: summarizeEdge(snap),
    serviceRegistry,
    projection,
    materialization,
    resource: summarizeResource(snap),
    retention: summarizeRetention(snap),
  });
}
