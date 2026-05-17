export type ProjectionSelection = {
  projection: Record<string, unknown> | null;
  exact: Record<string, unknown> | null;
  latest: Record<string, unknown> | null;
  examined: number;
  matched: number;
  policyId: string;
  nodePath: string;
  backingChannel: string;
  channelAdapter: string;
};

export type ProjectionCoverage = {
  materializedCount: number;
  targetCount: number;
  completionRatio: number;
  completeSeverityBands: unknown[];
  oldestObservedAt: number;
  newestObservedAt: number;
  syncState: string;
};

export type ProjectionPostureSummary = {
  projectionCount: number;
  coverageCount: number;
  coverageCounts: Record<string, number>;
  stateLabel: string;
};

export function projectionRuntimeKey(projection: Record<string, unknown> | null | undefined, fallback?: string): string;
export function projectionNodePath(projection: Record<string, unknown> | null | undefined, options?: { channelMap?: Record<string, string> }): string;
export function projectionRecordPolicyId(projection: Record<string, unknown> | null | undefined): string;
export function projectionUpdatedAt(projection: Record<string, unknown> | null | undefined): number;
export function projectionDeltaFor(projection: Record<string, unknown> | null | undefined): Record<string, unknown> | null;
export function selectProjectionForNode(
  projections: Record<string, unknown> | unknown[] | null | undefined,
  nodePath: string,
  options?: {
    policyId?: string;
    backingChannel?: string;
    channelMap?: Record<string, string>;
  },
): ProjectionSelection;
export function projectionForNode(
  projections: Record<string, unknown> | unknown[] | null | undefined,
  nodePath: string,
  options?: {
    policyId?: string;
    backingChannel?: string;
    channelMap?: Record<string, string>;
  },
): Record<string, unknown> | null;
export function projectionCoverage(projection: Record<string, unknown> | null | undefined, options?: {
  materializedFallback?: number;
  targetFallback?: number;
  syncStateFallback?: string;
}): ProjectionCoverage;
export function projectionRepairFor(projection: Record<string, unknown> | null | undefined, options?: {
  nodePath?: string;
  channelMap?: Record<string, string>;
  service?: string;
  repairRequests?: unknown[];
  localRepairRequests?: Map<string, unknown>;
}): Record<string, unknown> | null;
export function projectionPostureSummary(snapshotOrProjections?: Record<string, unknown>): ProjectionPostureSummary;
