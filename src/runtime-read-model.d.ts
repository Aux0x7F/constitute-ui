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
  edge: Readonly<Record<string, unknown>>;
  serviceRegistry: Readonly<Record<string, unknown>>;
  projection: Readonly<Record<string, unknown>>;
  materialization: Readonly<Record<string, unknown>>;
  resource: Readonly<Record<string, unknown>>;
  retention: Readonly<Record<string, unknown>>;
}>;

export function prepareRuntimeReadModel(
  snapshot?: Record<string, unknown>,
  options?: RuntimeReadModelOptions,
): RuntimeSurfaceReadModel;
