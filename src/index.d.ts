export type ViewModel<T> = {
  current(): T;
  set(nextValue: T): void;
  update(updater: (currentValue: T) => T): void;
  subscribe(listener: (value: T) => void, options?: { emit?: boolean }): () => void;
};

export type SurfaceAppModuleClaim = {
  moduleRef: string;
  role: string;
  participantSide: string;
  fulfillmentMode: string;
  version: string;
  buildId?: string;
  primitiveRefs?: string[];
  requiredCapabilities?: string[];
  inputs?: string[];
  outputs?: string[];
  fallbackRefs?: string[];
  issuedAt?: number;
  expiresAt?: number;
  [key: string]: unknown;
};

export type SurfaceAppContractShape = {
  contractId: string;
  appId: string;
  appRef?: string;
  serviceContractRef?: string;
  serviceRef?: string;
  serviceRouteRefs?: string[];
  hostRefs?: string[];
  routeRefs?: string[];
  rootRefs?: string[];
  deviceRefs?: string[];
  grantRefs?: string[];
  authorityRefs?: string[];
  accessGroupRefs?: string[];
  requiredContentClasses?: string[];
  revocationRefs?: string[];
  surfaceRef?: string;
  version: string;
  displayName?: string;
  requiredPrimitives?: string[];
  requiredModuleRoles?: string[];
  modules?: SurfaceAppModuleClaim[];
  projectionSubscriptions?: unknown[];
  permissionRequirements?: unknown[];
  capabilityRequirements?: unknown[];
  materializationBudgets?: unknown[];
  updatePosture?: Record<string, unknown>;
  bootstrapPosture?: Record<string, unknown>;
  serviceManagerPosture?: Record<string, unknown>;
  secretBoundary?: Record<string, unknown>;
  releasePosture?: Record<string, unknown>;
  rollbackPosture?: Record<string, unknown>;
  [key: string]: unknown;
};

export type SurfaceAppPosture = {
  state: "ready" | "blocked";
  blockedReason: string;
  missingRoles: string[];
  moduleCount: number;
};

export type SurfaceModuleRolePosture = {
  kind: "surface.module.role.posture";
  state: "ready" | "blocked";
  blockedReason: string;
  role: string;
  moduleRef: string;
  primitiveRef: string;
  moduleCount: number;
  modules: readonly SurfaceAppModuleClaim[];
};

export type SurfaceModuleTaxonomyRole = {
  taxonomyKey: string;
  role: string;
  participantSides: readonly string[];
  evidenceChannels: readonly string[];
  lifecycle: Record<string, unknown>;
};

export type SurfaceModuleTaxonomyRolePosture = {
  kind: "surface.module.taxonomy.role.posture";
  state: "ready" | "optional" | "blocked";
  blockedReason: string;
  blockedReasons: readonly string[];
  taxonomyKey: string;
  role: string;
  required: boolean;
  moduleRefs: readonly string[];
  participantSides: readonly string[];
  evidenceChannels: readonly string[];
  lifecycle: Record<string, unknown>;
  materializationBudgetRefs: readonly string[];
  releaseRefs: readonly string[];
  moduleCount: number;
  modules: readonly SurfaceAppModuleClaim[];
  issuedAt: number;
  expiresAt?: unknown;
};

export type SurfaceModuleTaxonomyPosture = {
  kind: "surface.module.taxonomy.posture";
  state: "ready" | "blocked";
  blockedReasons: readonly string[];
  roleOrder: readonly string[];
  roles: readonly SurfaceModuleTaxonomyRolePosture[];
  byRole: Readonly<Record<string, SurfaceModuleTaxonomyRolePosture>>;
  moduleCount: number;
  materializationBudgetRefs: readonly string[];
  releaseRefs: readonly string[];
  issuedAt: number;
  expiresAt?: unknown;
};
export type SurfaceMaterializationBudgetPosture = {
  kind: "surface.materialization.budget.posture";
  state: "ready" | "blocked";
  blockedReason: string;
  budgetId: string;
  payloadClass: string;
  copyRole: string;
  transferMode: string;
  budget: Record<string, unknown> | null;
};

export type SurfaceAppAttachContext = {
  kind: "surface.app.attachContext";
  contractId: string;
  appId: string;
  appRef: string;
  serviceContractRef: string;
  serviceRef: string;
  surfaceRef: string;
  version: string;
  displayName: string;
  fulfillmentIdentityPosture: SurfaceAppFulfillmentIdentityPosture;
  authorityAccessPosture: SurfaceAppAuthorityAccessPosture;
  posture: SurfaceAppPosture;
  requiredModuleRoles: string[];
  moduleRefs: Array<{
    moduleRef: string;
    role: string;
    participantSide: string;
    fulfillmentMode: string;
    version: string;
    buildId: string;
  }>;
  materializationBudgetRefs: string[];
  updatePosture?: Record<string, unknown>;
  [key: string]: unknown;
};

export type SurfaceAppFulfillmentIdentityPosture = {
  kind: "surface.app.fulfillment.identity.posture";
  identityId: string;
  state: "ready" | "degraded" | "blocked" | "unknown" | "unchecked";
  appContractRef: string;
  appId: string;
  version: string;
  surfaceRef: string;
  serviceRequired: boolean;
  serviceContractRef?: string;
  serviceRef?: string;
  serviceRouteRefs: string[];
  routeRefs: string[];
  hostRefs: string[];
  managerRefs: string[];
  runnerRefs: string[];
  memberRefs: string[];
  capabilityRefs: string[];
  grantRefs: string[];
  authorityRefs: string[];
  evidenceRefs: string[];
  identityPosture: Readonly<Record<string, unknown>>;
  safeFacts: Readonly<Record<string, unknown>>;
  blockedReasons: string[];
  issuedAt: number;
  expiresAt?: unknown;
};

export type SurfaceAppAuthorityAccessPosture = {
  kind: "surface.app.authority.access.posture";
  postureId: string;
  state: "ready" | "degraded" | "blocked" | "unknown" | "unchecked";
  appContractRef: string;
  appId: string;
  actionRequired: boolean;
  accessRequired: boolean;
  syncRequired: boolean;
  rootRefs: string[];
  deviceRefs: string[];
  grantRefs: string[];
  authorityRefs: string[];
  accessGroupRefs: string[];
  accessEpochRefs: string[];
  privateEnvelopeRefs: string[];
  syncRefs: string[];
  requiredContentClasses: string[];
  revocationRefs: string[];
  exerciseRefs: string[];
  evidenceRefs: string[];
  actionPosture: Readonly<Record<string, unknown>>;
  accessPosture: Readonly<Record<string, unknown>>;
  syncPosture: Readonly<Record<string, unknown>>;
  revocationPosture: Readonly<Record<string, unknown>>;
  expiryPosture: Readonly<Record<string, unknown>>;
  revocationState?: string;
  safeFacts: Readonly<Record<string, unknown>>;
  blockedReasons: string[];
  issuedAt: number;
  expiresAt?: unknown;
};

export type SurfaceAppBootstrapPosture = {
  kind: "surface.app.bootstrap.posture";
  bootstrapId: string;
  contractId: string;
  appId: string;
  state: "ready" | "degraded" | "blocked";
  sourceMode: string;
  moduleRefs: string[];
  bootstrapContractRef?: string;
  releaseContractRef?: string;
  secretBoundaryRef?: string;
  trainDigestRef?: string;
  labProofRefs?: string[];
  proofDigestRefs?: string[];
  compatibilityRefs?: string[];
  serviceManagerRef: string;
  serviceManagerPosture: Readonly<Record<string, unknown>>;
  secretBoundary: Readonly<Record<string, unknown>>;
  releasePosture: Readonly<Record<string, unknown>>;
  rollbackPosture?: Readonly<Record<string, unknown>>;
  bootstrapContract?: Readonly<Record<string, unknown>>;
  blockedReasons: string[];
  evidenceRefs: string[];
  issuedAt: number;
  expiresAt?: unknown;
};

export type SurfaceAppInstancePosture = {
  kind: "surface.app.instance.posture";
  instanceId: string;
  state: "ready" | "degraded" | "blocked";
  contractId: string;
  appId: string;
  appRef: string;
  serviceRef: string;
  surfaceRef: string;
  displayName: string;
  version: string;
  manifestId: string;
  pinnedAppContractRef: string;
  pinnedVersion: string;
  sourceMode: string;
  sourceTrustResult: Readonly<Record<string, unknown>> | null;
  compatibilityResult: Readonly<Record<string, unknown>> | null;
  requiredModuleRoles: string[];
  moduleRefs: string[];
  modulePostures: Readonly<Record<string, unknown>>[];
  moduleBindingPosture: Readonly<Record<string, unknown>> | null;
  materializationBudgetRefs: string[];
  runtimeSelectionPosture: Readonly<Record<string, unknown>> | null;
  runnerReadiness: Readonly<Record<string, unknown>> | null;
  runnerFulfillmentLifecycle?: SurfaceAppRunnerFulfillmentLifecycle | null;
  runnerFulfillmentReadiness?: SurfaceAppRunnerFulfillmentReadiness | null;
  serviceManagerReadiness: Readonly<Record<string, unknown>> | null;
  fulfillmentIdentityPosture: SurfaceAppFulfillmentIdentityPosture;
  authorityAccessPosture: SurfaceAppAuthorityAccessPosture;
  runnerPlanRef: string;
  runnerFulfillmentRef?: string;
  bootstrapContractRef: string;
  bootstrapPosture: Readonly<Record<string, unknown>> | null;
  serviceManagerOperationRef: string;
  serviceManagerProofRef: string;
  blockedReasons: string[];
  issuedAt: number;
  expiresAt?: unknown;
};

export type SurfaceAppSelectionReadModel = {
  kind: "surface.app.selection.readModel";
  state: "ready" | "degraded" | "blocked";
  blockedReasons: string[];
  contractId: string;
  appId: string;
  appRef: string;
  serviceRef: string;
  surfaceRef: string;
  productSurface: string;
  manifestId: string;
  pinnedAppContractRef: string;
  pinnedVersion: string;
  sourceMode: string;
  runtimeSelectionPosture: SurfaceAppRuntimeSelectionPosture;
  moduleBindings: Readonly<Record<string, unknown>> | null;
  runnerPlan: SurfaceAppRunnerPlan;
  runnerFulfillmentLifecycle: SurfaceAppRunnerFulfillmentLifecycle | null;
  runnerFulfillmentReadiness: SurfaceAppRunnerFulfillmentReadiness | null;
  fulfillmentIdentityPosture: SurfaceAppFulfillmentIdentityPosture;
  authorityAccessPosture: SurfaceAppAuthorityAccessPosture;
  serviceManagerSecretBoundary: SurfaceServiceManagerSecretBoundary;
  bootstrapContract: Readonly<Record<string, unknown>>;
  bootstrapPosture: SurfaceAppBootstrapPosture;
  serviceManagerOperationPosture: SurfaceServiceManagerOperationPosture;
  serviceManagerProofDigest: SurfaceServiceManagerProofDigest;
  appInstancePosture: SurfaceAppInstancePosture;
  attachContext: SurfaceAppAttachContext;
  materializationBudgetRefs: string[];
  moduleRefs: string[];
  issuedAt: number;
  expiresAt?: unknown;
};

export type SurfaceAppRunnerFulfillmentReadiness = {
  kind: "surface.app.runner.fulfillment.readiness";
  state: "ready" | "degraded" | "blocked" | string;
  reportId: string;
  runnerId: string;
  runnerRef: string;
  hostRef: string;
  runnerOperationId: string;
  operation: string;
  appContractRef: string;
  manifestRef: string;
  sourceMode: string;
  outputRefs: string[];
  proofRefs: string[];
  releaseRefs: string[];
  evidenceRefs: string[];
  resourcePosture: Readonly<Record<string, unknown>> | null;
  hostFulfillmentPosture: Readonly<Record<string, unknown>> | null;
  operationPosture: Readonly<Record<string, unknown>> | null;
  fulfillmentPosture: Readonly<Record<string, unknown>> | null;
  blockedReasons: string[];
  observedAt: number;
  expiresAt?: unknown;
};

export type SurfaceAppRunnerFulfillmentLifecycle = {
  kind: "app.runner.fulfillment.lifecycle";
  lifecycleId: string;
  reportId: string;
  runnerId: string;
  runnerRef: string;
  hostRef: string;
  runnerOperationId: string;
  operation: string;
  state: string;
  requesterRef: string;
  subjectRef: string;
  contractRef: string;
  appContractRef: string;
  appId: string;
  version: string;
  manifestRef: string;
  sourceMode: string;
  sourceRefs: string[];
  grantRefs: string[];
  capabilityRefs: string[];
  inputRefs: string[];
  outputRefs: string[];
  evidenceRefs: string[];
  proofRefs: string[];
  releaseRefs: string[];
  witnessRefs: string[];
  releaseWitnessRefs: string[];
  resourceBudget: Readonly<Record<string, unknown>> | null;
  resourcePosture: Readonly<Record<string, unknown>> | null;
  secretBoundary?: Readonly<Record<string, unknown>>;
  releasePosture: Readonly<Record<string, unknown>> | null;
  rollbackPosture: Readonly<Record<string, unknown>> | null;
  hostFulfillmentPosture: Readonly<Record<string, unknown>> | null;
  releaseRef?: string;
  rollbackRef?: string;
  operationPosture: Readonly<Record<string, unknown>> | null;
  fulfillmentPosture: Readonly<Record<string, unknown>> | null;
  safeFacts?: Readonly<Record<string, unknown>>;
  blockedReasons: string[];
  requestedAt?: number;
  acceptedAt?: number;
  startedAt?: number;
  completedAt?: number;
  releasedAt?: number;
  rolledBackAt?: number;
  rejectedAt?: number;
  expiredAt?: number;
  observedAt: number;
  expiresAt?: unknown;
};

export type SurfaceServiceManagerOperationPosture = {
  kind: "service.manager.operation.posture";
  operationId: string;
  managerId: string;
  subjectRef: string;
  managerRef: string;
  requesterRef: string;
  operation: string;
  state: string;
  serviceRefs: string[];
  capabilityRefs: string[];
  authorityRefs: string[];
  grantRefs?: string[];
  runnerOperationRef?: string;
  runnerRef?: string;
  hostRef?: string;
  releaseRef?: string;
  rollbackRef?: string;
  secretBoundary: Readonly<Record<string, unknown>>;
  releasePosture?: Readonly<Record<string, unknown>>;
  rollbackPosture?: Readonly<Record<string, unknown>>;
  resourceBudget?: Readonly<Record<string, unknown>>;
  resourcePosture?: Readonly<Record<string, unknown>>;
  evidenceRefs: string[];
  proofRefs: string[];
  witnessRefs: string[];
  retentionRefs: string[];
  releaseWitnessRefs: string[];
  blockedReasons: string[];
  safeFacts?: Readonly<Record<string, unknown>>;
  requestedAt: number;
  acceptedAt?: unknown;
  startedAt?: unknown;
  completedAt?: unknown;
  observedAt?: unknown;
  expiresAt?: unknown;
};

export type SurfaceRunnerOperation = {
  kind: "runner.operation";
  operationId: string;
  runnerId: string;
  runnerRef: string;
  hostRef: string;
  requesterRef: string;
  subjectRef: string;
  contractRef: string;
  operation: string;
  state: string;
  grantRefs: string[];
  capabilityRefs: string[];
  inputRefs: string[];
  outputRefs: string[];
  evidenceRefs: string[];
  proofRefs: string[];
  releaseRefs: string[];
  resourceBudget: Readonly<Record<string, unknown>>;
  resourcePosture?: Readonly<Record<string, unknown>>;
  secretBoundary: Readonly<Record<string, unknown>>;
  releasePosture?: Readonly<Record<string, unknown>>;
  rollbackPosture?: Readonly<Record<string, unknown>>;
  releaseRef?: string;
  rollbackRef?: string;
  blockedReasons: string[];
  safeFacts?: Readonly<Record<string, unknown>>;
  requestedAt: number;
  acceptedAt?: unknown;
  startedAt?: unknown;
  completedAt?: unknown;
  observedAt?: unknown;
  expiresAt?: unknown;
};

export type SurfaceServiceManagerProofDigest = {
  kind: "service.manager.proof.digest";
  digestId: string;
  operationId: string;
  managerId: string;
  subjectRef: string;
  state: string;
  trainRef?: string;
  releaseRef?: string;
  rollbackRef?: string;
  commitRefs: string[];
  artifactRefs: string[];
  proofRefs: string[];
  metricsRefs: string[];
  environmentRefs: string[];
  serviceRefs: string[];
  evidenceRefs: string[];
  blockedReasons: string[];
  safeFacts?: Readonly<Record<string, unknown>>;
  observedAt: number;
  expiresAt?: unknown;
};

export type SurfaceServiceManagerSecretBoundary = {
  kind: "service.manager.secretBoundary";
  boundaryId: string;
  managerId: string;
  subjectRef: string;
  state: string;
  secretRefs: string[];
  accessGroupRefs: string[];
  authorityRefs: string[];
  evidenceRefs: string[];
  blockedReasons: string[];
  safeFacts?: Readonly<Record<string, unknown>>;
  issuedAt: number;
  expiresAt?: unknown;
};

export type SurfaceServiceManagerReleaseContract = {
  kind: "service.manager.release.contract";
  contractId: string;
  managerId: string;
  subjectRef: string;
  managerRef: string;
  state: string;
  appContractRef: string;
  version: string;
  buildRef?: string;
  releaseRef?: string;
  rollbackRef?: string;
  rollbackRequired: boolean;
  compatibilityRefs: string[];
  authorityRefs: string[];
  secretBoundaryRefs: string[];
  proofDigestRefs: string[];
  labProofRefs: string[];
  evidenceRefs: string[];
  blockedReasons: string[];
  secretBoundary: SurfaceServiceManagerSecretBoundary;
  releasePosture?: Readonly<Record<string, unknown>>;
  rollbackPosture?: Readonly<Record<string, unknown>>;
  safeFacts?: Readonly<Record<string, unknown>>;
  issuedAt: number;
  expiresAt?: unknown;
};

export type SurfaceServiceManagerLabProof = {
  kind: "service.manager.labProof";
  proofId: string;
  managerId: string;
  subjectRef: string;
  profile: string;
  state: string;
  trainRef?: string;
  releaseContractRef?: string;
  appContractRef: string;
  surfaceRefs: string[];
  serviceRefs: string[];
  environmentRefs: string[];
  artifactRefs: string[];
  metricsRefs: string[];
  proofRefs: string[];
  evidenceRefs: string[];
  blockedReasons: string[];
  safeFacts?: Readonly<Record<string, unknown>>;
  startedAt: number;
  acceptedAt?: unknown;
  completedAt?: unknown;
  observedAt?: unknown;
  expiresAt?: unknown;
};

export type SurfaceServiceManagerTrainDigest = {
  kind: "service.manager.train.digest";
  trainId: string;
  managerId: string;
  subjectRef: string;
  state: string;
  repoRefs: string[];
  commitRefs: string[];
  appContractRefs: string[];
  releaseContractRefs: string[];
  operationRefs: string[];
  proofDigestRefs: string[];
  labProofRefs: string[];
  metricsRefs: string[];
  evidenceRefs: string[];
  blockedReasons: string[];
  safeFacts?: Readonly<Record<string, unknown>>;
  observedAt: number;
  expiresAt?: unknown;
};

export type SurfaceAppBootstrapContract = {
  kind: "surface.app.bootstrap.contract";
  bootstrapContractId: string;
  appContractRef: string;
  appId: string;
  state: string;
  sourceMode: string;
  moduleRefs: string[];
  serviceManagerRef?: string;
  releaseContractRef?: string;
  secretBoundaryRef?: string;
  trainDigestRef?: string;
  labProofProfileRefs: string[];
  authorityRefs: string[];
  evidenceRefs: string[];
  blockedReasons: string[];
  secretBoundary: SurfaceServiceManagerSecretBoundary;
  releaseContract?: SurfaceServiceManagerReleaseContract;
  safeFacts?: Readonly<Record<string, unknown>>;
  issuedAt: number;
  expiresAt?: unknown;
};

export type SurfaceAppRunnerPlan = {
  kind: "surface.app.runner.plan";
  planId: string;
  contractId: string;
  appId: string;
  state: "ready" | "blocked";
  sourceMode: string;
  attachContext: SurfaceAppAttachContext;
  modulePostures: readonly SurfaceModuleRolePosture[];
  secretBoundary: SurfaceServiceManagerSecretBoundary;
  releaseContract: SurfaceServiceManagerReleaseContract | null;
  bootstrapContract: SurfaceAppBootstrapContract;
  labProof: SurfaceServiceManagerLabProof | null;
  proofDigest: SurfaceServiceManagerProofDigest | null;
  trainDigest: SurfaceServiceManagerTrainDigest | null;
  blockedReasons: string[];
  issuedAt: number;
  expiresAt?: unknown;
};

export type SurfaceAppManifestSelection = {
  kind: "surface.app.manifest.selection";
  manifestId: string;
  appId: string;
  state: "ready" | "blocked";
  appContractRef: string;
  version: string;
  sourceMode: string;
  claimState: string;
  requiredModuleRoles: string[];
  bundledSourceRefs: string[];
  remoteSourceRefs: string[];
  storageObjectRefs: string[];
  releaseSourceRefs: string[];
  swarmSourceRefs: string[];
  digestRefs: string[];
  signatureRefs: string[];
  publisherRefs: string[];
  sourceAuthorityRefs: string[];
  releaseEvidenceRefs: string[];
  grantRefs: string[];
  runnerRequirementRefs: string[];
  serviceManagerRequirementRefs: string[];
  compatibilityWindow: unknown;
  compatibilityRefs: string[];
  bootstrapContractRef: string;
  releaseContractRef: string;
  sourceCandidatePosture: SurfaceAppSourceCandidatePosture;
  evidenceRefs: string[];
  blockedReasons: string[];
  claim: Readonly<Record<string, unknown>> | null;
  surfaceApp: DefinedSurfaceApp | null;
  contract: SurfaceAppContractShape | null;
  issuedAt: number;
  expiresAt?: unknown;
};

export type SurfaceAppManifestRunnerPlan = {
  kind: "surface.app.manifest.runner.plan";
  planId: string;
  state: "ready" | "blocked";
  manifestSelection: SurfaceAppManifestSelection;
  runnerPlan: SurfaceAppRunnerPlan | null;
  blockedReasons: string[];
  issuedAt: number;
  expiresAt?: unknown;
};

export type SurfaceAppSourceClass =
  | "bundled"
  | "storagePinned"
  | "releaseFetched"
  | "swarmHosted"
  | "nativeInstalled"
  | "devOverlay"
  | "unknown";

export type SurfaceAppSourceCandidatePosture = {
  kind: "surface.app.source.candidate.posture";
  state: "ready" | "degraded" | "blocked";
  sourceMode: string;
  sourceClass: SurfaceAppSourceClass;
  candidateRefs: string[];
  bundledSourceRefs: string[];
  remoteSourceRefs: string[];
  storageObjectRefs: string[];
  releaseSourceRefs: string[];
  swarmSourceRefs: string[];
  releaseContractRef: string;
  digestRefs: string[];
  signatureRefs: string[];
  publisherRefs: string[];
  sourceAuthorityRefs: string[];
  releaseEvidenceRefs: string[];
  compatibilityRefs: string[];
  proofDigestRefs: string[];
  rollbackRefs: string[];
  secretBoundaryRefs: string[];
  trustRefs: string[];
  evidenceRefs: string[];
  blockedReasons: string[];
  issuedAt: number;
  expiresAt?: unknown;
};

export type SurfaceAppDistributionPosture = {
  state: "pending" | "retained" | "degraded" | "blocked" | "superseded" | "ignored";
  sourceMode: string;
  sourceRefs: string[];
  storageRefs: string[];
  pinIntentRefs: string[];
  pinProjectionRefs: string[];
  releaseContractRefs: string[];
  retentionRefs: string[];
  retentionClass: string;
  schemaPosture?: Readonly<Record<string, unknown>>;
  releasePosture: Readonly<Record<string, unknown>>;
  evidenceRefs: string[];
  blockedReasons: string[];
  safeFacts: Readonly<Record<string, unknown>>;
};

export type SurfaceAppContractResolution = {
  kind: "surface.app.contract.resolution";
  state: "ready" | "blocked";
  appId: string;
  appContractRef: string;
  version: string;
  sourceMode: string;
  requiredPrimitiveRefs: string[];
  requiredModuleRoles: string[];
  moduleRoleClaims: readonly Record<string, unknown>[];
  permissionRequirementRefs: string[];
  capabilityRequirementRefs: string[];
  projectionSubscriptionRefs: string[];
  materializationBudgetRefs: string[];
  actionGrantRefs: string[];
  accessRequirementRefs: string[];
  requiredContentClasses: string[];
  compatibilityRefs: string[];
  compatibilityState: string;
  blockedReasons: string[];
  safeFacts: Readonly<Record<string, unknown>>;
  issuedAt: number;
  expiresAt?: unknown;
};

export type SurfaceAppRuntimeSelectionPosture = {
  kind: "surface.app.runtime.selection.posture";
  selectionId: string;
  state: "ready" | "degraded" | "blocked";
  requestedAppRef: string;
  requestedVersion: string;
  manifestId: string;
  appId: string;
  pinnedAppContractRef: string;
  pinnedVersion: string;
  sourceMode: string;
  requiredModuleRoles: string[];
  compatibilityResult: Readonly<Record<string, unknown>>;
  appContractResolution: SurfaceAppContractResolution;
  requiredPrimitiveRefs: string[];
  permissionRequirementRefs: string[];
  capabilityRequirementRefs: string[];
  projectionSubscriptionRefs: string[];
  materializationBudgetRefs: string[];
  accessRequirementRefs: string[];
  sourceTrustResult: Readonly<Record<string, unknown>>;
  modulePostures: readonly SurfaceModuleRolePosture[];
  runnerReadiness: Readonly<Record<string, unknown>>;
  serviceManagerReadiness: Readonly<Record<string, unknown>>;
  fulfillmentIdentityPosture: SurfaceAppFulfillmentIdentityPosture | null;
  authorityAccessPosture: SurfaceAppAuthorityAccessPosture | null;
  manifestSelection: SurfaceAppManifestSelection;
  manifestRunnerPlan: SurfaceAppManifestRunnerPlan;
  runnerPlan: SurfaceAppRunnerPlan | null;
  blockedReasons: string[];
  issuedAt: number;
  expiresAt?: unknown;
};

export type DefinedSurfaceApp = {
  contract: SurfaceAppContractShape;
  modules: readonly SurfaceAppModuleClaim[];
  modulesByRole: Readonly<Record<string, readonly SurfaceAppModuleClaim[]>>;
  requiredRoles: readonly string[];
  missingRoles: readonly string[];
  posture: SurfaceAppPosture;
  hasRole(role: string): boolean;
  moduleForRole(role: string): SurfaceAppModuleClaim | null;
  modulesForRole(role: string): readonly SurfaceAppModuleClaim[];
  attachContext(extra?: Record<string, unknown>): SurfaceAppAttachContext;
};

export const SURFACE_CONTRACT_ROLE_ORDER: readonly string[];
export const SURFACE_MODULE_ROLE_TAXONOMY: Readonly<Record<string, SurfaceModuleTaxonomyRole>>;
export const SURFACE_ADAPTER_TAXONOMY: Readonly<Record<string, SurfaceModuleTaxonomyRole>>;
export function defineSurfaceAppContract(
  contract: SurfaceAppContractShape,
  options?: { validate?: (contract: SurfaceAppContractShape) => SurfaceAppContractShape },
): DefinedSurfaceApp;
export function surfaceAppContractPosture(surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape): SurfaceAppPosture;
export function surfaceModuleTaxonomyPosture(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  options?: Record<string, unknown>,
): SurfaceModuleTaxonomyPosture;
export const surfaceAdapterTaxonomyPosture: typeof surfaceModuleTaxonomyPosture;
export function surfaceAppAttachContext(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  extra?: Record<string, unknown>,
): SurfaceAppAttachContext;
export function surfaceAppBootstrapPosture(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  options?: Record<string, unknown>,
): SurfaceAppBootstrapPosture;
export function surfaceAppFulfillmentIdentityPosture(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  options?: Record<string, unknown>,
): SurfaceAppFulfillmentIdentityPosture;
export function surfaceAppAuthorityAccessPosture(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  options?: Record<string, unknown>,
): SurfaceAppAuthorityAccessPosture;
export function surfaceAppInstancePosture(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  options?: Record<string, unknown>,
): SurfaceAppInstancePosture;
export function surfaceAppRunnerFulfillmentReadiness(
  report: Record<string, unknown> | null | undefined,
  options?: Record<string, unknown>,
): SurfaceAppRunnerFulfillmentReadiness | null;
export function surfaceAppRunnerFulfillmentLifecycle(
  report: Record<string, unknown> | null | undefined,
  options?: Record<string, unknown>,
): SurfaceAppRunnerFulfillmentLifecycle | null;
export function surfaceServiceManagerOperationPosture(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  options?: Record<string, unknown>,
): SurfaceServiceManagerOperationPosture;
export function surfaceServiceManagerProofDigest(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  options?: Record<string, unknown>,
): SurfaceServiceManagerProofDigest;
export function surfaceRunnerOperation(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  options?: Record<string, unknown>,
): SurfaceRunnerOperation;
export function surfaceServiceManagerSecretBoundary(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  options?: Record<string, unknown>,
): SurfaceServiceManagerSecretBoundary;
export function surfaceServiceManagerReleaseContract(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  options?: Record<string, unknown>,
): SurfaceServiceManagerReleaseContract;
export function surfaceServiceManagerLabProof(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  options?: Record<string, unknown>,
): SurfaceServiceManagerLabProof;
export function surfaceServiceManagerTrainDigest(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  options?: Record<string, unknown>,
): SurfaceServiceManagerTrainDigest;
export function surfaceAppBootstrapContract(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  options?: Record<string, unknown>,
): SurfaceAppBootstrapContract;
export function surfaceAppManifestSelection(
  manifest: Record<string, unknown>,
  surfaceAppsOrContracts: readonly (DefinedSurfaceApp | SurfaceAppContractShape)[] | Record<string, DefinedSurfaceApp | SurfaceAppContractShape>,
  options?: Record<string, unknown>,
): SurfaceAppManifestSelection;
export function surfaceAppContractResolution(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape | null | undefined,
  selection?: Record<string, unknown>,
  options?: Record<string, unknown>,
): SurfaceAppContractResolution;
export function surfaceAppSourceCandidatePosture(
  selectionOrOptions: Record<string, unknown>,
  options?: Record<string, unknown>,
): SurfaceAppSourceCandidatePosture;
export function surfaceAppDistributionPosture(
  selectionOrOptions: Record<string, unknown>,
  options?: Record<string, unknown>,
): SurfaceAppDistributionPosture;
export function surfaceAppRunnerPlanFromManifest(
  manifest: Record<string, unknown>,
  surfaceAppsOrContracts: readonly (DefinedSurfaceApp | SurfaceAppContractShape)[] | Record<string, DefinedSurfaceApp | SurfaceAppContractShape>,
  options?: Record<string, unknown>,
): SurfaceAppManifestRunnerPlan;
export function surfaceAppRuntimeSelectionPosture(
  manifest: Record<string, unknown>,
  surfaceAppsOrContracts: readonly (DefinedSurfaceApp | SurfaceAppContractShape)[] | Record<string, DefinedSurfaceApp | SurfaceAppContractShape>,
  options?: Record<string, unknown>,
): SurfaceAppRuntimeSelectionPosture;
export function surfaceAppRunnerPlan(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  options?: Record<string, unknown>,
): SurfaceAppRunnerPlan;

export function surfaceAppSelectionReadModel(options?: {
  surfaceApp?: DefinedSurfaceApp;
  surfaceAppContract?: SurfaceAppContractShape;
  contract?: SurfaceAppContractShape;
  manifest?: Record<string, unknown>;
  surfaceAppsOrContracts?: readonly (DefinedSurfaceApp | SurfaceAppContractShape)[] | Record<string, DefinedSurfaceApp | SurfaceAppContractShape>;
  moduleRegistry?: Record<string, unknown>;
  moduleRoles?: unknown;
  moduleBindingMode?: "bindings" | "implementations" | string;
  productSurface?: string;
  runtimeVersion?: string;
  runtimeSelectionPosture?: SurfaceAppRuntimeSelectionPosture;
  runtimeSelectionOptions?: Record<string, unknown>;
  moduleBindings?: Record<string, unknown>;
  moduleBindingPosture?: Record<string, unknown>;
  runnerPlan?: SurfaceAppRunnerPlan;
  runnerPlanOptions?: Record<string, unknown>;
  runnerFulfillmentReport?: Record<string, unknown>;
  fulfillmentIdentityPosture?: SurfaceAppFulfillmentIdentityPosture;
  fulfillmentIdentityOptions?: Record<string, unknown>;
  authorityAccessPosture?: SurfaceAppAuthorityAccessPosture;
  authorityAccessOptions?: Record<string, unknown>;
  serviceManagerSecretBoundary?: SurfaceServiceManagerSecretBoundary;
  bootstrapContract?: Record<string, unknown>;
  bootstrapPosture?: SurfaceAppBootstrapPosture;
  bootstrapPostureOptions?: Record<string, unknown>;
  serviceManagerOperationPosture?: SurfaceServiceManagerOperationPosture;
  serviceManagerOperationOptions?: Record<string, unknown>;
  serviceManagerProofDigest?: SurfaceServiceManagerProofDigest;
  serviceManagerProofDigestOptions?: Record<string, unknown>;
  appInstancePosture?: SurfaceAppInstancePosture;
  appInstanceOptions?: Record<string, unknown>;
  attachContextOptions?: Record<string, unknown>;
  issuedAt?: number;
  expiresAt?: unknown;
}): SurfaceAppSelectionReadModel;
export function surfaceModuleRolePosture(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  role: string,
  options?: { moduleRef?: string; primitiveRef?: string },
): SurfaceModuleRolePosture;
export function requireSurfaceModuleRole(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  role: string,
  options?: { moduleRef?: string; primitiveRef?: string },
): SurfaceAppModuleClaim;
export function surfaceMaterializationBudgetPosture(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  budgetId: string,
  options?: { payloadClass?: string; copyRole?: string; transferMode?: string },
): SurfaceMaterializationBudgetPosture;
export function requireSurfaceMaterializationBudget(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  budgetId: string,
  options?: { payloadClass?: string; copyRole?: string; transferMode?: string },
): Record<string, unknown>;
export function materializationBudgetLimit(
  budget: Record<string, unknown> | null | undefined,
  key: string,
  fallback?: number,
): number;
export function materializationBudgetUsage(
  budget: Record<string, unknown> | null | undefined,
  options?: Record<string, unknown>,
): Readonly<Record<string, unknown>>;
export function materializationBudgetRecord(
  budget: Record<string, unknown> | null | undefined,
  options?: Record<string, unknown>,
): Record<string, unknown>;
export function materializationConsumerFloorRecord(
  budget: Record<string, unknown> | null | undefined,
  options?: Record<string, unknown>,
): Record<string, unknown>;
export function materializationEventReplayPosture(
  budget: Record<string, unknown> | null | undefined,
  options?: Record<string, unknown>,
): Readonly<Record<string, unknown>>;
export function materializationEnforcementPosture(
  budget: Record<string, unknown> | null | undefined,
  options?: Record<string, unknown>,
): Readonly<Record<string, unknown>>;
export function defaultEventMaterializationKey(event: Record<string, unknown>): string;
export function defaultMergeMaterializedEvent(
  existing: Record<string, unknown>,
  next: Record<string, unknown>,
  options?: Record<string, unknown>,
): Record<string, unknown>;
export function materializeEventSet(options?: Record<string, unknown>): Readonly<{
  events: readonly unknown[];
  merge: Readonly<Record<string, unknown>>;
  replayPosture: Readonly<Record<string, unknown>>;
  consumerFloor: Readonly<Record<string, unknown>>;
  enforcementPosture: Readonly<Record<string, unknown>>;
  materializationBudget: Record<string, unknown>;
}>;

export * from "./surface-module-registry.js";
export * from "./service-surface-adapter.js";

export type ActionDescriptor = {
  id: string;
  label: string;
  pendingLabel?: string;
  description?: string;
  disabled?: boolean;
  hidden?: boolean;
  pending?: boolean;
  tone?: string;
  onSelect?: (action: ActionDescriptor) => void;
};

export type PreparedActionPayload<T = Record<string, unknown>> = {
  kind: string;
  actionId: string;
  recordId: string;
  record: T;
};

export type PreparedAction<TPayload = unknown> = {
  id: string;
  label: string;
  pendingLabel?: string;
  description?: string;
  disabled?: boolean;
  hidden?: boolean;
  pending?: boolean;
  tone?: string;
  payload?: TPayload;
  onSelect?: (payload: TPayload | PreparedActionPayload) => void;
};

export type PreparedCapabilityRecord<TPayload = unknown> = {
  id?: string;
  capability?: string;
  name?: string;
  label?: string;
  title?: string;
  namespace?: string;
  memberRef?: string;
  serviceRef?: string;
  scope?: string;
  status?: string;
  health?: string;
  freshness?: string;
  channels?: string[];
  channelIds?: string[];
  capabilities?: string[];
  actions?: Array<PreparedAction<TPayload>>;
};

export type PreparedChannelRecord<TPayload = unknown> = {
  id?: string;
  channelId?: string;
  label?: string;
  displayName?: string;
  name?: string;
  kind?: string;
  policy?: string;
  owner?: string;
  status?: string;
  freshness?: string;
  capabilities?: string[];
  capabilityRefs?: string[];
  recordKinds?: string[];
  actions?: Array<PreparedAction<TPayload>>;
};

export type FirstPartyShellOptions = {
  appName?: string;
  navItems?: Array<{ id: string; label: string; hidden?: boolean; active?: boolean }>;
  mainHtml?: string;
  panePath?: boolean;
  accountCenterTitle?: string;
};

export type FirstPartyShell = {
  root: HTMLDivElement;
  appNameEl: HTMLElement;
  panePathEl: HTMLElement | null;
  btnBellEl: HTMLButtonElement;
  notifMenuEl: HTMLElement;
  btnNotifClearEl: HTMLButtonElement;
  notifListEl: HTMLDivElement;
  btnMenuEl: HTMLButtonElement;
  drawerEl: HTMLElement;
  drawerBackdropEl: HTMLElement;
  btnDrawerCloseEl: HTMLButtonElement;
  drawerNavEl: HTMLElement;
  navButtons: HTMLButtonElement[];
  accountRailButtonEl: HTMLButtonElement;
  accountCenterMenuEl: HTMLElement;
  accountCenterSummaryEl: HTMLElement;
  accountCenterActionsEl: HTMLDivElement;
  identityHandleEl: HTMLSpanElement;
  connWrapEl: HTMLSpanElement;
  connStateTextEl: HTMLSpanElement;
  connPopoverEl: HTMLDivElement;
  popConnectionEl: HTMLSpanElement;
  popRelayEl: HTMLSpanElement;
  popGatewayEl: HTMLSpanElement;
  popServicesEl: HTMLSpanElement;
  popConnectionReasonEl: HTMLDivElement;
  mainEl: HTMLElement;
};

export type FirstPartyShellChromeController = {
  state: {
    drawerOpen: boolean;
    accountCenterOpen: boolean;
    notificationMenuOpen: boolean;
  };
  navButtonActivity(button: HTMLButtonElement): string;
  openDrawer(): void;
  closeDrawer(): void;
  openAccountCenter(): void;
  closeAccountCenter(): void;
  openNotificationMenu(): void;
  closeNotificationMenu(): void;
  closeTransientMenus(): void;
};

export function createViewModel<T>(initialValue: T): ViewModel<T>;
export function renderActionList(container: HTMLElement, actions?: ActionDescriptor[]): void;
export function setConnectionStateText(element: HTMLElement, options?: {
  label?: string;
  toneClass?: string;
}): void;
export function renderAccountCenterSummary(container: HTMLElement, options?: {
  handle?: string;
  linked?: boolean;
  connectionLabel?: string;
  connectionToneClass?: string;
}): void;
export type KeyValueRow = readonly [label: string, value: unknown];
export function createKeyValueGrid(rows?: KeyValueRow[]): HTMLDListElement;
export function createPanel(options?: { title?: string; hint?: string; className?: string }): {
  el: HTMLElement;
  titleEl: HTMLElement;
  hintEl: HTMLElement;
  bodyEl: HTMLElement;
};
export function createTile(options?: { title?: string; status?: string; className?: string }): {
  el: HTMLElement;
  titleEl: HTMLElement;
  statusEl: HTMLElement;
  bodyEl: HTMLElement;
  footerEl: HTMLElement;
};
export function createActionRow(options?: { label?: string; actions?: ActionDescriptor[] }): {
  el: HTMLElement;
  actionsEl: HTMLElement;
};
export type DataTableColumn<T = Record<string, unknown>> = {
  id: string;
  header?: string;
  label?: string;
  className?: string;
  align?: "start" | "center" | "end";
  hidden?: boolean;
  render?: (row: T, rowIndex: number, column: DataTableColumn<T>) => string | Node | Array<string | Node> | null | undefined;
};
export function renderDataTable<T = Record<string, unknown>>(container: HTMLElement, options?: {
  columns?: Array<DataTableColumn<T>>;
  rows?: T[];
  emptyLabel?: string;
  className?: string;
  getRowClassName?: (row: T, rowIndex: number) => string;
  renderExpandedRow?: (row: T, rowIndex: number) => string | Node | Array<string | Node> | null | undefined | false;
}): { wrap: HTMLElement; table: HTMLTableElement | null } | null;
export function renderPreparedCapabilityList<TPayload = unknown>(container: HTMLElement, options?: {
  records?: Array<PreparedCapabilityRecord<TPayload>>;
  emptyLabel?: string;
  onAction?: (payload: TPayload | PreparedActionPayload<PreparedCapabilityRecord<TPayload>>) => void;
}): { wrap: HTMLElement; items: HTMLElement[] } | null;
export function renderPreparedChannelList<TPayload = unknown>(container: HTMLElement, options?: {
  records?: Array<PreparedChannelRecord<TPayload>>;
  emptyLabel?: string;
  onAction?: (payload: TPayload | PreparedActionPayload<PreparedChannelRecord<TPayload>>) => void;
}): { wrap: HTMLElement; items: HTMLElement[] } | null;
export function renderProjectionSyncStatus<TPayload = unknown>(container: HTMLElement, options?: {
  projectionId?: string;
  revision?: string | number;
  stale?: boolean;
  gap?: boolean;
  pending?: boolean;
  pendingDeltas?: number;
  repair?: boolean;
  repairPending?: boolean;
  repairRequested?: boolean;
  lastAppliedAt?: string;
  actions?: Array<PreparedAction<TPayload>>;
  onAction?: (payload: TPayload | PreparedActionPayload) => void;
}): { wrap: HTMLElement } | null;
export function renderSwarmEdgeStatus<TPayload = unknown>(container: HTMLElement, options?: {
  queued?: number;
  sent?: number;
  rejected?: number;
  lastRejectReason?: string;
  connected?: boolean;
  mode?: string;
  actions?: Array<PreparedAction<TPayload>>;
  onAction?: (payload: TPayload | PreparedActionPayload) => void;
}): { wrap: HTMLElement } | null;
export function renderStreamStatus<TPayload = unknown>(container: HTMLElement, options?: {
  sessionId?: string;
  label?: string;
  state?: string;
  health?: string;
  transport?: string;
  recovering?: boolean;
  backoff?: string;
  updatedAt?: string;
  actions?: Array<PreparedAction<TPayload>>;
  onAction?: (payload: TPayload | PreparedActionPayload) => void;
}): { wrap: HTMLElement } | null;
export function renderFirstPartyShell(root: HTMLDivElement, options?: FirstPartyShellOptions): FirstPartyShell;
export function bindFirstPartyShellChrome(shell: FirstPartyShell, options?: {
  onNavSelect?: (activity: string, button: HTMLButtonElement) => void;
  onNotificationClear?: () => void;
  closeOnOutsideClick?: boolean;
  enableConnectionPopover?: boolean;
}): FirstPartyShellChromeController;

export type PreparedServiceRegistryService = {
  service: string;
  servicePk: string;
  devicePk: string;
  pk: string;
  hostGatewayPk: string;
  label: string;
  status: string;
  health: Record<string, unknown>;
  __registrySource: "serviceRegistry" | "serviceCatalog";
  [key: string]: unknown;
};

export type PreparedServiceRegistry = {
  source: "serviceRegistry" | "serviceCatalog";
  state: string;
  registryId: string;
  updatedAt: number;
  serviceCount: number;
  claimCount: number;
  participantCount: number;
  entryCount: number;
  blockedReasons: readonly string[];
  materializationPosture: Readonly<Record<string, unknown>>;
  services: readonly PreparedServiceRegistryService[];
};

export type PreparedServiceRegistryOptions = {
  clientId?: string;
  surface?: string;
  materializationBudget?: Record<string, unknown>;
  consumerFloor?: Record<string, unknown>;
};

export function preparedServiceRegistry(snapshot?: Record<string, unknown>, options?: PreparedServiceRegistryOptions): PreparedServiceRegistry;
export function preparedServiceRegistryServices(snapshot?: Record<string, unknown>, options?: PreparedServiceRegistryOptions): readonly PreparedServiceRegistryService[];

export * from "./projection-read-model.js";
export * from "./runtime-shell-state.js";
