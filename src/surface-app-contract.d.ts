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
  materializationBudgets?: unknown[];
  updatePosture?: Record<string, unknown>;
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
  updatePosture?: Record<string, unknown>;
  [key: string]: unknown;
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
