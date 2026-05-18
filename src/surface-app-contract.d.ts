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
  releaseRef: string;
  rollbackRef: string;
  secretBoundary: Readonly<Record<string, unknown>>;
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

export type SurfaceServiceManagerProofDigest = {
  kind: "service.manager.proof.digest";
  digestId: string;
  operationId: string;
  managerId: string;
  subjectRef: string;
  state: string;
  trainRef: string;
  releaseRef: string;
  rollbackRef: string;
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
