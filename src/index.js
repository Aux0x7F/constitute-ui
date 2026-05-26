function bySelector(root, selector) {
  const node = root.querySelector(selector);
  if (!node) throw new Error(`missing element ${selector}`);
  return node;
}

function isNodeLike(value) {
  return Boolean(value && typeof value === "object" && typeof value.nodeType === "number");
}

function bellIconSvg() {
  return `
    <svg class="cuIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 4.75a4.25 4.25 0 0 0-4.25 4.25v2.06c0 .9-.28 1.77-.8 2.5L5.5 15.5h13l-1.45-1.94a4.22 4.22 0 0 1-.8-2.5V9A4.25 4.25 0 0 0 12 4.75Z" />
      <path d="M10.25 18a1.75 1.75 0 0 0 3.5 0" />
    </svg>
  `;
}

function menuIconSvg() {
  return `
    <svg class="cuIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 7.25h14" />
      <path d="M5 12h14" />
      <path d="M5 16.75h14" />
    </svg>
  `;
}

function closeIconSvg() {
  return `
    <svg class="cuIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6.5 6.5 17.5 17.5" />
      <path d="M17.5 6.5 6.5 17.5" />
    </svg>
  `;
}

function chevronIconSvg() {
  return `
    <svg class="cuIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7.25 10.25 12 15l4.75-4.75" />
    </svg>
  `;
}

const CONNECTION_TEXT_CLASSES = Object.freeze([
  "connStateText-connected",
  "connStateText-limited",
  "connStateText-error",
  "connStateText-offline",
]);

export function createViewModel(initialValue) {
  let currentValue = initialValue;
  const listeners = new Set();

  return {
    current() {
      return currentValue;
    },
    set(nextValue) {
      currentValue = nextValue;
      for (const listener of listeners) listener(currentValue);
    },
    update(updater) {
      currentValue = updater(currentValue);
      for (const listener of listeners) listener(currentValue);
    },
    subscribe(listener, { emit = true } = {}) {
      listeners.add(listener);
      if (emit) listener(currentValue);
      return () => listeners.delete(listener);
    },
  };
}

export function renderActionList(container, actions = []) {
  container.innerHTML = "";
  for (const action of actions) {
    if (!action || action.hidden) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `cuAction ${action.tone ? `cuAction-${action.tone}` : ""}`.trim();
    button.dataset.action = String(action.id || "");
    button.disabled = Boolean(action.disabled || action.pending);
    button.textContent = action.pending ? String(action.pendingLabel || action.label || "") : String(action.label || "");
    if (action.description) button.title = String(action.description);
    if (typeof action.onSelect === "function") {
      button.addEventListener("click", () => action.onSelect(action));
    }
    container.appendChild(button);
  }
}

export function setConnectionStateText(element, {
  label = "Offline",
  toneClass = "connStateText-offline",
} = {}) {
  if (!element) return;
  element.textContent = String(label || "Offline");
  element.classList.remove(...CONNECTION_TEXT_CLASSES);
  element.classList.add(toneClass || "connStateText-offline");
}

export function renderAccountCenterSummary(container, {
  handle = "@unlinked",
  linked = false,
  connectionLabel = "Offline",
  connectionToneClass = "connStateText-offline",
} = {}) {
  if (!container) return;
  container.replaceChildren();

  const line = document.createElement("div");
  line.className = "accountCenterSummaryLine";

  const handleEl = document.createElement("span");
  handleEl.className = `identityHandle ${linked ? "identityHandle-linked" : "identityHandle-unlinked"}`;
  handleEl.textContent = String(handle || "@unlinked");

  const dotEl = document.createElement("span");
  dotEl.className = "accountCenterSummaryDot";
  dotEl.setAttribute("aria-hidden", "true");
  dotEl.textContent = "•";

  const connectionEl = document.createElement("span");
  connectionEl.className = "connStateText";
  setConnectionStateText(connectionEl, {
    label: connectionLabel,
    toneClass: connectionToneClass,
  });

  line.append(handleEl, dotEl, connectionEl);
  container.appendChild(line);
}

export function createPanel({ title = "", hint = "", className = "" } = {}) {
  const el = document.createElement("section");
  el.className = `cuPanel ${className}`.trim();
  el.innerHTML = `
    <div class="cuPanelHeader">
      <div>
        <h2 class="cuPanelTitle"></h2>
        <p class="cuPanelHint hidden"></p>
      </div>
    </div>
    <div class="cuPanelBody"></div>
  `;
  const titleEl = bySelector(el, ".cuPanelTitle");
  const hintEl = bySelector(el, ".cuPanelHint");
  const bodyEl = bySelector(el, ".cuPanelBody");
  titleEl.textContent = title;
  hintEl.textContent = hint;
  hintEl.classList.toggle("hidden", !hint);
  return { el, titleEl, hintEl, bodyEl };
}

export function createTile({ title = "", status = "", className = "" } = {}) {
  const el = document.createElement("article");
  el.className = `cuTile ${className}`.trim();
  el.innerHTML = `
    <header class="cuTileHeader">
      <strong class="cuTileTitle"></strong>
      <span class="cuTileStatus"></span>
    </header>
    <div class="cuTileBody"></div>
    <footer class="cuTileFooter"></footer>
  `;
  const titleEl = bySelector(el, ".cuTileTitle");
  const statusEl = bySelector(el, ".cuTileStatus");
  titleEl.textContent = title;
  statusEl.textContent = status;
  return {
    el,
    titleEl,
    statusEl,
    bodyEl: bySelector(el, ".cuTileBody"),
    footerEl: bySelector(el, ".cuTileFooter"),
  };
}

export function createActionRow({ label = "", actions = [] } = {}) {
  const el = document.createElement("div");
  el.className = "cuActionRow";
  el.innerHTML = `
    <div class="cuActionRowLabel"></div>
    <div class="cuActionRowActions"></div>
  `;
  bySelector(el, ".cuActionRowLabel").textContent = label;
  renderActionList(bySelector(el, ".cuActionRowActions"), actions);
  return {
    el,
    actionsEl: bySelector(el, ".cuActionRowActions"),
  };
}

export function renderDataTable(container, {
  columns = [],
  rows = [],
  emptyLabel = "No records",
  className = "",
  getRowClassName,
  renderExpandedRow,
} = {}) {
  if (!container) return null;
  container.replaceChildren();

  const wrap = document.createElement("div");
  wrap.className = `cuTableWrap ${className}`.trim();

  if (!Array.isArray(rows) || rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "cuTableEmpty";
    empty.textContent = String(emptyLabel || "No records");
    wrap.appendChild(empty);
    container.appendChild(wrap);
    return { wrap, table: null };
  }

  const table = document.createElement("table");
  table.className = "cuTable";

  const visibleColumns = columns.filter((column) => column && !column.hidden);
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const column of visibleColumns) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = String(column.header || column.label || column.id || "");
    if (column.className) th.className = String(column.className);
    if (column.align) th.dataset.align = String(column.align);
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);

  const tbody = document.createElement("tbody");
  rows.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");
    const rowClass = typeof getRowClassName === "function" ? getRowClassName(row, rowIndex) : "";
    if (rowClass) tr.className = String(rowClass);
    for (const column of visibleColumns) {
      const td = document.createElement("td");
      if (column.className) td.className = String(column.className);
      if (column.align) td.dataset.align = String(column.align);
      const value = typeof column.render === "function"
        ? column.render(row, rowIndex, column)
        : row?.[column.id];
      appendTableCellValue(td, value);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
    if (typeof renderExpandedRow === "function") {
      const expandedValue = renderExpandedRow(row, rowIndex);
      if (expandedValue !== null && expandedValue !== undefined && expandedValue !== false) {
        const expandedRow = document.createElement("tr");
        expandedRow.className = "cuTableExpandedRow";
        const expandedCell = document.createElement("td");
        expandedCell.className = "cuTableExpandedCell";
        expandedCell.colSpan = Math.max(visibleColumns.length, 1);
        appendTableCellValue(expandedCell, expandedValue);
        expandedRow.appendChild(expandedCell);
        tbody.appendChild(expandedRow);
      }
    }
  });

  table.append(thead, tbody);
  wrap.appendChild(table);
  container.appendChild(wrap);
  return { wrap, table };
}

export {
  prepareServiceHostFabricPosture,
  prepareServiceLaunchPosture,
  preparedServiceRegistry,
  preparedServiceRegistryServices,
} from "./service-registry-model.js";

export function renderPreparedCapabilityList(container, {
  records = [],
  emptyLabel = "No capabilities",
  onAction,
} = {}) {
  return renderPreparedRecordList(container, {
    records,
    emptyLabel,
    kind: "capability",
    onAction,
    getId: (record) => record.id || record.capability || record.name,
    getTitle: (record) => record.label || record.title || record.name || record.capability || record.id,
    getMeta: (record) => record.namespace || record.memberRef || record.serviceRef || record.scope || "",
    getStatus: (record) => record.status || record.health || record.freshness || "",
    getTags: (record) => record.channels || record.channelIds || record.capabilities || [],
  });
}

export function renderPreparedChannelList(container, {
  records = [],
  emptyLabel = "No channels",
  onAction,
} = {}) {
  return renderPreparedRecordList(container, {
    records,
    emptyLabel,
    kind: "channel",
    onAction,
    getId: (record) => record.channelId || record.id,
    getTitle: (record) => record.label || record.displayName || record.name || record.channelId || record.id,
    getMeta: (record) => record.kind || record.policy || record.owner || "",
    getStatus: (record) => record.status || record.freshness || "",
    getTags: (record) => record.capabilities || record.capabilityRefs || record.recordKinds || [],
  });
}

export function renderProjectionSyncStatus(container, {
  projectionId = "",
  revision = "",
  stale = false,
  gap = false,
  pending = false,
  pendingDeltas,
  repair = false,
  repairPending = false,
  repairRequested = false,
  lastAppliedAt = "",
  actions = [],
  onAction,
} = {}) {
  if (!container) return null;
  container.replaceChildren();

  const wrap = document.createElement("section");
  wrap.className = "cuStatusPanel cuProjectionStatus";
  wrap.setAttribute("aria-label", "Projection status");

  const header = createStatusHeader({
    title: projectionId || "Projection",
    status: stale || gap || pending || repair || repairPending || repairRequested ? "Needs sync" : "Current",
  });
  wrap.appendChild(header);

  const flags = document.createElement("div");
  flags.className = "cuStatusFlags";
  const pendingCount = normalizeCount(pendingDeltas);
  appendStatusFlag(flags, stale, "Stale", "warn");
  appendStatusFlag(flags, gap, "Gap", "bad");
  appendStatusFlag(flags, pending || pendingCount > 0, pendingCount > 0 ? `Pending ${pendingCount}` : "Pending", "warn");
  appendStatusFlag(flags, repair || repairPending || repairRequested, repairPending ? "Repair pending" : "Repair", "accent");
  if (!flags.childNodes.length) appendStatusFlag(flags, true, "Current", "good");
  wrap.appendChild(flags);

  wrap.appendChild(createKeyValueGrid([
    ["Revision", revision],
    ["Applied", lastAppliedAt],
  ]));

  appendPreparedActions(wrap, {
    actions,
    kind: "projection",
    recordId: projectionId,
    record: { projectionId, revision },
    onAction,
  });

  container.appendChild(wrap);
  return { wrap };
}

export function renderSwarmEdgeStatus(container, {
  queued = 0,
  sent = 0,
  rejected = 0,
  lastRejectReason = "",
  connected = false,
  mode = "",
  carrierState = "",
  connectionState = "",
  backpressureState = "",
  blockedReasons = [],
  actions = [],
  onAction,
} = {}) {
  if (!container) return null;
  container.replaceChildren();

  const wrap = document.createElement("section");
  wrap.className = "cuStatusPanel cuSwarmEdgeStatus";
  wrap.setAttribute("aria-label", "Swarm edge status");
  const blocked = Array.isArray(blockedReasons) ? blockedReasons.filter(Boolean) : [];
  const status = blocked.length
    ? "Blocked"
    : backpressureState && backpressureState !== "clear"
      ? backpressureState
      : carrierState
        ? carrierState
        : Number(rejected) > 0 ? "Rejects" : Number(queued) > 0 ? "Queued" : connected ? "Connected" : "Clear";
  wrap.appendChild(createStatusHeader({
    title: "Swarm edge",
    status,
  }));
  wrap.appendChild(createCountStrip([
    ["Queued", queued, "warn"],
    ["Sent", sent, "good"],
    ["Rejected", rejected, Number(rejected) > 0 ? "bad" : ""],
  ]));
  wrap.appendChild(createKeyValueGrid([
    ["Mode", mode],
    ["Carrier", carrierState],
    ["Connection", connectionState],
    ["Backpressure", backpressureState],
    ["Blocked", blocked.join(", ")],
    ["Last reject", lastRejectReason],
  ]));

  appendPreparedActions(wrap, {
    actions,
    kind: "swarmEdge",
    recordId: "swarm-edge",
    record: { queued, sent, rejected, lastRejectReason, connected, mode, carrierState, connectionState, backpressureState, blockedReasons: blocked },
    onAction,
  });

  container.appendChild(wrap);
  return { wrap };
}

export function renderStreamStatus(container, {
  sessionId = "",
  label = "",
  state = "unknown",
  health = "",
  transport = "",
  recovering = false,
  backoff = "",
  updatedAt = "",
  actions = [],
  onAction,
} = {}) {
  if (!container) return null;
  container.replaceChildren();

  const wrap = document.createElement("section");
  wrap.className = "cuStatusPanel cuStreamStatus";
  wrap.setAttribute("aria-label", "Stream status");
  const title = label || sessionId || "Stream";
  const status = health || state || "unknown";
  wrap.appendChild(createStatusHeader({ title, status }));
  wrap.appendChild(createKeyValueGrid([
    ["Session", sessionId],
    ["State", state],
    ["Health", health],
    ["Transport", transport],
    ["Recovery", recovering ? "Recovering" : ""],
    ["Backoff", backoff],
    ["Updated", updatedAt],
  ]));

  appendPreparedActions(wrap, {
    actions,
    kind: "stream",
    recordId: sessionId,
    record: { sessionId, label, state, health, transport, recovering, backoff, updatedAt },
    onAction,
  });

  container.appendChild(wrap);
  return { wrap };
}

export { createRuntimeSurfaceClient } from "./runtime-surface-client.js";
export { createRuntimeRunnerBridge } from "./runtime-runner-bridge.js";
export {
  prepareRuntimeHostFabricPosture,
  prepareRuntimeReadModel,
  prepareRuntimeTargetPosture,
} from "./runtime-read-model.js";
export {
  createServiceSurfaceAdapter,
  normalizeServiceSurfaceAdapterError,
  serviceSurfaceActionTimeoutMs,
  serviceSurfaceAdapterPosture,
} from "./service-surface-adapter.js";
export { surfaceAppSelectionReadModel } from "./surface-selection-read-model.js";
export {
  createSurfaceModuleRegistry,
  requireSurfaceModuleBinding,
  requireSurfaceModuleImplementation,
  surfaceAdapterBindingPosture,
  surfaceAppModuleBindings,
  surfaceAppModuleImplementations,
  surfaceModuleBinding,
  surfaceModuleRegistryPosture,
  surfacePlatformAdapterBindingPosture,
  surfaceServiceSurfaceAdapterBindingPosture,
} from "./surface-module-registry.js";

export {
  defaultEventMaterializationKey,
  defaultMergeMaterializedEvent,
  materializeEventSet,
} from "./materialized-event-set.js";

export {
  SURFACE_ADAPTER_TAXONOMY,
  SURFACE_CONTRACT_ROLE_ORDER,
  SURFACE_MODULE_ROLE_TAXONOMY,
  defineSurfaceAppContract,
  materializationBudgetRecord,
  materializationEnforcementPosture,
  materializationBudgetLimit,
  materializationBudgetUsage,
  materializationConsumerFloorRecord,
  materializationEventReplayPosture,
  requireSurfaceMaterializationBudget,
  requireSurfaceModuleRole,
  surfaceAdapterTaxonomyPosture,
  surfaceAppBootstrapContract,
  surfaceAppAttachContext,
  surfaceAppAuthorityAccessPosture,
  surfaceAppBootstrapPosture,
  surfaceAppContractResolution,
  surfaceAppContractPosture,
  surfaceAppDistributionPosture,
  surfaceAppFulfillmentIdentityPosture,
  surfaceAppInstancePosture,
  surfaceAppReleaseResolution,
  surfaceAppManifestSelection,
  surfaceNativeModuleLoadRunnerOperation,
  surfaceAppRuntimeSelectionPosture,
  surfaceAppRunnerFulfillmentReadiness,
  surfaceAppRunnerFulfillmentLifecycle,
  surfaceAppRunnerPlan,
  surfaceAppRunnerPlanFromManifest,
  surfaceAppServiceManagerActionability,
  surfaceAppSourceCandidatePosture,
  surfaceMaterializationBudgetPosture,
  surfaceModuleTaxonomyPosture,
  surfaceServiceManagerLabProof,
  surfaceServiceManagerOperationPosture,
  surfaceServiceManagerProofDigest,
  surfaceRunnerOperation,
  surfaceServiceManagerReleaseContract,
  surfaceServiceManagerSecretBoundary,
  surfaceServiceManagerTrainDigest,
  surfaceModuleRolePosture,
} from "./surface-app-contract.js";

function appendTableCellValue(cell, value) {
  if (isNodeLike(value)) {
    cell.appendChild(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      if (isNodeLike(item)) cell.appendChild(item);
      else cell.appendChild(document.createTextNode(String(item ?? "")));
    }
  } else {
    cell.textContent = String(value ?? "");
  }
}

function renderPreparedRecordList(container, {
  records,
  emptyLabel,
  kind,
  onAction,
  getId,
  getTitle,
  getMeta,
  getStatus,
  getTags,
}) {
  if (!container) return null;
  container.replaceChildren();

  const wrap = document.createElement("div");
  wrap.className = `cuPreparedList cuPreparedList-${kind}`;
  wrap.setAttribute("role", "list");

  const sortedRecords = [...(Array.isArray(records) ? records : [])]
    .filter(Boolean)
    .sort((left, right) => comparePreparedRecords(left, right, getTitle, getId));

  if (!sortedRecords.length) {
    const empty = document.createElement("div");
    empty.className = "cuPreparedListEmpty";
    empty.textContent = String(emptyLabel || "No records");
    wrap.appendChild(empty);
    container.appendChild(wrap);
    return { wrap, items: [] };
  }

  const items = [];
  for (const record of sortedRecords) {
    const recordId = String(getId(record) || "");
    const item = document.createElement("article");
    item.className = "cuPreparedRecord";
    item.setAttribute("role", "listitem");
    if (recordId) item.dataset.recordId = recordId;

    const main = document.createElement("div");
    main.className = "cuPreparedRecordMain";

    const titleRow = document.createElement("div");
    titleRow.className = "cuPreparedRecordTitleRow";
    const title = document.createElement("strong");
    title.className = "cuPreparedRecordTitle";
    title.textContent = String(getTitle(record) || "Untitled");
    titleRow.appendChild(title);

    const status = getStatus(record);
    if (status) {
      const statusEl = document.createElement("span");
      statusEl.className = "cuStatusPill";
      statusEl.textContent = String(status);
      titleRow.appendChild(statusEl);
    }
    main.appendChild(titleRow);

    const metaParts = [getMeta(record), recordId].filter(Boolean);
    if (metaParts.length) {
      const meta = document.createElement("div");
      meta.className = "cuPreparedRecordMeta";
      meta.textContent = metaParts.map(String).join(" · ");
      main.appendChild(meta);
    }

    const tags = normalizeTags(getTags(record));
    if (tags.length) main.appendChild(createTagList(tags));
    item.appendChild(main);

    appendPreparedActions(item, {
      actions: record.actions,
      kind,
      recordId,
      record,
      onAction,
    });

    wrap.appendChild(item);
    items.push(item);
  }

  container.appendChild(wrap);
  return { wrap, items };
}

function comparePreparedRecords(left, right, getTitle, getId) {
  const leftTitle = String(getTitle(left) || "").toLocaleLowerCase();
  const rightTitle = String(getTitle(right) || "").toLocaleLowerCase();
  const titleOrder = leftTitle.localeCompare(rightTitle);
  if (titleOrder !== 0) return titleOrder;
  return String(getId(left) || "").localeCompare(String(getId(right) || ""));
}

function appendPreparedActions(container, {
  actions = [],
  kind = "",
  recordId = "",
  record,
  onAction,
} = {}) {
  const visibleActions = Array.isArray(actions) ? actions.filter((action) => action && !action.hidden) : [];
  if (!visibleActions.length) return;

  const actionsEl = document.createElement("div");
  actionsEl.className = "cuPreparedActions";
  for (const action of visibleActions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `cuAction ${action.tone ? `cuAction-${action.tone}` : ""}`.trim();
    button.dataset.action = String(action.id || "");
    button.disabled = Boolean(action.disabled || action.pending);
    button.textContent = action.pending ? String(action.pendingLabel || action.label || "") : String(action.label || "");
    if (action.description) button.title = String(action.description);
    button.addEventListener("click", () => {
      const payload = Object.prototype.hasOwnProperty.call(action, "payload") ? action.payload : {
        kind,
        actionId: action.id || "",
        recordId,
        record,
      };
      if (typeof action.onSelect === "function") action.onSelect(payload);
      if (typeof onAction === "function") onAction(payload);
    });
    actionsEl.appendChild(button);
  }
  container.appendChild(actionsEl);
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item !== null && item !== undefined && item !== "")
    .map((item) => String(item))
    .sort((left, right) => left.localeCompare(right));
}

function createTagList(tags) {
  const row = document.createElement("div");
  row.className = "cuTagList";
  for (const tag of tags) {
    const tagEl = document.createElement("span");
    tagEl.className = "cuTag";
    tagEl.textContent = tag;
    row.appendChild(tagEl);
  }
  return row;
}

function createStatusHeader({ title = "", status = "" } = {}) {
  const header = document.createElement("header");
  header.className = "cuStatusHeader";
  const titleEl = document.createElement("strong");
  titleEl.className = "cuStatusTitle";
  titleEl.textContent = String(title || "Status");
  const statusEl = document.createElement("span");
  statusEl.className = "cuStatusPill";
  statusEl.textContent = String(status || "Unknown");
  header.append(titleEl, statusEl);
  return header;
}

function createCountStrip(items = []) {
  const strip = document.createElement("div");
  strip.className = "cuCountStrip";
  for (const [label, value, tone] of items) {
    const item = document.createElement("div");
    item.className = `cuCountItem ${tone ? `cuCountItem-${tone}` : ""}`.trim();
    const valueEl = document.createElement("strong");
    valueEl.className = "cuCountValue";
    valueEl.textContent = String(normalizeCount(value));
    const labelEl = document.createElement("span");
    labelEl.className = "cuCountLabel";
    labelEl.textContent = String(label || "");
    item.append(valueEl, labelEl);
    strip.appendChild(item);
  }
  return strip;
}

export function createKeyValueGrid(rows = []) {
  const grid = document.createElement("dl");
  grid.className = "cuKeyValueGrid";
  for (const [label, value] of rows) {
    if (value === null || value === undefined || value === "") continue;
    const term = document.createElement("dt");
    term.textContent = String(label || "");
    const detail = document.createElement("dd");
    detail.textContent = String(value);
    grid.append(term, detail);
  }
  return grid;
}

function appendStatusFlag(container, active, label, tone = "") {
  if (!active) return;
  const flag = document.createElement("span");
  flag.className = `cuStatusFlag ${tone ? `cuStatusFlag-${tone}` : ""}`.trim();
  flag.textContent = String(label || "");
  container.appendChild(flag);
}

function normalizeCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function renderNavButtons(navItems = []) {
  return navItems
    .filter((item) => item && !item.hidden)
    .map((item) => {
      const classes = ["navbtn"];
      if (item.active) classes.push("active");
      return `<button class="${classes.join(" ")}" type="button" data-activity="${String(item.id || "")}">${String(item.label || "")}</button>`;
    })
    .join("");
}

export function renderFirstPartyShell(root, {
  appName = "Constitute",
  navItems = [],
  mainHtml = "",
  panePath = true,
  accountCenterTitle = "Account",
} = {}) {
  const accountCenterTitleText = String(accountCenterTitle || "").trim();
  root.innerHTML = `
    <header class="topbar">
      <div class="left">
        <div class="title">
          <div id="appName" class="appname">${String(appName)}</div>
          ${panePath ? '<div id="panePath" class="small muted"></div>' : ""}
        </div>
      </div>
      <div class="right">
        <button id="btnBell" class="iconbtn" type="button" aria-label="Notifications">${bellIconSvg()}</button>
        <button id="btnMenu" class="iconbtn" type="button" aria-label="Menu">${menuIconSvg()}</button>
      </div>
    </header>

    <div id="notifMenu" class="menu hidden" aria-label="Notifications menu">
      <div class="menuHeader">
        <div class="menuTitle">Notifications</div>
        <button id="btnNotifClear" class="smallbtn" type="button">Clear</button>
      </div>
      <div id="notifList" class="menuList"></div>
    </div>

    <div id="drawerBackdrop" class="backdrop hidden"></div>
    <aside id="drawer" class="drawer hidden" aria-label="Navigation drawer">
      <div class="drawerHeader">
        <div class="drawerTitle">Menu</div>
        <button id="btnDrawerClose" class="iconbtn" type="button" aria-label="Close navigation">${closeIconSvg()}</button>
      </div>

      <nav id="drawerNav" class="drawerNav">
        ${renderNavButtons(navItems)}
      </nav>

      <div class="drawerFooter small muted">
        <button id="accountRailButton" class="accountRailButton" type="button" aria-haspopup="true" aria-expanded="false">
          <span class="accountRailLead">
            <span id="identityHandle" class="identityHandle identityHandle-unlinked" title="Identity not linked yet">@unlinked</span>
          </span>
          <span class="accountRailChevron" aria-hidden="true">${chevronIconSvg()}</span>
          <span id="connWrap" class="connWrap">
            <span id="connStateText" class="connStateText connStateText-offline">Offline</span>
            <div id="connPopover" class="popover hidden" role="status" aria-live="polite">
              <div class="popoverTitle">Connection Status</div>
              <div class="popoverRow"><span class="muted">Overall</span><span id="popConnection">offline</span></div>
              <div class="popoverRow"><span class="muted">Relay</span><span id="popRelay">offline</span></div>
              <div class="popoverRow"><span class="muted">Gateway</span><span id="popGateway">unknown</span></div>
              <div class="popoverRow"><span class="muted">Services</span><span id="popServices">unknown</span></div>
              <div id="popConnectionReason" class="popoverDetails muted">Waiting for runtime state.</div>
            </div>
          </span>
        </button>

        <div id="accountCenterMenu" class="menu menuInline hidden" aria-label="${accountCenterTitleText || "Account"} center">
          ${accountCenterTitleText ? `
          <div class="menuHeader">
            <div class="menuTitle">${accountCenterTitleText}</div>
          </div>` : ""}
          <div id="accountCenterSummary" class="accountCenterSummary small muted"></div>
          <div id="accountCenterActions" class="menuList"></div>
        </div>
      </div>
    </aside>

    <main id="appMain" class="main">${mainHtml}</main>
  `;

  return {
    root,
    appNameEl: bySelector(root, "#appName"),
    panePathEl: panePath ? bySelector(root, "#panePath") : null,
    btnBellEl: bySelector(root, "#btnBell"),
    notifMenuEl: bySelector(root, "#notifMenu"),
    btnNotifClearEl: bySelector(root, "#btnNotifClear"),
    notifListEl: bySelector(root, "#notifList"),
    btnMenuEl: bySelector(root, "#btnMenu"),
    drawerEl: bySelector(root, "#drawer"),
    drawerBackdropEl: bySelector(root, "#drawerBackdrop"),
    btnDrawerCloseEl: bySelector(root, "#btnDrawerClose"),
    drawerNavEl: bySelector(root, "#drawerNav"),
    navButtons: Array.from(root.querySelectorAll(".navbtn")),
    accountRailButtonEl: bySelector(root, "#accountRailButton"),
    accountCenterMenuEl: bySelector(root, "#accountCenterMenu"),
    accountCenterSummaryEl: bySelector(root, "#accountCenterSummary"),
    accountCenterActionsEl: bySelector(root, "#accountCenterActions"),
    identityHandleEl: bySelector(root, "#identityHandle"),
    connWrapEl: bySelector(root, "#connWrap"),
    connStateTextEl: bySelector(root, "#connStateText"),
    connPopoverEl: bySelector(root, "#connPopover"),
    popConnectionEl: bySelector(root, "#popConnection"),
    popRelayEl: bySelector(root, "#popRelay"),
    popGatewayEl: bySelector(root, "#popGateway"),
    popServicesEl: bySelector(root, "#popServices"),
    popConnectionReasonEl: bySelector(root, "#popConnectionReason"),
    mainEl: bySelector(root, "#appMain"),
  };
}

export function bindFirstPartyShellChrome(shell, {
  onNavSelect,
  onNotificationClear,
  closeOnOutsideClick = true,
  enableConnectionPopover = true,
} = {}) {
  if (!shell) throw new Error("shell is required");
  const state = {
    drawerOpen: false,
    accountCenterOpen: false,
    notificationMenuOpen: false,
  };

  const setDrawerOpen = (open) => {
    state.drawerOpen = Boolean(open);
    shell.drawerEl?.classList.toggle("hidden", !state.drawerOpen);
    shell.drawerBackdropEl?.classList.toggle("hidden", !state.drawerOpen);
  };
  const setAccountCenterOpen = (open) => {
    state.accountCenterOpen = Boolean(open);
    shell.accountRailButtonEl?.setAttribute("aria-expanded", state.accountCenterOpen ? "true" : "false");
    shell.accountCenterMenuEl?.classList.toggle("hidden", !state.accountCenterOpen);
  };
  const setNotificationMenuOpen = (open) => {
    state.notificationMenuOpen = Boolean(open);
    shell.notifMenuEl?.classList.toggle("hidden", !state.notificationMenuOpen);
  };
  const closeTransientMenus = () => {
    setAccountCenterOpen(false);
    setNotificationMenuOpen(false);
  };
  const navButtonActivity = (button) => String(button?.dataset?.activity || button?.dataset?.nav || "").trim();

  shell.btnMenuEl?.addEventListener("click", () => setDrawerOpen(true));
  shell.btnDrawerCloseEl?.addEventListener("click", () => setDrawerOpen(false));
  shell.drawerBackdropEl?.addEventListener("click", () => setDrawerOpen(false));
  shell.btnBellEl?.addEventListener("click", (event) => {
    event.stopPropagation();
    setNotificationMenuOpen(!state.notificationMenuOpen);
    setAccountCenterOpen(false);
  });
  shell.btnNotifClearEl?.addEventListener("click", () => {
    if (typeof onNotificationClear === "function") onNotificationClear();
  });
  shell.accountRailButtonEl?.addEventListener("click", (event) => {
    event.stopPropagation();
    setAccountCenterOpen(!state.accountCenterOpen);
    setNotificationMenuOpen(false);
  });
  for (const button of shell.navButtons || []) {
    button.addEventListener("click", () => {
      const activity = navButtonActivity(button);
      for (const candidate of shell.navButtons || []) {
        candidate.classList.toggle("active", navButtonActivity(candidate) === activity);
      }
      if (typeof onNavSelect === "function") onNavSelect(activity, button);
      setDrawerOpen(false);
    });
  }
  if (enableConnectionPopover) {
    shell.connPopoverEl?.classList.add("hidden");
    shell.connWrapEl?.addEventListener("mouseenter", () => shell.connPopoverEl?.classList.remove("hidden"));
    shell.connWrapEl?.addEventListener("mouseleave", () => shell.connPopoverEl?.classList.add("hidden"));
  }
  if (closeOnOutsideClick) {
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (state.notificationMenuOpen && !shell.notifMenuEl?.contains(target) && !shell.btnBellEl?.contains(target)) {
        setNotificationMenuOpen(false);
      }
      if (state.accountCenterOpen && !shell.accountCenterMenuEl?.contains(target) && !shell.accountRailButtonEl?.contains(target)) {
        setAccountCenterOpen(false);
      }
    });
  }

  return {
    state,
    navButtonActivity,
    openDrawer: () => setDrawerOpen(true),
    closeDrawer: () => setDrawerOpen(false),
    openAccountCenter: () => setAccountCenterOpen(true),
    closeAccountCenter: () => setAccountCenterOpen(false),
    openNotificationMenu: () => setNotificationMenuOpen(true),
    closeNotificationMenu: () => setNotificationMenuOpen(false),
    closeTransientMenus,
  };
}

export {
  projectionCoverage,
  projectionDeltaFor,
  projectionForNode,
  projectionMaterializationPosture,
  projectionNodePath,
  projectionPostureSummary,
  projectionRecordPolicyId,
  projectionRepairFor,
  projectionRuntimeKey,
  projectionUpdatedAt,
  selectProjectionForNode,
} from "./projection-read-model.js";
export {
  browserStorageShellContext,
  deriveRuntimeMaterializationPosture,
  deriveRuntimeShellState,
  runtimeShellConnectionToneClass,
} from "./runtime-shell-state.js";
export * from "./runtime-read-model.js";
