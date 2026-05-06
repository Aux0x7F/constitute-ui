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

        <div id="accountCenterMenu" class="menu menuInline hidden" aria-label="${String(accountCenterTitle)} center">
          <div class="menuHeader">
            <div class="menuTitle">${String(accountCenterTitle)}</div>
          </div>
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
