import assert from "node:assert/strict";
import test from "node:test";
import { prepareRuntimeReadModel } from "../src/runtime-read-model.js";
import { createRuntimeSurfaceClient } from "../src/runtime-surface-client.js";

class FakePort {
  constructor() {
    this.messages = [];
    this.onmessage = null;
  }

  start() {}

  postMessage(message) {
    this.messages.push(message);
  }
}

class FakeSharedWorker {
  constructor() {
    this.port = new FakePort();
    FakeSharedWorker.last = this;
  }
}

test("runtime read model folds snapshot posture into product-safe runtime truth", () => {
  const readModel = prepareRuntimeReadModel({
    buildId: "runtime-test",
    runtimeSessionId: "runtime-session-test",
    broker: { available: true },
    authority: { state: "ready", ready: true, devicePk: "device-1" },
    serviceCatalog: {
      registry: {
        kind: "service.registry.materialization",
        state: "ready",
        services: [{ service: "nvr", servicePk: "nvr-pk" }],
      },
    },
    projections: { streams: { projectionId: "nvr.streams" } },
    materialization: { state: "withinBudget", projectionCount: 1 },
  }, {
    clientId: "nvr-ui",
    surface: "constitute-nvr-ui",
  });

  assert.equal(readModel.kind, "runtime.surface.read-model");
  assert.equal(readModel.state, "ready");
  assert.equal(readModel.ready, true);
  assert.equal(readModel.buildId, "runtime-test");
  assert.equal(readModel.authority.ready, true);
  assert.equal(readModel.serviceRegistry.serviceCount, 1);
  assert.equal(readModel.projection.projectionCount, 1);
  assert.equal(readModel.materialization.state, "withinBudget");
});

test("runtime surface client emits read-model posture alongside raw snapshots", async () => {
  const previousSharedWorker = globalThis.SharedWorker;
  globalThis.SharedWorker = FakeSharedWorker;
  try {
    const readModels = [];
    const client = createRuntimeSurfaceClient({
      clientId: "gateway-ui",
      surface: "constitute-gateway-ui",
      workerUrl: "/runtime.worker.js",
      workerName: "runtime-test",
      onReadModel: (readModel) => readModels.push(readModel),
    });
    const port = client.attach();
    const ready = client.waitUntilAttached(1_000);
    port.onmessage({
      data: {
        type: "runtime.snapshot",
        snapshot: {
          buildId: "runtime-test",
          broker: { available: true },
          serviceCatalog: {
            services: [{ service: "gateway", servicePk: "gateway-pk" }],
          },
        },
        materializationBudget: {
          kind: "materialization.budget",
          budgetId: "budget:gateway-ui",
          state: "withinBudget",
        },
      },
    });

    assert.equal(await ready, port);
    assert.equal(readModels.length, 1);
    assert.equal(client.readModel.kind, "runtime.surface.read-model");
    assert.equal(client.readModel.ready, true);
    assert.equal(client.readModel.materialization.budgetId, "budget:gateway-ui");
  } finally {
    globalThis.SharedWorker = previousSharedWorker;
  }
});
