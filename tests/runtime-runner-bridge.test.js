import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimeRunnerBridge } from "../src/runtime-runner-bridge.js";

function acceptedDispatch(operationId = "runner-operation:module-load:test") {
  return {
    kind: "runtime.runner.operation.dispatch",
    dispatchId: `runtime-runner-dispatch:${operationId}`,
    state: "accepted",
    operationId,
    runnerOperation: {
      kind: "runner.operation",
      operationId,
      state: "accepted",
      inputRefs: ["artifact:test", "materialized:path:test", "storage:test"],
    },
  };
}

test("runtime runner bridge fulfills accepted dispatch and reports posture to runtime client", async () => {
  const dispatch = acceptedDispatch();
  const reported = [];
  const runtimeClient = {
    snapshot: { runnerOperations: { [dispatch.operationId]: dispatch } },
    async putRunnerHostFulfillmentPosture(hostFulfillmentPosture, runtimeReportMessage, sourceDispatch) {
      reported.push({ hostFulfillmentPosture, runtimeReportMessage, sourceDispatch });
      return { ok: true };
    },
  };
  const bridge = createRuntimeRunnerBridge({
    runtimeClient,
    adapterRef: "adapter:runner.execution-fulfillment:test",
    safeFacts: { hostAdapterRegistered: true },
    fulfillDispatch: async ({ runnerOperation }) => ({
      runtimeReportMessage: {
        type: "runtime.runner.host.fulfillment.put",
        hostFulfillmentPosture: {
          kind: "runner.host.fulfillment.posture",
          state: "succeeded",
          operationId: runnerOperation.operationId,
        },
        fulfillmentSessionProjection: {
          kind: "runtime.fulfillment-session.projection",
          projectionRef: "runtime:fulfillment-session:projection:test",
        },
      },
    }),
    now: () => 1_779_266_500,
  });

  const posture = await bridge.processSnapshot();

  assert.equal(posture.kind, "runtime.runner.bridge.posture");
  assert.equal(posture.state, "succeeded");
  assert.equal(posture.adapterRef, "adapter:runner.execution-fulfillment:test");
  assert.equal(posture.safeFacts.hostAdapterRegistered, true);
  assert.equal(posture.fulfilledCount, 1);
  assert.equal(reported.length, 1);
  assert.equal(reported[0].hostFulfillmentPosture.operationId, dispatch.operationId);
  assert.equal(reported[0].runtimeReportMessage.type, "runtime.runner.host.fulfillment.put");
  assert.equal(
    reported[0].runtimeReportMessage.fulfillmentSessionProjection.projectionRef,
    "runtime:fulfillment-session:projection:test",
  );
  assert.equal(reported[0].sourceDispatch.dispatchId, dispatch.dispatchId);

  const second = await bridge.processSnapshot();
  assert.equal(second.state, "idle");
  assert.equal(second.skippedCount, 1);
  assert.equal(reported.length, 1);
});

test("runtime runner bridge does not ask adapter to execute terminal dispatch", async () => {
  const dispatch = {
    ...acceptedDispatch("runner-operation:module-load:terminal"),
    state: "succeeded",
  };
  let adapterCalls = 0;
  const bridge = createRuntimeRunnerBridge({
    runtimeClient: {
      snapshot: { runnerOperations: { [dispatch.operationId]: dispatch } },
      putRunnerHostFulfillmentPosture() {
        throw new Error("terminal dispatch should not report");
      },
    },
    fulfillDispatch: async () => {
      adapterCalls += 1;
    },
  });

  const posture = await bridge.processSnapshot();

  assert.equal(posture.state, "idle");
  assert.equal(posture.skippedCount, 1);
  assert.equal(adapterCalls, 0);
});
