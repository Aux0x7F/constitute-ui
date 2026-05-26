import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimeSurfaceClient } from "../src/runtime-surface-client.js";

class FakePort {
  constructor() {
    this.messages = [];
    this.started = false;
    this.closed = false;
    this.onmessage = null;
  }

  start() {
    this.started = true;
  }

  postMessage(message) {
    this.messages.push(message);
  }

  close() {
    this.closed = true;
  }
}

class FakeSharedWorker {
  static last = null;

  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.port = new FakePort();
    FakeSharedWorker.last = this;
  }
}

class ThrowingSharedWorker {
  constructor() {
    throw new Error("module workers are unavailable");
  }
}

test("runtime surface client attaches and settles correlated responses", async () => {
  const previousSharedWorker = globalThis.SharedWorker;
  globalThis.SharedWorker = FakeSharedWorker;
  try {
    const snapshots = [];
    const budgets = [];
    const floors = [];
    const materializationPostures = [];
    const client = createRuntimeSurfaceClient({
      clientId: "surface-client",
      surface: "surface",
      workerUrl: "/runtime.worker.js",
      workerName: "runtime-test",
      snapshotSubscription: { mode: "push", replayLimit: 1 },
      attachContext: { product: "test" },
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      onMaterializationBudget: (budget) => budgets.push(budget),
      onConsumerFloor: (floor) => floors.push(floor),
      onMaterializationPosture: (posture) => materializationPostures.push(posture),
    });

    const port = client.attach();
    assert.equal(port.started, true);
    assert.deepEqual(port.messages[0], {
      type: "runtime.attach",
      clientId: "surface-client",
      surface: "surface",
      broker: false,
      snapshotSubscription: { mode: "push", replayLimit: 1 },
      attachContext: { product: "test" },
    });

    const ready = client.waitUntilAttached(1_000);
    port.onmessage({
      data: {
        type: "runtime.snapshot",
        snapshot: { buildId: "runtime-test" },
        materializationBudget: { kind: "materialization.budget", budgetId: "budget-1" },
        consumerFloor: { kind: "consumer.floor", floorId: "floor-1" },
      },
    });
    assert.equal(await ready, port);
    assert.equal(client.attached, true);
    assert.equal(client.attachPosture.state, "attached");
    assert.deepEqual(snapshots, [{ buildId: "runtime-test" }]);
    assert.deepEqual(budgets, [{ kind: "materialization.budget", budgetId: "budget-1" }]);
    assert.deepEqual(floors, [{ kind: "consumer.floor", floorId: "floor-1" }]);
    assert.deepEqual(client.materializationBudget, { kind: "materialization.budget", budgetId: "budget-1" });
    assert.deepEqual(client.consumerFloor, { kind: "consumer.floor", floorId: "floor-1" });
    assert.equal(client.materializationPosture.kind, "runtime.materialization.posture");
    assert.equal(client.materializationPosture.budgetId, "budget-1");
    assert.equal(client.materializationPosture.consumerFloorId, "floor-1");
    assert.equal(client.materializationPosture.state, "withinBudget");
    assert.equal(materializationPostures.length, 1);

    const resultPromise = client.call("runtime.snapshot.get", { value: 1 }, 1_000);
    const request = port.messages[1];
    assert.equal(request.type, "runtime.snapshot.get");
    assert.equal(request.clientId, "surface-client");
    port.onmessage({
      data: {
        type: "runtime.response",
        requestId: request.requestId,
        ok: true,
        result: { received: true },
      },
    });
    assert.deepEqual(await resultPromise, { received: true });
    assert.equal(client.pendingCount, 0);
    client.close();
    assert.deepEqual(port.messages.at(-1), {
      type: "runtime.detach",
      clientId: "surface-client",
      surface: "surface",
    });
    assert.equal(port.closed, true);
  } finally {
    globalThis.SharedWorker = previousSharedWorker;
  }
});

test("runtime surface client exposes degraded attach posture when attach fails", () => {
  const previousSharedWorker = globalThis.SharedWorker;
  globalThis.SharedWorker = ThrowingSharedWorker;
  try {
    const postures = [];
    const errors = [];
    const client = createRuntimeSurfaceClient({
      clientId: "surface-client",
      surface: "surface",
      workerUrl: "/runtime.worker.js",
      workerName: "runtime-test",
      onAttachPosture: (posture) => postures.push(posture),
      onAttachError: (error) => errors.push(error),
    });

    assert.equal(client.attach(), null);
    assert.equal(errors.length, 1);
    assert.equal(client.attachPosture.state, "failed");
    assert.equal(client.attachPosture.severity, "degraded");
    assert.match(client.attachPosture.reason, /module workers are unavailable/);
    assert.deepEqual(postures.map((posture) => posture.state), ["failed"]);
  } finally {
    globalThis.SharedWorker = previousSharedWorker;
  }
});

test("runtime surface client resolves attach waiters to null on timeout", async () => {
  const previousSharedWorker = globalThis.SharedWorker;
  globalThis.SharedWorker = FakeSharedWorker;
  try {
    const timedOut = [];
    const client = createRuntimeSurfaceClient({
      clientId: "surface-client",
      surface: "surface",
      workerUrl: "/runtime.worker.js",
      workerName: "runtime-test",
      attachTimeoutMs: 5,
      onAttachTimeout: () => timedOut.push(true),
    });

    assert.equal(await client.waitUntilAttached(20), null);
    assert.deepEqual(timedOut, [true]);
    assert.equal(client.attached, false);
    const port = FakeSharedWorker.last.port;
    assert.equal(port.messages.length, 1);
    assert.equal(client.attach(), port);
    assert.equal(port.messages.length, 2);
    assert.equal(port.messages[1].type, "runtime.attach");
  } finally {
    globalThis.SharedWorker = previousSharedWorker;
  }
});

test("runtime surface client lets products intercept non-generic messages", () => {
  const previousSharedWorker = globalThis.SharedWorker;
  globalThis.SharedWorker = FakeSharedWorker;
  try {
    const seen = [];
    const client = createRuntimeSurfaceClient({
      clientId: "logging-ui",
      surface: "logging-ui",
      workerUrl: "/runtime.worker.js",
      workerName: "runtime-test",
      onMessage: (message) => {
        if (message.type !== "projection.observer.update") return false;
        seen.push(message.update.changedCount);
        return true;
      },
    });

    const port = client.attach();
    port.onmessage({ data: { type: "projection.observer.update", update: { changedCount: 3 } } });
    assert.deepEqual(seen, [3]);
    assert.equal(client.attached, false);
  } finally {
    globalThis.SharedWorker = previousSharedWorker;
  }
});

test("runtime surface client exposes intent and evidence helpers through correlated calls", async () => {
  const previousSharedWorker = globalThis.SharedWorker;
  globalThis.SharedWorker = FakeSharedWorker;
  try {
    const client = createRuntimeSurfaceClient({
      clientId: "nvr-ui",
      surface: "nvr-ui",
      workerUrl: "/runtime.worker.js",
      workerName: "runtime-test",
    });

    const port = client.attach();
    const openPromise = client.openIntent("runtime.stream.open", { intentId: "intent-1" }, 1_000);
    const open = port.messages.at(-1);
    assert.equal(open.type, "runtime.stream.open");
    assert.equal(open.intentId, "intent-1");
    port.onmessage({ data: { type: "runtime.response", requestId: open.requestId, ok: true, result: { ok: true } } });
    assert.deepEqual(await openPromise, { ok: true });

    const evidencePromise = client.submitEvidence(
      "runtime.media.transport.observation.put",
      { observation: { observationId: "obs-1" } },
      1_000,
    );
    const evidence = port.messages.at(-1);
    assert.equal(evidence.type, "runtime.media.transport.observation.put");
    assert.deepEqual(evidence.observation, { observationId: "obs-1" });
    port.onmessage({ data: { type: "runtime.response", requestId: evidence.requestId, ok: true, result: { accepted: true } } });
    assert.deepEqual(await evidencePromise, { accepted: true });

    const runnerPromise = client.submitRunnerOperation(
      { kind: "runner.operation", operationId: "runner-operation:module-load:test" },
      1_000,
    );
    const runner = port.messages.at(-1);
    assert.equal(runner.type, "runtime.runner.operation.submit");
    assert.deepEqual(runner.runnerOperation, { kind: "runner.operation", operationId: "runner-operation:module-load:test" });
    port.onmessage({ data: { type: "runtime.response", requestId: runner.requestId, ok: true, result: { accepted: true } } });
    assert.deepEqual(await runnerPromise, { accepted: true });

    const hostFulfillmentPromise = client.putRunnerHostFulfillmentPosture(
      { kind: "runner.host.fulfillment.posture", operationId: "runner-operation:module-load:test" },
      1_000,
    );
    const hostFulfillment = port.messages.at(-1);
    assert.equal(hostFulfillment.type, "runtime.runner.host.fulfillment.put");
    assert.deepEqual(hostFulfillment.hostFulfillmentPosture, {
      kind: "runner.host.fulfillment.posture",
      operationId: "runner-operation:module-load:test",
    });
    port.onmessage({
      data: {
        type: "runtime.response",
        requestId: hostFulfillment.requestId,
        ok: true,
        result: { state: "succeeded" },
      },
    });
    assert.deepEqual(await hostFulfillmentPromise, { state: "succeeded" });
  } finally {
    globalThis.SharedWorker = previousSharedWorker;
  }
});
