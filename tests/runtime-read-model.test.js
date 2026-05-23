import assert from "node:assert/strict";
import test from "node:test";
import { FABRIC, SWARM } from "../../constitute-protocol/src/index.js";
import {
  prepareRuntimeHostFabricPosture,
  prepareRuntimeReadModel,
  prepareRuntimeTargetPosture,
} from "../src/runtime-read-model.js";
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

test("runtime read model keeps swarm edge endpoint references out of URL vocabulary", () => {
  const readModel = prepareRuntimeReadModel({
    buildId: "runtime-test",
    broker: { available: true },
    edge: {
      state: "connected",
      connected: true,
      endpointRef: "edge-endpoint:lab-gateway",
      url: "ws://legacy-edge-url",
      memberRef: "member:gateway",
    },
  });

  assert.equal(readModel.edge.endpointRef, "edge-endpoint:lab-gateway");
});

test("runtime read model consumes carrier edge session evidence as connection posture", () => {
  const now = 1778721000000;
  const readModel = prepareRuntimeReadModel({
    buildId: "runtime-test",
    broker: { available: true },
    edge: {
      mode: "live",
      connected: false,
      carrierEdge: {
        kind: SWARM.RECORD_KIND.CARRIER_EDGE_SESSION_EVIDENCE,
        evidenceId: "carrier-edge-evidence:runtime:test",
        selectionRef: "carrier-edge-selection:runtime:swarm-edge",
        edgeSessionRef: "carrier-edge-session:test",
        adapterRef: "adapter:runtime-worker:websocket",
        adapterKind: SWARM.CARRIER_EDGE_ADAPTER_KIND.WEB_SOCKET,
        participantRef: "member:runtime",
        state: SWARM.CARRIER_EDGE_SESSION_STATE.OPEN,
        connectionState: "connected",
        backpressureState: SWARM.CARRIER_EDGE_BACKPRESSURE_STATE.CLEAR,
        observedAt: now,
        expiresAt: now + 30_000,
      },
    },
  }, { now });

  assert.equal(readModel.edge.state, SWARM.CARRIER_EDGE_SESSION_STATE.OPEN);
  assert.equal(readModel.edge.connected, true);
  assert.equal(readModel.edge.memberRef, "member:runtime");
  assert.equal(readModel.edge.carrierEdge.present, true);
  assert.equal(readModel.edge.carrierEdge.adapterKind, SWARM.CARRIER_EDGE_ADAPTER_KIND.WEB_SOCKET);
  assert.deepEqual(readModel.edge.carrierEdge.validationErrors, []);
});

test("runtime target posture prepares protocol target and registry records for product-safe reads", () => {
  const target = {
    kind: SWARM.RECORD_KIND.CONTRACT_TARGET,
    targetRef: "contract-target:desktop-dev:msa-transition",
    contractRef: "app:constitute-nvr@0.1.0",
    profileRef: "target-profile:desktop-dev",
    platformRef: "platform:windows-desktop",
    state: FABRIC.CONTRACT_TARGET_STATE.READY,
    compatibilityState: FABRIC.CONTRACT_TARGET_COMPATIBILITY_STATE.COMPATIBLE,
    branchRefs: ["branch:0x/msa-transition"],
    subbranchRefs: ["subbranch:target-contract"],
    capabilitySlotRefs: ["slot:gateway", "slot:nvr-service"],
    adapterRefs: ["adapter:webrtc"],
    proofProfileRefs: ["proof:nvr-smoke-5s"],
    proofRefs: ["proof:local:nvr-smoke-5s"],
    evidenceRefs: ["evidence:contract-target:local"],
    targetAudience: "operator",
    issuedAt: 1778720000000,
  };
  const registry = {
    kind: SWARM.RECORD_KIND.CONTRACT_TARGET_REGISTRY_POSTURE,
    registryRef: "contract-target-registry:desktop-dev:msa-transition",
    targetRef: target.targetRef,
    contractRef: target.contractRef,
    state: FABRIC.CONTRACT_TARGET_REGISTRY_STATE.READY,
    candidateFulfillmentRefs: ["fulfillment:gateway:local"],
    proofRefs: ["proof:local:nvr-smoke-5s"],
    evidenceRefs: ["evidence:target-registry:local"],
    slotPostures: [
      {
        slotRef: "slot:gateway",
        state: FABRIC.CONTRACT_TARGET_SLOT_STATE.AVAILABLE,
        platformFitState: FABRIC.CONTRACT_TARGET_PLATFORM_FIT_STATE.COMPATIBLE,
        candidateFulfillmentRefs: ["fulfillment:gateway:local"],
        selectedFulfillmentRef: "fulfillment:gateway:local",
      },
      {
        slotRef: "slot:remote-native-client",
        state: FABRIC.CONTRACT_TARGET_SLOT_STATE.NOT_REQUIRED,
        platformFitState: FABRIC.CONTRACT_TARGET_PLATFORM_FIT_STATE.UNKNOWN,
      },
    ],
    observedAt: 1778720000100,
  };

  const posture = prepareRuntimeTargetPosture({
    contractTargets: [target],
    targetRegistryPostures: [registry],
  }, {
    clientId: "nvr-ui",
    surface: "constitute-nvr-ui",
  });

  assert.equal(posture.kind, "runtime.contract-target.read-model");
  assert.equal(posture.state, "ready");
  assert.equal(posture.ready, true);
  assert.equal(posture.targetRef, target.targetRef);
  assert.deepEqual(posture.branchRefs, ["branch:0x/msa-transition"]);
  assert.equal(posture.registry.state, "ready");
  assert.equal(posture.registry.availableSlotCount, 1);
  assert.equal(posture.registry.notRequiredSlotCount, 1);
  assert.deepEqual(posture.registry.selectedFulfillmentRefs, ["fulfillment:gateway:local"]);
});

test("runtime host fabric posture prepares fulfillment plan and lifecycle records", () => {
  const memberRef = "a".repeat(64);
  const plan = {
    kind: SWARM.RECORD_KIND.HOST_FABRIC_FULFILLMENT_PLAN,
    planId: "host-fabric-plan:local:nvr",
    fabricRef: "fabric:local-workstation",
    hostRef: "host:local-windows",
    contractRef: "app:constitute-nvr@0.1.0",
    state: FABRIC.FULFILLMENT_PLAN_STATE.READY,
    requiredRoleRefs: ["role:gatewayAssociation", "role:serviceEdgeAdapter"],
    memberContributionRefs: ["contribution:gateway:local"],
    lifecyclePlanRefs: ["lifecycle:service-edge:nvr"],
    materializationBudgetRefs: ["budget:runtime-snapshot"],
    evidenceRefs: ["evidence:fabric:local"],
    associationHandoffRef: "handoff:substrate:local",
    observedAt: 1778720000200,
  };
  const contribution = {
    kind: SWARM.RECORD_KIND.HOST_FABRIC_MEMBER_CONTRIBUTION,
    contributionId: "contribution:gateway:local",
    fabricRef: "fabric:local-workstation",
    hostRef: "host:local-windows",
    memberRef,
    participantRef: "participant:gateway-association:local",
    role: FABRIC.MEMBER_ROLE.GATEWAY_ASSOCIATION,
    roleRef: "role:gatewayAssociation",
    state: FABRIC.MEMBER_CONTRIBUTION_STATE.ACCEPTED,
    contractRef: "contract:gateway-association@0.1.0",
    subjectRef: "gateway:local",
    moduleRefs: ["module:gateway-association"],
    sourceRefs: ["content-index:source:constitute-gateway"],
    capabilityRefs: ["cap:route.associate"],
    evidenceRefs: ["evidence:gateway:local"],
    lifecyclePlanRefs: ["lifecycle:service-edge:nvr"],
    observedAt: 1778720000300,
  };
  const lifecyclePlan = {
    kind: SWARM.RECORD_KIND.LIFECYCLE_PLAN_POSTURE,
    lifecyclePlanId: "lifecycle:service-edge:nvr",
    subjectRef: "service:nvr",
    contractRef: "contract:lifecycle.host-service-adapter@0.1.0",
    state: FABRIC.LIFECYCLE_PLAN_STATE.READY,
    lifecycleContractRefs: ["contract:lifecycle.host-service-adapter@0.1.0"],
    memberContributionRefs: ["contribution:gateway:local"],
    evidenceRefs: ["evidence:lifecycle:nvr"],
    phasePostures: [
      {
        phase: FABRIC.LIFECYCLE_PHASE.RUN,
        state: FABRIC.LIFECYCLE_PHASE_STATE.READY,
        dependencyRefs: [],
        evidenceRefs: ["evidence:lifecycle:nvr:run"],
      },
    ],
    dependencyEdges: [],
    observedAt: 1778720000400,
  };

  const posture = prepareRuntimeHostFabricPosture({
    hostFabricFulfillmentPlans: [plan],
    hostFabricContributions: [contribution],
    lifecyclePlans: [lifecyclePlan],
  }, {
    clientId: "nvr-ui",
    surface: "constitute-nvr-ui",
  });

  assert.equal(posture.kind, "runtime.host-fabric.read-model");
  assert.equal(posture.state, "ready");
  assert.equal(posture.ready, true);
  assert.equal(posture.planId, "host-fabric-plan:local:nvr");
  assert.deepEqual(posture.memberContributionRefs, ["contribution:gateway:local"]);
  assert.equal(posture.contributions.length, 1);
  assert.equal(posture.contributions[0].role, FABRIC.MEMBER_ROLE.GATEWAY_ASSOCIATION);
  assert.equal(posture.lifecyclePlans.length, 1);
  assert.equal(posture.lifecyclePlans[0].phaseCount, 1);
});

test("runtime read model accepts target source envelope from account runtime", () => {
  const target = {
    kind: SWARM.RECORD_KIND.CONTRACT_TARGET,
    targetRef: "contract-target:desktop-windows-dev:msa-transition",
    contractRef: "app:constitution-runtime-target@msa-transition",
    profileRef: "target-profile:desktop-dev",
    platformRef: "platform:windows-desktop",
    state: FABRIC.CONTRACT_TARGET_STATE.READY,
    compatibilityState: FABRIC.CONTRACT_TARGET_COMPATIBILITY_STATE.COMPATIBLE,
    modifierRefs: ["modifier:dev"],
    branchRefs: ["branch:0x/msa-transition"],
    capabilitySlotRefs: ["slot:runtime", "slot:browser-webrtc", "slot:native-client"],
    adapterRefs: ["adapter:runtime-shared-worker", "adapter:browser-webrtc"],
    negativeSlotRefs: ["slot:native-client"],
    proofProfileRefs: ["proof-profile:surface-landscape"],
    evidenceRefs: ["evidence:runtime:target-source"],
    targetAudience: "operator",
    issuedAt: 1778720000000,
    expiresAt: 1778720060000,
  };
  const registry = {
    kind: SWARM.RECORD_KIND.CONTRACT_TARGET_REGISTRY_POSTURE,
    registryRef: "contract-target-registry:desktop-windows-dev:msa-transition",
    targetRef: target.targetRef,
    contractRef: target.contractRef,
    state: FABRIC.CONTRACT_TARGET_REGISTRY_STATE.READY,
    slotPostures: [
      {
        slotRef: "slot:runtime",
        state: FABRIC.CONTRACT_TARGET_SLOT_STATE.AVAILABLE,
        platformFitState: FABRIC.CONTRACT_TARGET_PLATFORM_FIT_STATE.COMPATIBLE,
        candidateFulfillmentRefs: ["runtime:runtime-2.57"],
        selectedFulfillmentRef: "runtime:runtime-2.57",
      },
      {
        slotRef: "slot:browser-webrtc",
        state: FABRIC.CONTRACT_TARGET_SLOT_STATE.AVAILABLE,
        platformFitState: FABRIC.CONTRACT_TARGET_PLATFORM_FIT_STATE.COMPATIBLE,
        candidateFulfillmentRefs: ["fulfillment:browser-webrtc:authenticated-desktop-browser"],
        selectedFulfillmentRef: "fulfillment:browser-webrtc:authenticated-desktop-browser",
        adapterRefs: ["adapter:browser-webrtc"],
      },
      {
        slotRef: "slot:native-client",
        state: FABRIC.CONTRACT_TARGET_SLOT_STATE.NOT_REQUIRED,
        platformFitState: FABRIC.CONTRACT_TARGET_PLATFORM_FIT_STATE.UNKNOWN,
      },
    ],
    candidateFulfillmentRefs: ["runtime:runtime-2.57", "fulfillment:browser-webrtc:authenticated-desktop-browser"],
    proofRequirementRefs: ["proof-requirement:surface-landscape"],
    evidenceRefs: ["evidence:runtime:target-registry"],
    observedAt: 1778720000100,
    expiresAt: 1778720060000,
  };

  const posture = prepareRuntimeTargetPosture({
    targetSource: {
      kind: "runtime.contract-target.source",
      contractTargets: [target],
      targetRegistryPostures: [registry],
    },
  });

  assert.equal(posture.state, "ready");
  assert.equal(posture.targetRef, target.targetRef);
  assert.equal(posture.registry.notRequiredSlotCount, 1);
  assert.equal(posture.registry.availableSlotCount, 2);
  assert.deepEqual(posture.negativeSlotRefs, ["slot:native-client"]);
  assert.deepEqual(posture.missingSlotRefs, []);
});

test("runtime surface client emits read-model posture alongside raw snapshots", async () => {
  const previousSharedWorker = globalThis.SharedWorker;
  globalThis.SharedWorker = FakeSharedWorker;
  try {
    const readModels = [];
    const targetPostures = [];
    const hostFabricPostures = [];
    const client = createRuntimeSurfaceClient({
      clientId: "gateway-ui",
      surface: "constitute-gateway-ui",
      workerUrl: "/runtime.worker.js",
      workerName: "runtime-test",
      onReadModel: (readModel) => readModels.push(readModel),
      onTargetPosture: (posture) => targetPostures.push(posture),
      onHostFabricPosture: (posture) => hostFabricPostures.push(posture),
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
          contractTargets: [{
            kind: SWARM.RECORD_KIND.CONTRACT_TARGET,
            targetRef: "contract-target:gateway-ui",
            contractRef: "app:gateway-ui@0.1.0",
            profileRef: "target-profile:desktop-dev",
            platformRef: "platform:windows-desktop",
            state: FABRIC.CONTRACT_TARGET_STATE.READY,
            compatibilityState: FABRIC.CONTRACT_TARGET_COMPATIBILITY_STATE.COMPATIBLE,
            capabilitySlotRefs: ["slot:gateway"],
            targetAudience: "operator",
            issuedAt: 1778720000000,
          }],
          targetRegistryPostures: [{
            kind: SWARM.RECORD_KIND.CONTRACT_TARGET_REGISTRY_POSTURE,
            registryRef: "contract-target-registry:gateway-ui",
            targetRef: "contract-target:gateway-ui",
            contractRef: "app:gateway-ui@0.1.0",
            state: FABRIC.CONTRACT_TARGET_REGISTRY_STATE.READY,
            slotPostures: [{
              slotRef: "slot:gateway",
              state: FABRIC.CONTRACT_TARGET_SLOT_STATE.AVAILABLE,
              platformFitState: FABRIC.CONTRACT_TARGET_PLATFORM_FIT_STATE.COMPATIBLE,
              candidateFulfillmentRefs: ["fulfillment:gateway:local"],
            }],
            observedAt: 1778720000100,
          }],
          hostFabricFulfillmentPlans: [{
            kind: SWARM.RECORD_KIND.HOST_FABRIC_FULFILLMENT_PLAN,
            planId: "host-fabric-plan:gateway-ui",
            fabricRef: "fabric:local-workstation",
            hostRef: "host:local-windows",
            contractRef: "app:gateway-ui@0.1.0",
            state: FABRIC.FULFILLMENT_PLAN_STATE.READY,
            requiredRoleRefs: ["role:gatewayAssociation"],
            memberContributionRefs: ["contribution:gateway:local"],
            observedAt: 1778720000200,
          }],
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
    assert.equal(client.readModel.target.state, "ready");
    assert.equal(client.readModel.fabric.state, "ready");
    assert.equal(client.targetPosture.targetRef, "contract-target:gateway-ui");
    assert.equal(client.hostFabricPosture.planId, "host-fabric-plan:gateway-ui");
    assert.equal(targetPostures.length, 1);
    assert.equal(hostFabricPostures.length, 1);
  } finally {
    globalThis.SharedWorker = previousSharedWorker;
  }
});
