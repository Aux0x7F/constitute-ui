import type {
  DefinedSurfaceApp,
  SurfaceAppAttachContext,
  SurfaceAppAuthorityAccessPosture,
  SurfaceAppBootstrapPosture,
  SurfaceAppContractShape,
  SurfaceAppFulfillmentIdentityPosture,
  SurfaceAppInstancePosture,
  SurfaceAppReleaseResolution,
  SurfaceAppRuntimeSelectionPosture,
  SurfaceAppRunnerFulfillmentLifecycle,
  SurfaceAppRunnerFulfillmentReadiness,
  SurfaceAppRunnerPlan,
  SurfaceRunnerOperation,
  SurfaceServiceManagerOperationPosture,
  SurfaceServiceManagerProofDigest,
  SurfaceServiceManagerSecretBoundary,
} from "./surface-app-contract";

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
  releaseResolution: SurfaceAppReleaseResolution | null;
  moduleBindings: Readonly<Record<string, unknown>> | null;
  runnerPlan: SurfaceAppRunnerPlan;
  moduleLoadRunnerOperation: SurfaceRunnerOperation | null;
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
  moduleLoadRunnerOperation?: SurfaceRunnerOperation | null;
  moduleLoadRunnerOptions?: Record<string, unknown>;
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
