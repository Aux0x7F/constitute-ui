export type RuntimeShellStorageLike = {
  getItem?: (key: string) => string | null;
};

export type RuntimeShellDeriveOptions = {
  context?: Record<string, unknown>;
  identityId?: string;
  devicePk?: string;
  adapterLive?: boolean;
  routeDelivered?: boolean;
  serviceAccepted?: boolean;
  connectionLabel?: string;
  connectionReason?: string;
  productRunlevel?: string;
  activeInteraction?: Record<string, unknown>;
  materializationBudget?: Record<string, unknown>;
  consumerFloor?: Record<string, unknown>;
};

export function browserStorageShellContext(storage?: RuntimeShellStorageLike): Record<string, unknown>;
export function runtimeShellConnectionToneClass(code?: string): string;
export function deriveRuntimeMaterializationPosture(
  snapshot?: Record<string, unknown>,
  options?: RuntimeShellDeriveOptions,
): Readonly<{
  kind: "runtime.materialization.posture";
  state: string;
  reason: string;
  budgetId: string;
  budgetCount: number;
  consumerFloorId: string;
  lagState: string;
  fanout: number;
  projectionCount: number;
  runtimeEventCount: number;
  estimatedSnapshotBytes: number;
  replayLimit: number;
  copyRole: string;
  payloadClass: string;
  privacyTier: string;
  blockedReasons: readonly string[];
}>;
export function deriveRuntimeShellState(
  snapshot?: Record<string, unknown>,
  options?: RuntimeShellDeriveOptions,
): Readonly<{
  runlevel: string;
  identity: Readonly<Record<string, unknown>>;
  connection: Readonly<Record<string, unknown>>;
  relay: Readonly<Record<string, unknown>>;
  gateway: Readonly<Record<string, unknown>>;
  services: Readonly<Record<string, unknown>>;
  projections: Readonly<Record<string, unknown>>;
  resource: Readonly<Record<string, unknown>>;
  materialization: Readonly<Record<string, unknown>>;
  retention: Readonly<Record<string, unknown>>;
  interaction: Readonly<Record<string, unknown>>;
}>;
