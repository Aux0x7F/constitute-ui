const TERMINAL_DISPATCH_STATES = new Set([
  "blocked",
  "cancelled",
  "failed",
  "rejected",
  "released",
  "succeeded",
]);

function asEntries(container) {
  if (!container) return [];
  if (Array.isArray(container)) return container.filter((entry) => entry && typeof entry === "object");
  if (typeof container === "object") return Object.values(container).filter((entry) => entry && typeof entry === "object");
  return [];
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function dispatchOperationId(dispatch) {
  return String(dispatch?.operationId || dispatch?.runnerOperation?.operationId || "").trim();
}

function dispatchIdFor(dispatch) {
  const operationId = dispatchOperationId(dispatch);
  return String(dispatch?.dispatchId || (operationId ? `runtime-runner-dispatch:${operationId}` : "")).trim();
}

function dispatchState(dispatch) {
  return String(
    dispatch?.state
      || dispatch?.hostFulfillmentPosture?.state
      || dispatch?.runnerOperation?.state
      || "",
  ).trim();
}

function defaultDispatches(snapshot) {
  return asEntries(snapshot?.runnerOperations);
}

function normalizeFulfillmentReport(value) {
  const report = value?.runtimeReportMessage && typeof value.runtimeReportMessage === "object"
    ? value.runtimeReportMessage
    : (value?.hostFulfillmentPosture && typeof value.hostFulfillmentPosture === "object"
      ? { type: "runtime.runner.host.fulfillment.put", hostFulfillmentPosture: value.hostFulfillmentPosture }
      : value);
  if (!report || typeof report !== "object") return null;
  const hostFulfillmentPosture = report.hostFulfillmentPosture && typeof report.hostFulfillmentPosture === "object"
    ? report.hostFulfillmentPosture
    : null;
  if (!hostFulfillmentPosture) return null;
  return {
    ...report,
    type: String(report.type || "runtime.runner.host.fulfillment.put"),
    hostFulfillmentPosture,
  };
}

function bridgePosture(state, fields = {}) {
  const safeFacts = isObject(fields.safeFacts) ? fields.safeFacts : null;
  return {
    kind: "runtime.runner.bridge.posture",
    state,
    bridgeRef: String(fields.bridgeRef || "runtime-runner-bridge:surface-adapter"),
    runtimeRef: String(fields.runtimeRef || ""),
    adapterRef: String(fields.adapterRef || "adapter:runtime.runner.bridge"),
    dispatchId: String(fields.dispatchId || ""),
    operationId: String(fields.operationId || ""),
    fulfilledCount: Number(fields.fulfilledCount || 0),
    skippedCount: Number(fields.skippedCount || 0),
    blockedReasons: Array.isArray(fields.blockedReasons) ? fields.blockedReasons.filter(Boolean) : [],
    ...(safeFacts ? { safeFacts: { ...safeFacts } } : {}),
    observedAt: Number(fields.observedAt || Date.now()),
  };
}

export function createRuntimeRunnerBridge({
  runtimeClient,
  fulfillDispatch,
  selectDispatches = defaultDispatches,
  reportHostFulfillment,
  bridgeRef = "runtime-runner-bridge:surface-adapter",
  runtimeRef = "",
  adapterRef = "adapter:runtime.runner.bridge",
  safeFacts = {},
  onPosture,
  now = () => Date.now(),
} = {}) {
  if (!runtimeClient || typeof runtimeClient !== "object") {
    throw new Error("runtimeClient is required");
  }
  if (typeof fulfillDispatch !== "function") {
    throw new Error("fulfillDispatch adapter is required");
  }
  const report = typeof reportHostFulfillment === "function"
    ? reportHostFulfillment
    : runtimeClient.putRunnerHostFulfillmentPosture?.bind(runtimeClient);
  if (typeof report !== "function") {
    throw new Error("runtime host fulfillment reporter is required");
  }
  const reported = new Set();
  const inFlight = new Set();
  const baseSafeFacts = isObject(safeFacts) ? { ...safeFacts } : {};
  let currentPosture = bridgePosture("idle", {
    bridgeRef,
    runtimeRef,
    adapterRef,
    safeFacts: baseSafeFacts,
    observedAt: now(),
  });

  const setPosture = (state, fields = {}) => {
    currentPosture = bridgePosture(state, {
      bridgeRef,
      runtimeRef,
      adapterRef,
      observedAt: now(),
      ...fields,
      safeFacts: {
        ...baseSafeFacts,
        ...(isObject(fields.safeFacts) ? fields.safeFacts : {}),
      },
    });
    if (typeof onPosture === "function") onPosture(currentPosture);
    return currentPosture;
  };

  const processSnapshot = async (snapshot = runtimeClient.snapshot || {}) => {
    const dispatches = Array.isArray(selectDispatches(snapshot))
      ? selectDispatches(snapshot)
      : [];
    let fulfilledCount = 0;
    let skippedCount = 0;
    const blockedReasons = [];

    for (const dispatch of dispatches) {
      const dispatchId = dispatchIdFor(dispatch);
      const operationId = dispatchOperationId(dispatch);
      const state = dispatchState(dispatch);
      if (!dispatchId || !operationId) {
        skippedCount += 1;
        blockedReasons.push("runtimeRunnerBridge:missingDispatchRef");
        continue;
      }
      if (reported.has(dispatchId) || inFlight.has(dispatchId) || TERMINAL_DISPATCH_STATES.has(state)) {
        skippedCount += 1;
        continue;
      }
      if (!dispatch.runnerOperation || typeof dispatch.runnerOperation !== "object") {
        skippedCount += 1;
        blockedReasons.push(`runtimeRunnerBridge:${dispatchId}:missingRunnerOperation`);
        continue;
      }
      inFlight.add(dispatchId);
      try {
        const fulfillment = await fulfillDispatch({
          dispatch,
          runnerOperation: dispatch.runnerOperation,
          snapshot,
          bridgeRef,
          runtimeRef,
          adapterRef,
        });
        const runtimeReportMessage = normalizeFulfillmentReport(fulfillment);
        if (!runtimeReportMessage) {
          blockedReasons.push(`runtimeRunnerBridge:${dispatchId}:missingRuntimeReport`);
          continue;
        }
        await report(runtimeReportMessage.hostFulfillmentPosture, runtimeReportMessage, dispatch);
        reported.add(dispatchId);
        fulfilledCount += 1;
      } catch (error) {
        blockedReasons.push(`runtimeRunnerBridge:${dispatchId}:${String(error?.message || error || "failed")}`);
      } finally {
        inFlight.delete(dispatchId);
      }
    }

    if (blockedReasons.length) {
      return setPosture("blocked", { fulfilledCount, skippedCount, blockedReasons });
    }
    return setPosture(fulfilledCount ? "succeeded" : "idle", { fulfilledCount, skippedCount });
  };

  return {
    processSnapshot,
    markUnreported(dispatchId) {
      reported.delete(String(dispatchId || "").trim());
    },
    get posture() {
      return currentPosture;
    },
  };
}
