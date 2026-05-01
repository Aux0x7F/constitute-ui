function bySelector(root, selector) {
  const node = root.querySelector(selector);
  if (!node) throw new Error(`missing element ${selector}`);
  return node;
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
