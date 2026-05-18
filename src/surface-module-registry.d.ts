import type {
  DefinedSurfaceApp,
  SurfaceAppContractShape,
  SurfaceAppRuntimeSelectionPosture,
  SurfaceAppModuleClaim,
} from "./surface-app-contract.js";

export type SurfaceModuleResolutionSource =
  | DefinedSurfaceApp
  | SurfaceAppContractShape
  | SurfaceAppRuntimeSelectionPosture;

export type SurfaceModuleResolutionOptions = {
  moduleRef?: string;
  primitiveRef?: string;
  allowRemote?: boolean;
};

export type SurfaceModuleImplementation<TImplementation = unknown> = {
  moduleRef: string;
  role: string;
  version?: string;
  primitiveRefs?: string[];
  requiredCapabilities?: string[];
  implementation?: TImplementation;
  factory?: (...args: unknown[]) => TImplementation;
  [key: string]: unknown;
};

export type SurfaceModuleRegistry<TImplementation = unknown> = {
  kind: "surface.module.registry";
  entries: readonly SurfaceModuleImplementation<TImplementation>[];
  has(moduleRef: string): boolean;
  get(moduleRef: string): SurfaceModuleImplementation<TImplementation> | null;
  role(role: string): readonly SurfaceModuleImplementation<TImplementation>[];
  resolve(
    surfaceAppOrContract: SurfaceModuleResolutionSource,
    role: string,
    options?: SurfaceModuleResolutionOptions,
  ): SurfaceModuleRegistryPosture<TImplementation>;
  require(
    surfaceAppOrContract: SurfaceModuleResolutionSource,
    role: string,
    options?: SurfaceModuleResolutionOptions,
  ): SurfaceModuleImplementation<TImplementation>;
};

export type SurfaceModuleRegistryPosture<TImplementation = unknown> = {
  kind: "surface.module.registry.posture";
  state: "ready" | "blocked";
  blockedReason: string;
  role: string;
  moduleRef: string;
  implementationRef: string;
  fallbackRefs: readonly string[];
  fallbackTried: readonly string[];
  sourceMode: string;
  sourcePosture: Readonly<Record<string, unknown>> | null;
  runtimeSelectionPosture: SurfaceAppRuntimeSelectionPosture | null;
  claim: SurfaceAppModuleClaim | null;
  implementation: SurfaceModuleImplementation<TImplementation> | null;
};

export type SurfaceModuleBinding<TImplementation = unknown> = {
  kind: "surface.module.binding";
  state: "ready" | "blocked";
  blockedReason: string;
  role: string;
  moduleRef: string;
  implementationRef: string;
  version: string;
  participantSide: string;
  fulfillmentMode: string;
  primitiveRefs: readonly string[];
  requiredCapabilities: readonly string[];
  inputs: readonly string[];
  outputs: readonly string[];
  fallbackRefs: readonly string[];
  fallbackTried: readonly string[];
  sourceMode: string;
  sourcePosture: Readonly<Record<string, unknown>> | null;
  runtimeSelectionPosture: SurfaceAppRuntimeSelectionPosture | null;
  claim: SurfaceAppModuleClaim | null;
  implementationRecord: SurfaceModuleImplementation<TImplementation> | null;
  implementation: TImplementation | null;
};

export type SurfaceAdapterBindingPosture<TImplementation = unknown> = {
  kind: "surface.adapter.binding.posture";
  state: "ready" | "blocked";
  blockedReason: string;
  blockedReasons: readonly string[];
  role: string;
  taxonomyKey: string;
  moduleRef: string;
  implementationRef: string;
  version: string;
  participantSide: string;
  fulfillmentMode: string;
  primitiveRefs: readonly string[];
  requiredCapabilities: readonly string[];
  evidenceChannels: readonly string[];
  lifecycle: Readonly<Record<string, unknown>>;
  transportProfileRefs: readonly string[];
  renderEvidenceBudgetRef: string;
  materializationBudgetRefs: readonly string[];
  releaseRefs: readonly string[];
  sourceMode: string;
  sourcePosture: Readonly<Record<string, unknown>> | null;
  runtimeSelectionPosture: SurfaceAppRuntimeSelectionPosture | null;
  moduleBinding: SurfaceModuleBinding<TImplementation>;
};

export type SurfaceAppModuleBindings<TImplementation = unknown> = {
  kind: "surface.app.module.bindings";
  state: "ready" | "blocked";
  blockedReason: string;
  roles: readonly string[];
  keys: readonly string[];
  bindings: readonly Array<SurfaceModuleBinding<TImplementation> & { key: string }>;
  postures: readonly Array<SurfaceModuleBinding<TImplementation> & { key: string }>;
  byKey: Readonly<Record<string, SurfaceModuleBinding<TImplementation> & { key: string }>>;
  byRole: Readonly<Record<string, readonly Array<SurfaceModuleBinding<TImplementation> & { key: string }>>>;
  implementations: readonly TImplementation[];
  blockedReasons: readonly string[];
};

export type SurfaceAppModuleImplementationPosture<TImplementation = unknown> = {
  kind: "surface.app.module.implementations";
  state: "ready" | "blocked";
  blockedReason: string;
  roles: readonly string[];
  postures: readonly SurfaceModuleRegistryPosture<TImplementation>[];
  implementations: readonly SurfaceModuleImplementation<TImplementation>[];
};

export function createSurfaceModuleRegistry<TImplementation = unknown>(
  entries?: Array<SurfaceModuleImplementation<TImplementation>>,
): SurfaceModuleRegistry<TImplementation>;

export function surfaceModuleRegistryPosture<TImplementation = unknown>(
  registry: SurfaceModuleRegistry<TImplementation>,
  surfaceAppOrContract: SurfaceModuleResolutionSource,
  role: string,
  options?: SurfaceModuleResolutionOptions,
): SurfaceModuleRegistryPosture<TImplementation>;

export function requireSurfaceModuleImplementation<TImplementation = unknown>(
  registry: SurfaceModuleRegistry<TImplementation>,
  surfaceAppOrContract: SurfaceModuleResolutionSource,
  role: string,
  options?: SurfaceModuleResolutionOptions,
): SurfaceModuleImplementation<TImplementation>;

export function surfaceModuleBinding<TImplementation = unknown>(
  registry: SurfaceModuleRegistry<TImplementation>,
  surfaceAppOrContract: SurfaceModuleResolutionSource,
  role: string,
  options?: SurfaceModuleResolutionOptions,
): SurfaceModuleBinding<TImplementation>;

export function surfaceAdapterBindingPosture<TImplementation = unknown>(
  registry: SurfaceModuleRegistry<TImplementation>,
  surfaceAppOrContract: SurfaceModuleResolutionSource,
  options?: SurfaceModuleResolutionOptions & {
    role?: string;
    blockedReasons?: readonly string[];
    evidenceChannels?: readonly string[];
    lifecycle?: Readonly<Record<string, unknown>>;
    materializationBudgetRefs?: readonly string[];
    releaseRefs?: readonly string[];
    transportProfileRefs?: readonly string[];
    renderEvidenceBudgetRef?: string;
  },
): SurfaceAdapterBindingPosture<TImplementation>;

export function surfacePlatformAdapterBindingPosture<TImplementation = unknown>(
  registry: SurfaceModuleRegistry<TImplementation>,
  surfaceAppOrContract: SurfaceModuleResolutionSource,
  options?: SurfaceModuleResolutionOptions & {
    role?: string;
    blockedReasons?: readonly string[];
    evidenceChannels?: readonly string[];
    lifecycle?: Readonly<Record<string, unknown>>;
    materializationBudgetRefs?: readonly string[];
    releaseRefs?: readonly string[];
    transportProfileRefs?: readonly string[];
    renderEvidenceBudgetRef?: string;
  },
): SurfaceAdapterBindingPosture<TImplementation>;

export function surfaceServiceSurfaceAdapterBindingPosture<TImplementation = unknown>(
  registry: SurfaceModuleRegistry<TImplementation>,
  surfaceAppOrContract: SurfaceModuleResolutionSource,
  options?: SurfaceModuleResolutionOptions & {
    role?: string;
    blockedReasons?: readonly string[];
    evidenceChannels?: readonly string[];
    lifecycle?: Readonly<Record<string, unknown>>;
    materializationBudgetRefs?: readonly string[];
    releaseRefs?: readonly string[];
    transportProfileRefs?: readonly string[];
    renderEvidenceBudgetRef?: string;
  },
): SurfaceAdapterBindingPosture<TImplementation>;

export function surfaceServiceEdgeAdapterBindingPosture<TImplementation = unknown>(
  registry: SurfaceModuleRegistry<TImplementation>,
  surfaceAppOrContract: SurfaceModuleResolutionSource,
  options?: SurfaceModuleResolutionOptions & {
    role?: string;
    blockedReasons?: readonly string[];
    evidenceChannels?: readonly string[];
    lifecycle?: Readonly<Record<string, unknown>>;
    materializationBudgetRefs?: readonly string[];
    releaseRefs?: readonly string[];
    transportProfileRefs?: readonly string[];
    renderEvidenceBudgetRef?: string;
  },
): SurfaceAdapterBindingPosture<TImplementation>;

export function requireSurfaceModuleBinding<TImplementation = unknown>(
  registry: SurfaceModuleRegistry<TImplementation>,
  surfaceAppOrContract: SurfaceModuleResolutionSource,
  role: string,
  options?: SurfaceModuleResolutionOptions,
): SurfaceModuleBinding<TImplementation>;

export function surfaceAppModuleBindings<TImplementation = unknown>(
  registry: SurfaceModuleRegistry<TImplementation>,
  surfaceAppOrContract: SurfaceModuleResolutionSource,
  roleMapOrRoles?: readonly string[] | Record<string, string | { role: string; options?: SurfaceModuleResolutionOptions }>,
): SurfaceAppModuleBindings<TImplementation>;

export function surfaceAppModuleImplementations<TImplementation = unknown>(
  registry: SurfaceModuleRegistry<TImplementation>,
  surfaceAppOrContract: SurfaceModuleResolutionSource,
  roles?: string[],
): SurfaceAppModuleImplementationPosture<TImplementation>;
