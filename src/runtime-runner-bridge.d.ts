export type RuntimeRunnerDispatch = {
  kind?: string;
  dispatchId?: string;
  state?: string;
  operationId?: string;
  runnerOperation?: Record<string, unknown>;
  hostFulfillmentPosture?: Record<string, unknown>;
};

export type RuntimeRunnerBridgePosture = {
  kind: "runtime.runner.bridge.posture";
  state: "idle" | "succeeded" | "blocked";
  bridgeRef: string;
  runtimeRef: string;
  adapterRef: string;
  dispatchId: string;
  operationId: string;
  fulfilledCount: number;
  skippedCount: number;
  blockedReasons: string[];
  safeFacts?: Record<string, unknown>;
  observedAt: number;
};

export type RuntimeRunnerBridge = {
  processSnapshot(snapshot?: { runnerOperations?: Record<string, RuntimeRunnerDispatch> | RuntimeRunnerDispatch[] }): Promise<RuntimeRunnerBridgePosture>;
  markUnreported(dispatchId: string): void;
  readonly posture: RuntimeRunnerBridgePosture;
};

export function createRuntimeRunnerBridge(options: {
  runtimeClient: {
    snapshot?: Record<string, unknown>;
    putRunnerHostFulfillmentPosture?: (
      hostFulfillmentPosture: Record<string, unknown>,
      runtimeReportMessage: {
        type: string;
        hostFulfillmentPosture: Record<string, unknown>;
        fulfillmentSession?: Record<string, unknown>;
        fulfillmentSessionProjection?: Record<string, unknown>;
      },
      dispatch: RuntimeRunnerDispatch,
    ) => unknown | Promise<unknown>;
  };
  fulfillDispatch: (input: {
    dispatch: RuntimeRunnerDispatch;
    runnerOperation: Record<string, unknown>;
    snapshot: Record<string, unknown>;
    bridgeRef: string;
    runtimeRef: string;
    adapterRef: string;
  }) => unknown | Promise<unknown>;
  selectDispatches?: (snapshot: Record<string, unknown>) => RuntimeRunnerDispatch[];
  reportHostFulfillment?: (
    hostFulfillmentPosture: Record<string, unknown>,
    runtimeReportMessage: {
      type: string;
      hostFulfillmentPosture: Record<string, unknown>;
      fulfillmentSession?: Record<string, unknown>;
      fulfillmentSessionProjection?: Record<string, unknown>;
    },
    dispatch: RuntimeRunnerDispatch,
  ) => unknown | Promise<unknown>;
  bridgeRef?: string;
  runtimeRef?: string;
  adapterRef?: string;
  safeFacts?: Record<string, unknown>;
  onPosture?: (posture: RuntimeRunnerBridgePosture) => void;
  now?: () => number;
}): RuntimeRunnerBridge;
