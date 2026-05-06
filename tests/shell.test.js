import test from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import {
  bindFirstPartyShellChrome,
  createViewModel,
  renderAccountCenterSummary,
  renderActionList,
  renderDataTable,
  renderFirstPartyShell,
  setConnectionStateText,
} from "../src/index.js";

function installDom(html) {
  const { document, window } = parseHTML(`<html><body>${html}</body></html>`);
  global.document = document;
  global.window = window;
  return { document, window };
}

test("createViewModel emits updates to subscribers", () => {
  const model = createViewModel({ count: 1 });
  const seen = [];
  const unsubscribe = model.subscribe((value) => seen.push(value.count));
  model.update((value) => ({ count: value.count + 1 }));
  unsubscribe();
  model.set({ count: 3 });
  assert.deepEqual(seen, [1, 2]);
});

test("renderFirstPartyShell creates shared chrome and slots", () => {
  const dom = installDom("<div id='app'></div>");
  const root = dom.document.getElementById("app");
  const shell = renderFirstPartyShell(root, {
    appName: "Constitute NVR",
    navItems: [
      { id: "live", label: "Live" },
      { id: "settings", label: "Settings", active: true },
    ],
    mainHtml: "<section id='viewMain'>Main</section>",
  });
  assert.equal(shell.appNameEl.textContent, "Constitute NVR");
  assert.equal(shell.navButtons.length, 2);
  assert.equal(shell.mainEl.querySelector("#viewMain").textContent, "Main");
  assert.equal(Boolean(root.querySelector(".accountRailChevron")), true);
});

test("renderActionList binds click handlers and pending labels", () => {
  const dom = installDom("<div id='actions'></div>");
  const actionsEl = dom.document.getElementById("actions");
  let clicked = 0;
  renderActionList(actionsEl, [
    { id: "primary", label: "Apply", onSelect: () => { clicked += 1; } },
    { id: "pending", label: "Open", pending: true, pendingLabel: "Opening…" },
  ]);
  const [primary, pending] = actionsEl.querySelectorAll("button");
  primary.click();
  assert.equal(clicked, 1);
  assert.equal(primary.textContent, "Apply");
  assert.equal(pending.textContent, "Opening…");
  assert.equal(pending.disabled, true);
});

test("setConnectionStateText replaces stale tone classes", () => {
  const dom = installDom("<span id='status' class='connStateText connStateText-offline'></span>");
  const statusEl = dom.document.getElementById("status");
  setConnectionStateText(statusEl, {
    label: "Connected",
    toneClass: "connStateText-connected",
  });
  assert.equal(statusEl.textContent, "Connected");
  assert.equal(statusEl.classList.contains("connStateText-connected"), true);
  assert.equal(statusEl.classList.contains("connStateText-offline"), false);
});

test("renderAccountCenterSummary uses shared identity and connection classes", () => {
  const dom = installDom("<div id='summary'></div>");
  const summaryEl = dom.document.getElementById("summary");
  renderAccountCenterSummary(summaryEl, {
    handle: "@kyle",
    linked: true,
    connectionLabel: "Connected",
    connectionToneClass: "connStateText-connected",
  });
  assert.equal(summaryEl.querySelector(".identityHandle-linked").textContent, "@kyle");
  assert.equal(summaryEl.querySelector(".connStateText-connected").textContent, "Connected");
});

test("renderDataTable renders generic rows and empty state", () => {
  const dom = installDom("<div id='table'></div>");
  const tableEl = dom.document.getElementById("table");
  renderDataTable(tableEl, {
    columns: [
      { id: "time", header: "Time" },
      {
        id: "status",
        header: "Status",
        render: (row) => {
          const node = dom.document.createElement("strong");
          node.textContent = row.status;
          return node;
        },
      },
    ],
    rows: [{ time: "12:00", status: "ok" }],
  });
  assert.equal(tableEl.querySelector("table.cuTable").tagName, "TABLE");
  assert.equal(tableEl.querySelector("th").textContent, "Time");
  assert.equal(tableEl.querySelector("td strong").textContent, "ok");

  renderDataTable(tableEl, { columns: [], rows: [], emptyLabel: "Nothing here" });
  assert.equal(tableEl.querySelector(".cuTableEmpty").textContent, "Nothing here");
});

test("renderDataTable supports expanded row content", () => {
  const dom = installDom("<div id='table'></div>");
  const tableEl = dom.document.getElementById("table");
  renderDataTable(tableEl, {
    columns: [
      { id: "name", header: "Name" },
      { id: "status", header: "Status" },
    ],
    rows: [{ name: "Gateway", status: "ok" }],
    renderExpandedRow: (row) => {
      const node = dom.document.createElement("div");
      node.className = "details";
      node.textContent = `${row.name} details`;
      return node;
    },
  });
  assert.equal(tableEl.querySelectorAll("tbody tr").length, 2);
  assert.equal(tableEl.querySelector(".cuTableExpandedCell").colSpan, 2);
  assert.equal(tableEl.querySelector(".details").textContent, "Gateway details");
});

test("bindFirstPartyShellChrome owns shared drawer, account, notification, and nav interactions", () => {
  const dom = installDom("<div id='app'></div>");
  const root = dom.document.getElementById("app");
  const shell = renderFirstPartyShell(root, {
    navItems: [
      { id: "live", label: "Live", active: true },
      { id: "health", label: "Health" },
    ],
  });
  const selected = [];
  let cleared = 0;
  const controller = bindFirstPartyShellChrome(shell, {
    onNavSelect: (activity) => selected.push(activity),
    onNotificationClear: () => { cleared += 1; },
    closeOnOutsideClick: false,
  });

  shell.btnMenuEl.click();
  assert.equal(shell.drawerEl.classList.contains("hidden"), false);
  assert.equal(shell.drawerBackdropEl.classList.contains("hidden"), false);
  shell.btnDrawerCloseEl.click();
  assert.equal(shell.drawerEl.classList.contains("hidden"), true);

  shell.accountRailButtonEl.click();
  assert.equal(shell.accountCenterMenuEl.classList.contains("hidden"), false);
  assert.equal(shell.accountRailButtonEl.getAttribute("aria-expanded"), "true");
  shell.accountRailButtonEl.click();
  assert.equal(shell.accountCenterMenuEl.classList.contains("hidden"), true);
  assert.equal(shell.accountRailButtonEl.getAttribute("aria-expanded"), "false");

  shell.btnBellEl.click();
  assert.equal(shell.notifMenuEl.classList.contains("hidden"), false);
  shell.btnNotifClearEl.click();
  assert.equal(cleared, 1);

  shell.navButtons[1].click();
  assert.deepEqual(selected, ["health"]);
  assert.equal(shell.navButtons[0].classList.contains("active"), false);
  assert.equal(shell.navButtons[1].classList.contains("active"), true);
  assert.equal(controller.navButtonActivity(shell.navButtons[1]), "health");
});
