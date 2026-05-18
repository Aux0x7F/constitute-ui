export type ServiceSurfaceAdapterPosture = {
  kind: "surface.serviceSurface.adapter.posture";
  state: string;
  blockedReason: string;
  blockedReasons: readonly string[];
  moduleRef: string;
  implementationRef: string;
  role: string;
  participantSide: string;
  primitiveRefs: readonly string[];
  actionRefs: readonly string[];
  projectionRefs: readonly string[];
  materializationBudgetRefs: readonly string[];
  releaseRefs: readonly string[];
  lifecycle: Readonly<Record<string, unknown>>;
  defaultTimeoutMs: number;
  issuedAt: number;
  expiresAt?: unknown;
};

export type ServiceSurfaceAdapter = {
  kind: "surface.serviceSurface.adapter";
  moduleRef: string;
  posture: ServiceSurfaceAdapterPosture;
  timeoutMs(action: string): number;
  request(action: string, payload?: Record<string, unknown>): Promise<Record<string, unknown>>;
};

export function serviceSurfaceAdapterPosture(
  bindingPosture?: Record<string, unknown>,
  options?: Record<string, unknown>,
): ServiceSurfaceAdapterPosture;

export function serviceSurfaceActionTimeoutMs(
  action: string,
  options?: {
    defaultTimeoutMs?: number;
    actionTimeoutMs?: Record<string, number>;
  },
): number;

export function normalizeServiceSurfaceAdapterError(error: unknown, fallback?: string): string;

export function createServiceSurfaceAdapter(options?: {
  moduleRef?: string;
  bindingPosture?: Record<string, unknown>;
  defaultTimeoutMs?: number;
  actionTimeoutMs?: Record<string, number>;
  primitiveRefs?: readonly string[];
  actionRefs?: readonly string[];
  projectionRefs?: readonly string[];
  materializationBudgetRefs?: readonly string[];
  releaseRefs?: readonly string[];
  lifecycle?: Record<string, unknown>;
  publishRuntimeIntent?: (action: string, payload: Record<string, unknown>, timeoutMs: number) => Promise<unknown>;
  projectionFallback?: (
    action: string,
    payload: Record<string, unknown>,
    posture: ServiceSurfaceAdapterPosture,
  ) => Record<string, unknown>;
  normalizeError?: (
    error: unknown,
    context: { action: string; payload: Record<string, unknown>; posture: ServiceSurfaceAdapterPosture },
  ) => string;
}): ServiceSurfaceAdapter;
