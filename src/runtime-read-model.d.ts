export type RuntimeReadModelOptions = {
  clientId?: string;
  surface?: string;
  now?: number;
  context?: Record<string, unknown>;
  materializationBudget?: Record<string, unknown>;
  consumerFloor?: Record<string, unknown>;
  [key: string]: unknown;
};

export type RuntimeSurfaceReadModel = Readonly<{
  kind: "runtime.surface.read-model";
  state: "ready" | "pending";
  ready: boolean;
  blockedReasons: readonly string[];
  buildId: string;
  runtimeSessionId: string;
  updatedAt: number;
  snapshotAgeMs: number;
  snapshotKeyCount: number;
  shell: Readonly<Record<string, unknown>>;
  authority: Readonly<Record<string, unknown>>;
  broker: Readonly<Record<string, unknown>>;
  edge: RuntimeCarrierPostureReadModel;
  serviceRegistry: Readonly<Record<string, unknown>>;
  projection: Readonly<Record<string, unknown>>;
  target: RuntimeTargetReadModel;
  fabric: RuntimeHostFabricReadModel;
  materialization: Readonly<Record<string, unknown>>;
  resource: Readonly<Record<string, unknown>>;
  retention: Readonly<Record<string, unknown>>;
}>;

export type RuntimeCarrierEdgeReadModel = Readonly<{
  present: boolean;
  state: string;
  connectionState: string;
  adapterRef: string;
  adapterKind: string;
  participantRef: string;
  peerRef: string;
  edgeSessionRef: string;
  sessionBindingRef: string;
  networkSensitivity: string;
  backpressureState: string;
  blockedReasons: readonly string[];
  blockedReason: string;
  actionabilityState: "carrierReady" | "waitingCarrier" | "carrierBlocked" | "carrierDegraded";
  ready: boolean;
  waiting: boolean;
  degraded: boolean;
  blocked: boolean;
  validationErrors: readonly string[];
  proofSubstrateRefs: readonly string[];
  resourcePostureRefs: readonly string[];
  retryPosture: Readonly<Record<string, unknown>>;
  reconnectPosture: Readonly<Record<string, unknown>>;
  closePosture: Readonly<Record<string, unknown>>;
  releasePosture: Readonly<Record<string, unknown>>;
  observedAt: number;
  expiresAt: number;
}>;

export type RuntimeCarrierPostureReadModel = Readonly<{
  state: string;
  mode: string;
  connected: boolean;
  reason: string;
  actionabilityState: RuntimeCarrierEdgeReadModel["actionabilityState"];
  ready: boolean;
  waiting: boolean;
  degraded: boolean;
  blocked: boolean;
  blockedReasons: readonly string[];
  endpointRef: string;
  memberRef: string;
  carrierEdge: RuntimeCarrierEdgeReadModel;
}>;

export type RuntimeTargetSlotReadModel = Readonly<{
  slotRef: string;
  state: string;
  platformFitState: string;
  candidateFulfillmentRefs: readonly string[];
  selectedFulfillmentRef: string;
  sourceRefs: readonly string[];
  buildRefs: readonly string[];
  platformRefs: readonly string[];
  adapterRefs: readonly string[];
  proofRequirementRefs: readonly string[];
  proofRefs: readonly string[];
  evidenceRefs: readonly string[];
  blockedReasons: readonly string[];
}>;

export type RuntimeTargetRegistryReadModel = Readonly<{
  state: string;
  registryRef: string;
  slotCount: number;
  availableSlotCount: number;
  degradedSlotCount: number;
  missingSlotCount: number;
  blockedSlotCount: number;
  notRequiredSlotCount: number;
  candidateFulfillmentRefs: readonly string[];
  selectedFulfillmentRefs: readonly string[];
  sourceRefs: readonly string[];
  buildRefs: readonly string[];
  adapterRefs: readonly string[];
  proofRequirementRefs: readonly string[];
  proofRefs: readonly string[];
  evidenceRefs: readonly string[];
  blockedReasons: readonly string[];
  slots: readonly RuntimeTargetSlotReadModel[];
}>;

export type RuntimeTargetReadModel = Readonly<{
  kind: "runtime.contract-target.read-model";
  state: "ready" | "degraded" | "blocked" | "pending";
  ready: boolean;
  degraded: boolean;
  blocked: boolean;
  targetRef: string;
  contractRef: string;
  profileRef: string;
  platformRef: string;
  targetAudience: string;
  hostRef: string;
  substrateRef: string;
  compatibilityState: string;
  targetState: string;
  modifierRefs: readonly string[];
  branchRefs: readonly string[];
  subbranchRefs: readonly string[];
  capabilitySlotRefs: readonly string[];
  adapterPackRef: string;
  adapterRefs: readonly string[];
  negativeSlotRefs: readonly string[];
  missingSlotRefs: readonly string[];
  degradedSlotRefs: readonly string[];
  proofProfileRefs: readonly string[];
  proofRefs: readonly string[];
  compatibilityRefs: readonly string[];
  evidenceRefs: readonly string[];
  blockedReasons: readonly string[];
  validationErrors: readonly string[];
  targetCount: number;
  registryCount: number;
  registry: RuntimeTargetRegistryReadModel;
  clientId: string;
  surface: string;
}>;

export type RuntimeHostFabricContributionReadModel = Readonly<{
  contributionId: string;
  fabricRef: string;
  hostRef: string;
  memberRef: string;
  role: string;
  state: string;
  contractRef: string;
  subjectRef: string;
  capabilityRefs: readonly string[];
  grantRefs: readonly string[];
  inputRefs: readonly string[];
  outputRefs: readonly string[];
  evidenceRefs: readonly string[];
  lifecyclePlanRefs: readonly string[];
  releaseRefs: readonly string[];
  blockedReasons: readonly string[];
}>;

export type RuntimeLifecyclePlanReadModel = Readonly<{
  lifecyclePlanId: string;
  subjectRef: string;
  contractRef: string;
  state: string;
  lifecycleContractRefs: readonly string[];
  memberContributionRefs: readonly string[];
  evidenceRefs: readonly string[];
  releaseRefs: readonly string[];
  blockedReasons: readonly string[];
  phaseCount: number;
  phases: readonly Readonly<{
    phase: string;
    state: string;
    blockedReasons: readonly string[];
    evidenceRefs: readonly string[];
  }>[];
}>;

export type RuntimeHostOperationReadModel = Readonly<{
  kind: "runtime.host-operation.read-model";
  state: "ready" | "degraded" | "blocked" | "pending";
  ready: boolean;
  degraded: boolean;
  blocked: boolean;
  operationRef: string;
  subjectRef: string;
  decisionId: string;
  decisionState: string;
  planState: string;
  sourcePlanRef: string;
  sourcePlanObservedAt: number;
  sourcePlanExpiresAt: number;
  delegatedRoleRef: string;
  legacyBridgeId: string;
  legacyBridgeState: string;
  legacyDirect: boolean;
  fallbackAvailable: boolean;
  quarantined: boolean;
  adapterEvidenceId: string;
  adapterExecutionState: string;
  adapterRef: string;
  outputRefs: readonly string[];
  cleanupRefs: readonly string[];
  fallbackRefs: readonly string[];
  quarantineRefs: readonly string[];
  blockedReasons: readonly string[];
  validationErrors: readonly string[];
  observedAt: number;
  expiresAt: number;
}>;

export type RuntimeHostFabricReadModel = Readonly<{
  kind: "runtime.host-fabric.read-model";
  state: "ready" | "degraded" | "blocked" | "pending";
  ready: boolean;
  degraded: boolean;
  blocked: boolean;
  planId: string;
  fabricRef: string;
  hostRef: string;
  contractRef: string;
  requiredRoleRefs: readonly string[];
  memberContributionRefs: readonly string[];
  missingRoleRefs: readonly string[];
  lifecyclePlanRefs: readonly string[];
  materializationBudgetRefs: readonly string[];
  evidenceRefs: readonly string[];
  associationHandoffRef: string;
  blockedReasons: readonly string[];
  validationErrors: readonly string[];
  planCount: number;
  contributionCount: number;
  lifecyclePlanCount: number;
  controlDecisionCount: number;
  legacyBridgeCount: number;
  adapterExecutionCount: number;
  operationValidationErrors: readonly string[];
  operation: RuntimeHostOperationReadModel;
  contributions: readonly RuntimeHostFabricContributionReadModel[];
  lifecyclePlans: readonly RuntimeLifecyclePlanReadModel[];
  clientId: string;
  surface: string;
}>;

export function prepareRuntimeReadModel(
  snapshot?: Record<string, unknown>,
  options?: RuntimeReadModelOptions,
): RuntimeSurfaceReadModel;

export function prepareRuntimeTargetPosture(
  snapshot?: Record<string, unknown>,
  options?: RuntimeReadModelOptions,
): RuntimeTargetReadModel;

export function prepareRuntimeHostFabricPosture(
  snapshot?: Record<string, unknown>,
  options?: RuntimeReadModelOptions,
): RuntimeHostFabricReadModel;
