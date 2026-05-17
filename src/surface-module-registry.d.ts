import type {
  DefinedSurfaceApp,
  SurfaceAppContractShape,
  SurfaceAppModuleClaim,
} from "./surface-app-contract.js";

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
    surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
    role: string,
    options?: { moduleRef?: string; primitiveRef?: string },
  ): SurfaceModuleRegistryPosture<TImplementation>;
  require(
    surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
    role: string,
    options?: { moduleRef?: string; primitiveRef?: string },
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
  claim: SurfaceAppModuleClaim | null;
  implementation: SurfaceModuleImplementation<TImplementation> | null;
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
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  role: string,
  options?: { moduleRef?: string; primitiveRef?: string },
): SurfaceModuleRegistryPosture<TImplementation>;

export function requireSurfaceModuleImplementation<TImplementation = unknown>(
  registry: SurfaceModuleRegistry<TImplementation>,
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  role: string,
  options?: { moduleRef?: string; primitiveRef?: string },
): SurfaceModuleImplementation<TImplementation>;

export function surfaceAppModuleImplementations<TImplementation = unknown>(
  registry: SurfaceModuleRegistry<TImplementation>,
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  roles?: string[],
): SurfaceAppModuleImplementationPosture<TImplementation>;
