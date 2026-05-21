export type RuntimeStreamPosture = {
  sessionCount: number;
  waitingRouteCount: number;
  waitingServiceAcceptanceCount: number;
  serviceAdmissionTimedOutCount: number;
  waitingAnswerCount: number;
  rejectedCount: number;
  answerReceivedCount: number;
  mediaBlockedCount: number;
  mediaUsableCount: number;
  mediaReleasedCount: number;
  expiresAt: number;
};

export declare function runtimeRecordRefId(value: unknown): string;
export declare function collectRuntimeIntentResultKeys(result: unknown): Set<string>;
export declare function collectRuntimeStreamFrameKeys(frame?: Record<string, unknown>, record?: Record<string, unknown>): Set<string>;
export declare function collectRuntimeObservationKeys(observation?: Record<string, unknown>): Set<string>;
export declare function collectRuntimeActivationKeys(activation?: Record<string, unknown>): Set<string>;
export declare function collectRuntimeMediaFulfillmentKeys(posture?: Record<string, unknown>): Set<string>;
export declare function runtimeIntentSource(result: unknown): Record<string, unknown>;
export declare function runtimeIntentFrameId(result: unknown): string;
export declare function runtimeIntentWaitingAuthority(result: unknown): boolean;
export declare function runtimeIntentState(result: unknown): string;
export declare function runtimeIntentPendingRoute(result: unknown): boolean;
export declare function applyRuntimeActivationPostureToStreamSession(session: Record<string, unknown>, activation?: Record<string, unknown>): string;
export declare function applyRuntimeStreamLifecycleToStreamSession(session: Record<string, unknown>, lifecycle?: Record<string, unknown>): string;
export declare function applyRuntimeMediaFulfillmentPostureToStreamSession(session: Record<string, unknown>, posture?: Record<string, unknown>): string;
export declare function runtimeStreamSessionPosture(sessions?: Array<Record<string, unknown>>): RuntimeStreamPosture;
