import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import {
  renderPreparedCapabilityList,
  renderPreparedChannelList,
  renderProjectionSyncStatus,
  renderSwarmEdgeStatus,
  renderStreamStatus,
} from "../src/index.js";

function installDom(html) {
  const { document, window } = parseHTML(`<html><body>${html}</body></html>`);
  global.document = document;
  global.window = window;
  return { document, window };
}

function recordTitles(root) {
  return Array.from(root.querySelectorAll(".cuPreparedRecordTitle")).map((node) => node.textContent);
}

test("prepared capability and channel lists sort and render prepared records", () => {
  const dom = installDom("<div id='capabilities'></div><div id='channels'></div>");
  const capabilityActions = [];
  const channelActions = [];

  renderPreparedCapabilityList(dom.document.getElementById("capabilities"), {
    records: [
      {
        id: "capability:z",
        capability: "storage.pin",
        label: "Storage pin",
        channels: ["channel:storage"],
        status: "active",
      },
      {
        id: "capability:a",
        capability: "projection.observe",
        label: "Projection observe",
        channels: ["channel:runtime"],
        status: "ready",
        actions: [{ id: "select", label: "Use", payload: { action: "use-capability", id: "capability:a" } }],
      },
    ],
    onAction: (payload) => capabilityActions.push(payload),
  });

  renderPreparedChannelList(dom.document.getElementById("channels"), {
    records: [
      {
        channelId: "channel:z",
        displayName: "Storage",
        kind: "service",
        capabilities: ["storage.pin"],
      },
      {
        channelId: "channel:a",
        displayName: "Runtime",
        kind: "edge",
        capabilities: ["projection.observe"],
        actions: [{ id: "open", label: "Open" }],
      },
    ],
    onAction: (payload) => channelActions.push(payload),
  });

  assert.deepEqual(recordTitles(dom.document.getElementById("capabilities")), [
    "Projection observe",
    "Storage pin",
  ]);
  assert.deepEqual(recordTitles(dom.document.getElementById("channels")), [
    "Runtime",
    "Storage",
  ]);
  assert.match(dom.document.getElementById("capabilities").textContent, /projection\.observe|channel:runtime/);
  assert.match(dom.document.getElementById("channels").textContent, /edge|projection\.observe/);

  dom.document.querySelector("#capabilities button").click();
  dom.document.querySelector("#channels button").click();
  assert.deepEqual(capabilityActions, [{ action: "use-capability", id: "capability:a" }]);
  assert.equal(channelActions[0].kind, "channel");
  assert.equal(channelActions[0].actionId, "open");
  assert.equal(channelActions[0].recordId, "channel:a");
});

test("projection sync status renders stale gap pending and repair states", () => {
  const dom = installDom("<div id='projection'></div>");
  const root = dom.document.getElementById("projection");

  renderProjectionSyncStatus(root, {
    projectionId: "projection:runtime",
    revision: 41,
    stale: true,
    gap: true,
    pendingDeltas: 3,
    repairPending: true,
    lastAppliedAt: "2026-05-08T09:00:00Z",
  });

  assert.match(root.textContent, /projection:runtime/);
  assert.match(root.textContent, /Revision\s*41/);
  assert.match(root.textContent, /Stale/);
  assert.match(root.textContent, /Gap/);
  assert.match(root.textContent, /Pending 3/);
  assert.match(root.textContent, /Repair pending/);
});

test("swarm edge status renders queued sent and rejected counts", () => {
  const dom = installDom("<div id='queue'></div>");
  const root = dom.document.getElementById("queue");

  renderSwarmEdgeStatus(root, {
    connected: true,
    mode: "fixture",
    queued: 7,
    sent: 11,
    rejected: 2,
    lastRejectReason: "expired-frame",
  });

  const countValues = Array.from(root.querySelectorAll(".cuCountItem")).map((node) => node.textContent);
  assert.deepEqual(countValues, ["7Queued", "11Sent", "2Rejected"]);
  assert.match(root.textContent, /Swarm edge/);
  assert.match(root.textContent, /Mode\s*fixture/);
  assert.match(root.textContent, /Last reject\s*expired-frame/);
});

test("stream status renders generic session health without NVR vocabulary", () => {
  const dom = installDom("<div id='stream'></div>");
  const root = dom.document.getElementById("stream");

  renderStreamStatus(root, {
    sessionId: "stream-session-1",
    state: "open",
    health: "limited",
    transport: "webrtc",
    recovering: true,
    backoff: "2s",
  });

  assert.match(root.textContent, /stream-session-1/);
  assert.match(root.textContent, /Health\s*limited/);
  assert.match(root.textContent, /Recovery\s*Recovering/);
  assert.doesNotMatch(root.textContent, /nvr|camera|recording|ptz/i);
});
