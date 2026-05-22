import {
  prepareRuntimeHostFabricPosture,
  prepareRuntimeReadModel,
  prepareRuntimeTargetPosture,
} from "./runtime-read-model.js";
import { deriveRuntimeMaterializationPosture } from "./runtime-shell-state.js";

export function createRuntimeSurfaceClient({
  clientId,
  surface,
  workerUrl,
  workerName,
  broker = false,
  snapshotSubscription = null,
  attachContext = null,
  detachOnClose = true,
  attachTimeoutMs = 5_000,
  callTimeoutMs = 15_000,
  debug = false,
  debugInfo = null,
  readModelOptions = {},
  logPrefix = surface || clientId || "runtime-surface",
  onPort = null,
  onMessage = null,
  onSnapshot = null,
  onReadModel = null,
  onMaterializationBudget = null,
  onConsumerFloor = null,
  onMaterializationPosture = null,
  onTargetPosture = null,
  onHostFabricPosture = null,
  onAttachTimeout = null,
  onAttachError = null,
  onAttachPosture = null,
  onWorkerError = null,
} = {}) {
  const pendingResponses = new Map();
  const timers = typeof window !== "undefined" ? window : globalThis;
  let port = null;
  let requestSeq = 1;
  let attached = false;
  let snapshot = null;
  let materializationBudget = null;
  let consumerFloor = null;
  let materializationPosture = deriveRuntimeMaterializationPosture(null, { clientId, surface });
  let targetPosture = prepareRuntimeTargetPosture(null, { clientId, surface });
  let hostFabricPosture = prepareRuntimeHostFabricPosture(null, { clientId, surface });
  let readModel = prepareRuntimeReadModel(null, {
    ...readModelOptions,
    clientId,
    surface,
    materializationBudget,
    consumerFloor,
  });
  let attachWaiters = [];
  let attachInFlight = false;
  let attachPosture = {
    kind: "runtime.attach.posture",
    clientId,
    surface,
    state: "idle",
    severity: "info",
    reason: "",
    observedAt: Date.now(),
  };

  function setAttachPosture(next = {}) {
    attachPosture = {
      kind: "runtime.attach.posture",
      clientId,
      surface,
      state: String(next.state || attachPosture.state || "idle"),
      severity: String(next.severity || attachPosture.severity || "info"),
      reason: String(next.reason || ""),
      observedAt: Date.now(),
      evidence: next.evidence && typeof next.evidence === "object" ? next.evidence : {},
    };
    if (typeof onAttachPosture === "function") onAttachPosture(attachPosture);
    return attachPosture;
  }

  function settleResponse(msg = {}) {
    const requestId = String(msg.requestId || "").trim();
    const pending = pendingResponses.get(requestId);
    if (!pending) return false;
    timers.clearTimeout(pending.timer);
    pendingResponses.delete(requestId);
    if (msg.ok === false) pending.reject(new Error(String(msg.error || `${pending.type} failed`)));
    else pending.resolve(msg.result);
    return true;
  }

  function absorbMaterializationBudget(msg = {}) {
    const nextBudget = msg.materializationBudget && typeof msg.materializationBudget === "object"
      ? msg.materializationBudget
      : null;
    materializationBudget = nextBudget;
    if (typeof onMaterializationBudget === "function") onMaterializationBudget(nextBudget, msg);
    const nextFloor = msg.consumerFloor && typeof msg.consumerFloor === "object"
      ? msg.consumerFloor
      : (nextBudget?.consumerFloor && typeof nextBudget.consumerFloor === "object" ? nextBudget.consumerFloor : null);
    consumerFloor = nextFloor;
    if (typeof onConsumerFloor === "function") onConsumerFloor(nextFloor, msg);
    materializationPosture = deriveRuntimeMaterializationPosture(snapshot, {
      clientId,
      surface,
      materializationBudget,
      consumerFloor,
    });
    if (typeof onMaterializationPosture === "function") onMaterializationPosture(materializationPosture, msg);
    targetPosture = prepareRuntimeTargetPosture(snapshot, {
      clientId,
      surface,
    });
    if (typeof onTargetPosture === "function") onTargetPosture(targetPosture, msg);
    hostFabricPosture = prepareRuntimeHostFabricPosture(snapshot, {
      clientId,
      surface,
    });
    if (typeof onHostFabricPosture === "function") onHostFabricPosture(hostFabricPosture, msg);
    readModel = prepareRuntimeReadModel(snapshot, {
      ...readModelOptions,
      clientId,
      surface,
      materializationBudget,
      consumerFloor,
    });
    if (typeof onReadModel === "function") onReadModel(readModel, msg);
  }

  function settleAttached(value) {
    attachInFlight = false;
    const waiters = attachWaiters;
    attachWaiters = [];
    for (const waiter of waiters) {
      timers.clearTimeout(waiter.timer);
      waiter.resolve(value);
    }
  }

  function absorbSnapshot(nextSnapshot, msg = {}) {
    snapshot = nextSnapshot && typeof nextSnapshot === "object" ? nextSnapshot : null;
    attached = true;
    setAttachPosture({ state: "attached", severity: "info", reason: "runtime snapshot received" });
    absorbMaterializationBudget(msg);
    settleAttached(port);
    if (typeof onSnapshot === "function") onSnapshot(snapshot);
  }

  function postAttachMessage() {
    if (!port || attached || attachInFlight) return;
    const attachMessage = {
      type: "runtime.attach",
      clientId,
      surface,
      broker,
    };
    if (snapshotSubscription && typeof snapshotSubscription === "object") {
      attachMessage.snapshotSubscription = snapshotSubscription;
    }
    if (attachContext && typeof attachContext === "object") {
      attachMessage.attachContext = attachContext;
    }
    port.postMessage(attachMessage);
    attachInFlight = true;
    setAttachPosture({ state: "attaching", severity: "info", reason: "runtime attach requested" });
    timers.setTimeout(() => {
      if (!attached && attachInFlight) {
        setAttachPosture({ state: "timeout", severity: "degraded", reason: "runtime attach timed out" });
        if (typeof onAttachTimeout === "function") onAttachTimeout();
        settleAttached(null);
      }
    }, attachTimeoutMs);
  }

  function attach() {
    if (port) {
      postAttachMessage();
      return port;
    }
    if (typeof SharedWorker === "undefined") {
      const error = new Error("SharedWorker is unavailable");
      setAttachPosture({ state: "unavailable", severity: "degraded", reason: error.message });
      if (typeof onAttachError === "function") onAttachError(error);
      return null;
    }
    try {
      if (debug) {
        const buildId = typeof debugInfo === "object" && debugInfo ? debugInfo.buildId : debugInfo;
        console.info(`[${logPrefix}] runtime attach`, buildId || "");
      }
      const worker = new SharedWorker(workerUrl, { type: "module", name: workerName });
      port = worker.port;
      port.start();
      if (typeof onPort === "function") onPort(port, worker);
      port.onmessage = (event) => {
        const msg = event?.data || {};
        if (typeof onMessage === "function" && onMessage(msg, event, api) === true) return;
        if (msg.type === "runtime.attached" || msg.type === "runtime.snapshot") {
          absorbSnapshot(msg.snapshot || null, msg);
          return;
        }
        if (msg.type === "runtime.response") settleResponse(msg);
      };
      worker.onerror = (event) => {
        setAttachPosture({
          state: "workerError",
          severity: "degraded",
          reason: String(event?.message || "shared worker failure"),
        });
        if (typeof onWorkerError === "function") onWorkerError(event, worker);
      };
      postAttachMessage();
      return port;
    } catch (error) {
      setAttachPosture({
        state: "failed",
        severity: "degraded",
        reason: String(error?.message || error || "runtime attach failed"),
      });
      if (typeof onAttachError === "function") onAttachError(error);
      settleAttached(null);
      return null;
    }
  }

  function waitUntilAttached(timeoutMs = attachTimeoutMs) {
    if (attached && port) return Promise.resolve(port);
    const nextPort = port || attach();
    if (!nextPort) return Promise.resolve(null);
    return new Promise((resolve) => {
      const waiter = {
        resolve,
        timer: timers.setTimeout(() => {
          attachWaiters = attachWaiters.filter((entry) => entry !== waiter);
          resolve(null);
        }, timeoutMs),
      };
      attachWaiters.push(waiter);
    });
  }

  function call(type, payload = {}, timeoutMs = callTimeoutMs) {
    if (!port) return Promise.reject(new Error("shared runtime is unavailable"));
    const requestId = `${clientId}-${type}-${requestSeq++}`;
    return new Promise((resolve, reject) => {
      const timer = timers.setTimeout(() => {
        pendingResponses.delete(requestId);
        reject(new Error(`${type} timed out`));
      }, timeoutMs);
      pendingResponses.set(requestId, { resolve, reject, timer, type });
      port.postMessage({ type, requestId, clientId, ...payload });
    });
  }

  function close() {
    for (const [requestId, pending] of pendingResponses.entries()) {
      timers.clearTimeout(pending.timer);
      pending.reject(new Error(`${pending.type} cancelled`));
      pendingResponses.delete(requestId);
    }
    settleAttached(null);
    try {
      if (detachOnClose && port) port.postMessage({ type: "runtime.detach", clientId, surface });
    } catch {}
    try {
      port?.close?.();
    } catch {}
    port = null;
    attached = false;
    snapshot = null;
    materializationBudget = null;
    consumerFloor = null;
    materializationPosture = deriveRuntimeMaterializationPosture(null, { clientId, surface });
    targetPosture = prepareRuntimeTargetPosture(null, { clientId, surface });
    hostFabricPosture = prepareRuntimeHostFabricPosture(null, { clientId, surface });
    readModel = prepareRuntimeReadModel(null, {
      ...readModelOptions,
      clientId,
      surface,
      materializationBudget,
      consumerFloor,
    });
    if (typeof onReadModel === "function") onReadModel(readModel, { type: "runtime.closed" });
    setAttachPosture({ state: "closed", severity: "info", reason: "runtime surface client closed" });
  }

  function openIntent(type, payload = {}, timeoutMs = callTimeoutMs) {
    return call(type, payload, timeoutMs);
  }

  function closeIntent(type, payload = {}, timeoutMs = callTimeoutMs) {
    return call(type, payload, timeoutMs);
  }

  function submitEvidence(type, evidence = {}, timeoutMs = callTimeoutMs) {
    return call(type, evidence, timeoutMs);
  }

  const api = {
    attach,
    call,
    close,
    waitUntilAttached,
    openIntent,
    closeIntent,
    submitEvidence,
    settleResponse,
    get attached() {
      return attached;
    },
    get pendingCount() {
      return pendingResponses.size;
    },
    get port() {
      return port;
    },
    get snapshot() {
      return snapshot;
    },
    get materializationBudget() {
      return materializationBudget;
    },
    get consumerFloor() {
      return consumerFloor;
    },
    get materializationPosture() {
      return materializationPosture;
    },
    get targetPosture() {
      return targetPosture;
    },
    get hostFabricPosture() {
      return hostFabricPosture;
    },
    get readModel() {
      return readModel;
    },
    get attachPosture() {
      return attachPosture;
    },
  };

  return api;
}
