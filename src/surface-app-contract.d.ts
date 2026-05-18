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
  serviceRef?: string;
  surfaceRef?: string;
  version: string;
  displayName?: string;
  requiredPrimitives?: string[];
  requiredModuleRoles?: string[];
  modules?: SurfaceAppModuleClaim[];
  projectionSubscriptions?: unknown[];
  permissionRequirements?: unknown[];
  capabilityRequirements?: unknown[];
  materializationBudgets?: Record<string, unknown>[];
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
  serviceRef: string;
  surfaceRef: string;
  version: string;
  displayName: string;
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

export type SurfaceAppBootstrapPosture = {
  kind: "surface.app.bootstrap.posture";
  bootstrapId: string;
  contractId: string;
  appId: string;
  state: "ready" | "degraded" | "blocked";
  sourceMode: string;
  moduleRefs: string[];
  serviceManagerRef: string;
  serviceManagerPosture: Readonly<Record<string, unknown>>;
  secretBoundary: Readonly<Record<string, unknown>>;
  releasePosture: Readonly<Record<string, unknown>>;
  rollbackPosture?: Readonly<Record<string, unknown>>;
  blockedReasons: string[];
  evidenceRefs: string[];
  issuedAt: number;
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
  releaseRef: string;
  rollbackRef: string;
  secretBoundary: Readonly<Record<string, unknown>>;
  releasePosture?: Readonly<Record<string, unknown>>;
  rollbackPosture?: Readonly<Record<string, unknown>>;
  resourceBudget?: Readonly<Record<string, unknown>>;
  resourcePosture?: Readonly<Record<string, unknown>>;
  evidenceRefs: string[];
  proofRefs: string[];
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
  compatibilityRefs: string[];
  bootstrapContractRef: string;
  releaseContractRef: string;
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

export function defineSurfaceAppContract(
  contract: SurfaceAppContractShape,
  options?: { validate?: (contract: SurfaceAppContractShape) => SurfaceAppContractShape },
): DefinedSurfaceApp;

export function surfaceAppContractPosture(surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape): SurfaceAppPosture;

export function surfaceAppAttachContext(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  extra?: Record<string, unknown>,
): SurfaceAppAttachContext;
export function surfaceAppBootstrapPosture(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  options?: Record<string, unknown>,
): SurfaceAppBootstrapPosture;
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
export function surfaceAppRunnerPlanFromManifest(
  manifest: Record<string, unknown>,
  surfaceAppsOrContracts: readonly (DefinedSurfaceApp | SurfaceAppContractShape)[] | Record<string, DefinedSurfaceApp | SurfaceAppContractShape>,
  options?: Record<string, unknown>,
): SurfaceAppManifestRunnerPlan;
export function surfaceAppRunnerPlan(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  options?: Record<string, unknown>,
): SurfaceAppRunnerPlan;

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
