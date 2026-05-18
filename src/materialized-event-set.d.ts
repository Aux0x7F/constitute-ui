export function defaultEventMaterializationKey(event: Record<string, unknown>): string;
export function defaultMergeMaterializedEvent(
  existing: Record<string, unknown>,
  next: Record<string, unknown>,
  options?: Record<string, unknown>,
): Record<string, unknown>;
export function materializeEventSet(options?: Record<string, unknown>): Readonly<{
  events: readonly unknown[];
  merge: Readonly<Record<string, unknown>>;
  replayPosture: Readonly<Record<string, unknown>>;
  consumerFloor: Readonly<Record<string, unknown>>;
  enforcementPosture: Readonly<Record<string, unknown>>;
  materializationBudget: Record<string, unknown>;
}>;
