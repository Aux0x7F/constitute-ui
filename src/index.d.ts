export type ViewModel<T> = {
  current(): T;
  set(nextValue: T): void;
  update(updater: (currentValue: T) => T): void;
  subscribe(listener: (value: T) => void, options?: { emit?: boolean }): () => void;
};

export type ActionDescriptor = {
  id: string;
  label: string;
  pendingLabel?: string;
  description?: string;
  disabled?: boolean;
  hidden?: boolean;
  pending?: boolean;
  tone?: string;
  onSelect?: (action: ActionDescriptor) => void;
};

export type FirstPartyShellOptions = {
  appName?: string;
  navItems?: Array<{ id: string; label: string; hidden?: boolean; active?: boolean }>;
  mainHtml?: string;
  panePath?: boolean;
  accountCenterTitle?: string;
};

export type FirstPartyShell = {
  root: HTMLDivElement;
  appNameEl: HTMLElement;
  panePathEl: HTMLElement | null;
  btnBellEl: HTMLButtonElement;
  notifMenuEl: HTMLElement;
  btnNotifClearEl: HTMLButtonElement;
  notifListEl: HTMLDivElement;
  btnMenuEl: HTMLButtonElement;
  drawerEl: HTMLElement;
  drawerBackdropEl: HTMLElement;
  btnDrawerCloseEl: HTMLButtonElement;
  drawerNavEl: HTMLElement;
  navButtons: HTMLButtonElement[];
  accountRailButtonEl: HTMLButtonElement;
  accountCenterMenuEl: HTMLElement;
  accountCenterSummaryEl: HTMLElement;
  accountCenterActionsEl: HTMLDivElement;
  identityHandleEl: HTMLSpanElement;
  connWrapEl: HTMLSpanElement;
  connStateTextEl: HTMLSpanElement;
  connPopoverEl: HTMLDivElement;
  popConnectionEl: HTMLSpanElement;
  popRelayEl: HTMLSpanElement;
  popGatewayEl: HTMLSpanElement;
  popServicesEl: HTMLSpanElement;
  popConnectionReasonEl: HTMLDivElement;
  mainEl: HTMLElement;
};

export function createViewModel<T>(initialValue: T): ViewModel<T>;
export function renderActionList(container: HTMLElement, actions?: ActionDescriptor[]): void;
export function setConnectionStateText(element: HTMLElement, options?: {
  label?: string;
  toneClass?: string;
}): void;
export function renderAccountCenterSummary(container: HTMLElement, options?: {
  handle?: string;
  linked?: boolean;
  connectionLabel?: string;
  connectionToneClass?: string;
}): void;
export function createPanel(options?: { title?: string; hint?: string; className?: string }): {
  el: HTMLElement;
  titleEl: HTMLElement;
  hintEl: HTMLElement;
  bodyEl: HTMLElement;
};
export function createTile(options?: { title?: string; status?: string; className?: string }): {
  el: HTMLElement;
  titleEl: HTMLElement;
  statusEl: HTMLElement;
  bodyEl: HTMLElement;
  footerEl: HTMLElement;
};
export function createActionRow(options?: { label?: string; actions?: ActionDescriptor[] }): {
  el: HTMLElement;
  actionsEl: HTMLElement;
};
export function renderFirstPartyShell(root: HTMLDivElement, options?: FirstPartyShellOptions): FirstPartyShell;
