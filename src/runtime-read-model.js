import { projectionPostureSummary } from "./projection-read-model.js";
import { preparedServiceRegistry } from "./service-registry-model.js";
import {
  deriveRuntimeMaterializationPosture,
  deriveRuntimeShellState,
} from "./runtime-shell-state.js";
import {
  FABRIC,
  SWARM,
  assertCarrierEdgeSessionEvidence,
  assertContractTarget,
  assertContractTargetRegistryPosture,
  assertHostFabricFulfillmentPlan,
  assertHostFabricMemberContribution,
  assertLifecyclePlanPosture,
} from "../../constitute-protocol/src/index.js";

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

function summarizeCarrierEdge(snapshot) {
  const edge = record(snapshot.edge);
  const carrierEdge = record(
    edge.carrierEdge
      || edge.carrierEdgeSessionEvidence
      || snapshot.carrierEdge
      || snapshot.carrierEdgeSessionEvidence,
  );
  if (countObject(carrierEdge) === 0) {
    return Object.freeze({
      present: false,
      state: "unknown",
      connectionState: "unknown",
      adapterRef: "",
      adapterKind: "",
      participantRef: "",
      edgeSessionRef: "",
      backpressureState: "unknown",
      blockedReasons: Object.freeze([]),
      validationErrors: Object.freeze([]),
      observedAt: 0,
      expiresAt: 0,
    });
  }
  const validationErrors = [];
  if (carrierEdge.kind || carrierEdge.evidenceId) {
    try {
      assertCarrierEdgeSessionEvidence(carrierEdge);
    } catch (error) {
      validationErrors.push(String(error?.message || error || "invalid carrier edge evidence"));
    }
  }
  return Object.freeze({
    present: true,
    state: text(carrierEdge.state) || "unknown",
    connectionState: text(carrierEdge.connectionState) || "unknown",
    adapterRef: text(carrierEdge.adapterRef),
    adapterKind: text(carrierEdge.adapterKind),
    participantRef: text(carrierEdge.participantRef),
    edgeSessionRef: text(carrierEdge.edgeSessionRef),
    backpressureState: text(carrierEdge.backpressureState) || "unknown",
    blockedReasons: Object.freeze(textArray(carrierEdge.blockedReasons)),
    validationErrors: Object.freeze(validationErrors),
    observedAt: number(carrierEdge.observedAt),
    expiresAt: number(carrierEdge.expiresAt),
  });
}

function summarizeEdge(snapshot) {
  const edge = record(snapshot.edge);
  const carrierEdge = summarizeCarrierEdge(snapshot);
  const connected = bool(edge.connected)
    || carrierEdge.state === SWARM.CARRIER_EDGE_SESSION_STATE.OPEN
    || carrierEdge.connectionState === "connected";
  const state = carrierEdge.present && carrierEdge.state !== "unknown"
    ? carrierEdge.state
    : text(edge.state || edge.status || (connected ? "connected" : "")) || "unknown";
  const endpointRef = text(edge.endpointRef)
    || (text(edge.endpoint) ? "edge-endpoint:runtime-swarm-edge" : "");
  return Object.freeze({
    state,
    mode: text(edge.mode || record(edge.carrierEdge)?.safeFacts?.mode || record(edge.carrierEdgeSessionEvidence)?.safeFacts?.mode),
    connected,
    reason: text(edge.reason || edge.error || carrierEdge.blockedReasons[0]),
    endpointRef,
    memberRef: text(edge.memberRef || carrierEdge.participantRef),
    carrierEdge,
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

function array(value) {
  return Array.isArray(value) ? value : [];
}

function textArray(value) {
  return array(value)
    .map((item) => text(item))
    .filter(Boolean);
}

function collectRuntimeTargetRecords(snapshot) {
  const containers = [
    snapshot,
    record(snapshot.serviceManager),
    record(snapshot.serviceManagerState),
    record(snapshot.manager),
    record(snapshot.fabric),
    record(snapshot.targetSource),
    record(snapshot.targetPosture),
  ];
  const targets = [];
  const registries = [];
  for (const container of containers) {
    for (const candidate of array(container.contractTargets)) targets.push(candidate);
    for (const candidate of array(container.targets)) targets.push(candidate);
    if (container.contractTarget) targets.push(container.contractTarget);
    if (container.target && record(container.target).kind === SWARM.RECORD_KIND.CONTRACT_TARGET) {
      targets.push(container.target);
    }
    for (const candidate of array(container.targetRegistryPostures)) registries.push(candidate);
    for (const candidate of array(container.targetRegistries)) registries.push(candidate);
    if (container.targetRegistryPosture) registries.push(container.targetRegistryPosture);
    if (container.registry && record(container.registry).kind === SWARM.RECORD_KIND.CONTRACT_TARGET_REGISTRY_POSTURE) {
      registries.push(container.registry);
    }
  }
  return { targets, registries };
}

function collectRuntimeFabricRecords(snapshot) {
  const containers = [
    snapshot,
    record(snapshot.serviceManager),
    record(snapshot.serviceManagerState),
    record(snapshot.manager),
    record(snapshot.fabric),
    record(snapshot.targetSource),
    record(snapshot.targetPosture),
  ];
  const plans = [];
  const contributions = [];
  const lifecyclePlans = [];
  for (const container of containers) {
    for (const candidate of array(container.hostFabricFulfillmentPlans)) plans.push(candidate);
    for (const candidate of array(container.fabricFulfillmentPlans)) plans.push(candidate);
    for (const candidate of array(container.fulfillmentPlans)) plans.push(candidate);
    if (container.hostFabricFulfillmentPlan) plans.push(container.hostFabricFulfillmentPlan);
    if (container.fulfillmentPlan && record(container.fulfillmentPlan).kind === SWARM.RECORD_KIND.HOST_FABRIC_FULFILLMENT_PLAN) {
      plans.push(container.fulfillmentPlan);
    }

    for (const candidate of array(container.hostFabricContributions)) contributions.push(candidate);
    for (const candidate of array(container.hostFabricMemberContributions)) contributions.push(candidate);
    for (const candidate of array(container.memberContributions)) contributions.push(candidate);
    if (container.hostFabricContribution) contributions.push(container.hostFabricContribution);
    if (container.memberContribution && record(container.memberContribution).kind === SWARM.RECORD_KIND.HOST_FABRIC_MEMBER_CONTRIBUTION) {
      contributions.push(container.memberContribution);
    }

    for (const candidate of array(container.lifecyclePlans)) lifecyclePlans.push(candidate);
    if (container.lifecyclePlan) lifecyclePlans.push(container.lifecyclePlan);
  }
  return { plans, contributions, lifecyclePlans };
}

function validateRuntimeTargetRecords(snapshot) {
  const { targets: rawTargets, registries: rawRegistries } = collectRuntimeTargetRecords(snapshot);
  const errors = [];
  const targets = [];
  const registries = [];
  for (const candidate of rawTargets) {
    if (record(candidate).kind && record(candidate).kind !== SWARM.RECORD_KIND.CONTRACT_TARGET) continue;
    try {
      targets.push(assertContractTarget(candidate));
    } catch (error) {
      errors.push(text(error?.message || error || "invalid contract target"));
    }
  }
  for (const candidate of rawRegistries) {
    if (record(candidate).kind && record(candidate).kind !== SWARM.RECORD_KIND.CONTRACT_TARGET_REGISTRY_POSTURE) continue;
    try {
      registries.push(assertContractTargetRegistryPosture(candidate));
    } catch (error) {
      errors.push(text(error?.message || error || "invalid contract target registry posture"));
    }
  }
  return { targets, registries, errors };
}

function validateRuntimeFabricRecords(snapshot) {
  const {
    plans: rawPlans,
    contributions: rawContributions,
    lifecyclePlans: rawLifecyclePlans,
  } = collectRuntimeFabricRecords(snapshot);
  const errors = [];
  const plans = [];
  const contributions = [];
  const lifecyclePlans = [];
  for (const candidate of rawPlans) {
    if (record(candidate).kind && record(candidate).kind !== SWARM.RECORD_KIND.HOST_FABRIC_FULFILLMENT_PLAN) continue;
    try {
      plans.push(assertHostFabricFulfillmentPlan(candidate));
    } catch (error) {
      errors.push(text(error?.message || error || "invalid host-fabric fulfillment plan"));
    }
  }
  for (const candidate of rawContributions) {
    if (record(candidate).kind && record(candidate).kind !== SWARM.RECORD_KIND.HOST_FABRIC_MEMBER_CONTRIBUTION) continue;
    try {
      contributions.push(assertHostFabricMemberContribution(candidate));
    } catch (error) {
      errors.push(text(error?.message || error || "invalid host-fabric member contribution"));
    }
  }
  for (const candidate of rawLifecyclePlans) {
    if (record(candidate).kind && record(candidate).kind !== SWARM.RECORD_KIND.LIFECYCLE_PLAN_POSTURE) continue;
    try {
      lifecyclePlans.push(assertLifecyclePlanPosture(candidate));
    } catch (error) {
      errors.push(text(error?.message || error || "invalid lifecycle plan posture"));
    }
  }
  return { plans, contributions, lifecyclePlans, errors };
}

function targetRank(target) {
  const state = text(target.state);
  if (state === FABRIC.CONTRACT_TARGET_STATE.SELECTED) return 0;
  if (state === FABRIC.CONTRACT_TARGET_STATE.READY) return 1;
  if (state === FABRIC.CONTRACT_TARGET_STATE.DEGRADED) return 2;
  if (state === FABRIC.CONTRACT_TARGET_STATE.BLOCKED) return 3;
  if (state === FABRIC.CONTRACT_TARGET_STATE.EXPIRED) return 4;
  return 5;
}

function selectRuntimeTarget(targets) {
  return [...targets].sort((left, right) => {
    const rank = targetRank(left) - targetRank(right);
    if (rank !== 0) return rank;
    return text(left.targetRef).localeCompare(text(right.targetRef));
  })[0] || null;
}

function selectRuntimeTargetRegistry(registries, targetRef) {
  const filtered = targetRef ? registries.filter((registry) => text(registry.targetRef) === targetRef) : registries;
  return [...filtered].sort((left, right) => text(left.registryRef).localeCompare(text(right.registryRef)))[0] || null;
}

function summarizeTargetSlot(slot) {
  return Object.freeze({
    slotRef: text(slot.slotRef),
    state: text(slot.state) || "unknown",
    platformFitState: text(slot.platformFitState) || "unknown",
    candidateFulfillmentRefs: Object.freeze(textArray(slot.candidateFulfillmentRefs)),
    selectedFulfillmentRef: text(slot.selectedFulfillmentRef),
    sourceRefs: Object.freeze(textArray(slot.sourceRefs)),
    buildRefs: Object.freeze(textArray(slot.buildRefs)),
    platformRefs: Object.freeze(textArray(slot.platformRefs)),
    adapterRefs: Object.freeze(textArray(slot.adapterRefs)),
    proofRequirementRefs: Object.freeze(textArray(slot.proofRequirementRefs)),
    proofRefs: Object.freeze(textArray(slot.proofRefs)),
    evidenceRefs: Object.freeze(textArray(slot.evidenceRefs)),
    blockedReasons: Object.freeze(textArray(slot.blockedReasons)),
  });
}

function countTargetSlots(slots, state) {
  return slots.filter((slot) => slot.state === state).length;
}

function summarizeTargetRegistry(registry) {
  if (!registry) {
    return Object.freeze({
      state: "missing",
      registryRef: "",
      slotCount: 0,
      availableSlotCount: 0,
      degradedSlotCount: 0,
      missingSlotCount: 0,
      blockedSlotCount: 0,
      notRequiredSlotCount: 0,
      candidateFulfillmentRefs: Object.freeze([]),
      selectedFulfillmentRefs: Object.freeze([]),
      sourceRefs: Object.freeze([]),
      buildRefs: Object.freeze([]),
      adapterRefs: Object.freeze([]),
      proofRequirementRefs: Object.freeze([]),
      proofRefs: Object.freeze([]),
      evidenceRefs: Object.freeze([]),
      blockedReasons: Object.freeze(["contractTargetRegistryMissing"]),
      slots: Object.freeze([]),
    });
  }
  const slots = array(registry.slotPostures).map(summarizeTargetSlot);
  return Object.freeze({
    state: text(registry.state) || "unknown",
    registryRef: text(registry.registryRef),
    slotCount: slots.length,
    availableSlotCount: countTargetSlots(slots, FABRIC.CONTRACT_TARGET_SLOT_STATE.AVAILABLE),
    degradedSlotCount: countTargetSlots(slots, FABRIC.CONTRACT_TARGET_SLOT_STATE.DEGRADED),
    missingSlotCount: countTargetSlots(slots, FABRIC.CONTRACT_TARGET_SLOT_STATE.MISSING),
    blockedSlotCount: countTargetSlots(slots, FABRIC.CONTRACT_TARGET_SLOT_STATE.BLOCKED),
    notRequiredSlotCount: countTargetSlots(slots, FABRIC.CONTRACT_TARGET_SLOT_STATE.NOT_REQUIRED),
    candidateFulfillmentRefs: Object.freeze(textArray(registry.candidateFulfillmentRefs)),
    selectedFulfillmentRefs: Object.freeze(slots.map((slot) => slot.selectedFulfillmentRef).filter(Boolean)),
    sourceRefs: Object.freeze(textArray(registry.sourceRefs)),
    buildRefs: Object.freeze(textArray(registry.buildRefs)),
    adapterRefs: Object.freeze(textArray(registry.adapterRefs)),
    proofRequirementRefs: Object.freeze(textArray(registry.proofRequirementRefs)),
    proofRefs: Object.freeze(textArray(registry.proofRefs)),
    evidenceRefs: Object.freeze(textArray(registry.evidenceRefs)),
    blockedReasons: Object.freeze(textArray(registry.blockedReasons)),
    slots: Object.freeze(slots),
  });
}

function deriveTargetReadModelState(target, registry, validationErrors) {
  if (!target) return validationErrors.length ? "degraded" : "pending";
  if (
    target.state === FABRIC.CONTRACT_TARGET_STATE.BLOCKED
    || target.state === FABRIC.CONTRACT_TARGET_STATE.EXPIRED
    || target.compatibilityState === FABRIC.CONTRACT_TARGET_COMPATIBILITY_STATE.INCOMPATIBLE
    || registry?.state === FABRIC.CONTRACT_TARGET_REGISTRY_STATE.BLOCKED
    || registry?.state === FABRIC.CONTRACT_TARGET_REGISTRY_STATE.EXPIRED
  ) return "blocked";
  if (
    validationErrors.length
    || target.state === FABRIC.CONTRACT_TARGET_STATE.DEGRADED
    || target.state === FABRIC.CONTRACT_TARGET_STATE.SELECTED
    || target.compatibilityState === FABRIC.CONTRACT_TARGET_COMPATIBILITY_STATE.DEGRADED
    || registry?.state === FABRIC.CONTRACT_TARGET_REGISTRY_STATE.DEGRADED
    || !registry
  ) return "degraded";
  return "ready";
}

export function prepareRuntimeTargetPosture(snapshot = {}, options = {}) {
  const snap = record(snapshot);
  const { targets, registries, errors } = validateRuntimeTargetRecords(snap);
  const selectedTarget = selectRuntimeTarget(targets);
  const selectedRegistry = selectRuntimeTargetRegistry(registries, text(selectedTarget?.targetRef));
  const registry = summarizeTargetRegistry(selectedRegistry);
  const blockedReasons = [
    ...textArray(selectedTarget?.blockedReasons),
    ...registry.blockedReasons,
    ...errors.map((error) => `invalidTargetRecord:${error}`),
  ];
  if (!selectedTarget && errors.length === 0) blockedReasons.push("contractTargetMissing");
  const state = deriveTargetReadModelState(selectedTarget, selectedRegistry, errors);

  return Object.freeze({
    kind: "runtime.contract-target.read-model",
    state,
    ready: state === "ready",
    degraded: state === "degraded",
    blocked: state === "blocked",
    targetRef: text(selectedTarget?.targetRef),
    contractRef: text(selectedTarget?.contractRef),
    profileRef: text(selectedTarget?.profileRef),
    platformRef: text(selectedTarget?.platformRef),
    targetAudience: text(selectedTarget?.targetAudience),
    hostRef: text(selectedTarget?.hostRef),
    substrateRef: text(selectedTarget?.substrateRef),
    compatibilityState: text(selectedTarget?.compatibilityState) || "unknown",
    targetState: text(selectedTarget?.state) || "unknown",
    modifierRefs: Object.freeze(textArray(selectedTarget?.modifierRefs)),
    branchRefs: Object.freeze(textArray(selectedTarget?.branchRefs)),
    subbranchRefs: Object.freeze(textArray(selectedTarget?.subbranchRefs)),
    capabilitySlotRefs: Object.freeze(textArray(selectedTarget?.capabilitySlotRefs)),
    adapterPackRef: text(selectedTarget?.adapterPackRef),
    adapterRefs: Object.freeze(textArray(selectedTarget?.adapterRefs)),
    negativeSlotRefs: Object.freeze(textArray(selectedTarget?.negativeSlotRefs)),
    missingSlotRefs: Object.freeze(textArray(selectedTarget?.missingSlotRefs)),
    degradedSlotRefs: Object.freeze(textArray(selectedTarget?.degradedSlotRefs)),
    proofProfileRefs: Object.freeze(textArray(selectedTarget?.proofProfileRefs)),
    proofRefs: Object.freeze(textArray(selectedTarget?.proofRefs)),
    compatibilityRefs: Object.freeze(textArray(selectedTarget?.compatibilityRefs)),
    evidenceRefs: Object.freeze(textArray(selectedTarget?.evidenceRefs)),
    blockedReasons: Object.freeze(blockedReasons),
    validationErrors: Object.freeze(errors),
    targetCount: targets.length,
    registryCount: registries.length,
    registry,
    clientId: text(options.clientId),
    surface: text(options.surface),
  });
}

function planRank(plan) {
  const state = text(plan.state);
  if (state === FABRIC.FULFILLMENT_PLAN_STATE.READY) return 0;
  if (state === FABRIC.FULFILLMENT_PLAN_STATE.DEGRADED) return 1;
  if (state === FABRIC.FULFILLMENT_PLAN_STATE.BLOCKED) return 2;
  if (state === FABRIC.FULFILLMENT_PLAN_STATE.EXPIRED) return 3;
  return 4;
}

function selectRuntimeFabricPlan(plans) {
  return [...plans].sort((left, right) => {
    const rank = planRank(left) - planRank(right);
    if (rank !== 0) return rank;
    return text(left.planId).localeCompare(text(right.planId));
  })[0] || null;
}

function summarizeFabricContribution(contribution) {
  return Object.freeze({
    contributionId: text(contribution.contributionId),
    fabricRef: text(contribution.fabricRef),
    hostRef: text(contribution.hostRef),
    memberRef: text(contribution.memberRef),
    role: text(contribution.role),
    state: text(contribution.state) || "unknown",
    contractRef: text(contribution.contractRef),
    subjectRef: text(contribution.subjectRef),
    capabilityRefs: Object.freeze(textArray(contribution.capabilityRefs)),
    grantRefs: Object.freeze(textArray(contribution.grantRefs)),
    inputRefs: Object.freeze(textArray(contribution.inputRefs)),
    outputRefs: Object.freeze(textArray(contribution.outputRefs)),
    evidenceRefs: Object.freeze(textArray(contribution.evidenceRefs)),
    lifecyclePlanRefs: Object.freeze(textArray(contribution.lifecyclePlanRefs)),
    releaseRefs: Object.freeze(textArray(contribution.releaseRefs)),
    blockedReasons: Object.freeze(textArray(contribution.blockedReasons)),
  });
}

function summarizeLifecyclePlan(plan) {
  return Object.freeze({
    lifecyclePlanId: text(plan.lifecyclePlanId),
    subjectRef: text(plan.subjectRef),
    contractRef: text(plan.contractRef),
    state: text(plan.state) || "unknown",
    lifecycleContractRefs: Object.freeze(textArray(plan.lifecycleContractRefs)),
    memberContributionRefs: Object.freeze(textArray(plan.memberContributionRefs)),
    evidenceRefs: Object.freeze(textArray(plan.evidenceRefs)),
    releaseRefs: Object.freeze(textArray(plan.releaseRefs)),
    blockedReasons: Object.freeze(textArray(plan.blockedReasons)),
    phaseCount: array(plan.phasePostures).length,
    phases: Object.freeze(array(plan.phasePostures).map((phase) => Object.freeze({
      phase: text(phase.phase),
      state: text(phase.state) || "unknown",
      blockedReasons: Object.freeze(textArray(phase.blockedReasons)),
      evidenceRefs: Object.freeze(textArray(phase.evidenceRefs)),
    }))),
  });
}

function fabricReadModelState(plan, contributions, lifecyclePlans, errors) {
  if (!plan) return errors.length ? "degraded" : "pending";
  if (
    plan.state === FABRIC.FULFILLMENT_PLAN_STATE.BLOCKED
    || plan.state === FABRIC.FULFILLMENT_PLAN_STATE.EXPIRED
    || contributions.some((entry) => entry.state === FABRIC.MEMBER_CONTRIBUTION_STATE.BLOCKED)
    || lifecyclePlans.some((entry) => entry.state === FABRIC.LIFECYCLE_PLAN_STATE.BLOCKED)
  ) return "blocked";
  if (
    errors.length
    || plan.state === FABRIC.FULFILLMENT_PLAN_STATE.DEGRADED
    || contributions.some((entry) => entry.state === FABRIC.MEMBER_CONTRIBUTION_STATE.DEGRADED)
    || lifecyclePlans.some((entry) => entry.state === FABRIC.LIFECYCLE_PLAN_STATE.DEGRADED)
  ) return "degraded";
  return "ready";
}

export function prepareRuntimeHostFabricPosture(snapshot = {}, options = {}) {
  const snap = record(snapshot);
  const { plans, contributions, lifecyclePlans, errors } = validateRuntimeFabricRecords(snap);
  const plan = selectRuntimeFabricPlan(plans);
  const planContributionRefs = new Set(textArray(plan?.memberContributionRefs));
  const planLifecycleRefs = new Set(textArray(plan?.lifecyclePlanRefs));
  const selectedContributions = planContributionRefs.size
    ? contributions.filter((entry) => planContributionRefs.has(text(entry.contributionId)))
    : contributions;
  const selectedLifecyclePlans = planLifecycleRefs.size
    ? lifecyclePlans.filter((entry) => planLifecycleRefs.has(text(entry.lifecyclePlanId)))
    : lifecyclePlans;
  const state = fabricReadModelState(plan, selectedContributions, selectedLifecyclePlans, errors);
  const blockedReasons = [
    ...textArray(plan?.blockedReasons),
    ...selectedContributions.flatMap((entry) => textArray(entry.blockedReasons)),
    ...selectedLifecyclePlans.flatMap((entry) => textArray(entry.blockedReasons)),
    ...errors.map((error) => `invalidFabricRecord:${error}`),
  ];
  if (!plan && errors.length === 0) blockedReasons.push("hostFabricFulfillmentPlanMissing");

  return Object.freeze({
    kind: "runtime.host-fabric.read-model",
    state,
    ready: state === "ready",
    degraded: state === "degraded",
    blocked: state === "blocked",
    planId: text(plan?.planId),
    fabricRef: text(plan?.fabricRef),
    hostRef: text(plan?.hostRef),
    contractRef: text(plan?.contractRef),
    requiredRoleRefs: Object.freeze(textArray(plan?.requiredRoleRefs)),
    memberContributionRefs: Object.freeze(textArray(plan?.memberContributionRefs)),
    missingRoleRefs: Object.freeze(textArray(plan?.missingRoleRefs)),
    lifecyclePlanRefs: Object.freeze(textArray(plan?.lifecyclePlanRefs)),
    materializationBudgetRefs: Object.freeze(textArray(plan?.materializationBudgetRefs)),
    evidenceRefs: Object.freeze(textArray(plan?.evidenceRefs)),
    associationHandoffRef: text(plan?.associationHandoffRef),
    blockedReasons: Object.freeze(blockedReasons),
    validationErrors: Object.freeze(errors),
    planCount: plans.length,
    contributionCount: contributions.length,
    lifecyclePlanCount: lifecyclePlans.length,
    contributions: Object.freeze(selectedContributions.map(summarizeFabricContribution)),
    lifecyclePlans: Object.freeze(selectedLifecyclePlans.map(summarizeLifecyclePlan)),
    clientId: text(options.clientId),
    surface: text(options.surface),
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
  const target = prepareRuntimeTargetPosture(snap, options);
  const fabric = prepareRuntimeHostFabricPosture(snap, options);
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
    target,
    fabric,
    materialization,
    resource: summarizeResource(snap),
    retention: summarizeRetention(snap),
  });
}
