export type ViewModel<T> = {
  current(): T;
  set(nextValue: T): void;
  update(updater: (currentValue: T) => T): void;
  subscribe(listener: (value: T) => void, options?: { emit?: boolean }): () => void;
};

export type SurfaceAppModuleClaim = {
  moduleRef: string;
  role: string;
  participantSide: string;
  fulfillmentMode: string;
  version: string;
  buildId?: string;
  primitiveRefs?: string[];
  requiredCapabilities?: string[];
  inputs?: string[];
  outputs?: string[];
  fallbackRefs?: string[];
  issuedAt?: number;
  expiresAt?: number;
  [key: string]: unknown;
};

export type SurfaceAppContractShape = {
  contractId: string;
  appId: string;
  appRef?: string;
  serviceRef?: string;
  surfaceRef?: string;
  version: string;
  displayName?: string;
  requiredPrimitives?: string[];
  requiredModuleRoles?: string[];
  modules?: SurfaceAppModuleClaim[];
  projectionSubscriptions?: unknown[];
  permissionRequirements?: unknown[];
  capabilityRequirements?: unknown[];
  materializationBudgets?: unknown[];
  updatePosture?: Record<string, unknown>;
  [key: string]: unknown;
};

export type SurfaceAppPosture = {
  state: "ready" | "blocked";
  blockedReason: string;
  missingRoles: string[];
  moduleCount: number;
};

export type SurfaceModuleRolePosture = {
  kind: "surface.module.role.posture";
  state: "ready" | "blocked";
  blockedReason: string;
  role: string;
  moduleRef: string;
  primitiveRef: string;
  moduleCount: number;
  modules: readonly SurfaceAppModuleClaim[];
};
export type SurfaceMaterializationBudgetPosture = {
  kind: "surface.materialization.budget.posture";
  state: "ready" | "blocked";
  blockedReason: string;
  budgetId: string;
  payloadClass: string;
  copyRole: string;
  transferMode: string;
  budget: Record<string, unknown> | null;
};

export type SurfaceAppAttachContext = {
  kind: "surface.app.attachContext";
  contractId: string;
  appId: string;
  appRef: string;
  serviceRef: string;
  surfaceRef: string;
  version: string;
  displayName: string;
  posture: SurfaceAppPosture;
  requiredModuleRoles: string[];
  moduleRefs: Array<{
    moduleRef: string;
    role: string;
    participantSide: string;
    fulfillmentMode: string;
    version: string;
    buildId: string;
  }>;
  materializationBudgetRefs: string[];
  updatePosture?: Record<string, unknown>;
  [key: string]: unknown;
};

export type DefinedSurfaceApp = {
  contract: SurfaceAppContractShape;
  modules: readonly SurfaceAppModuleClaim[];
  modulesByRole: Readonly<Record<string, readonly SurfaceAppModuleClaim[]>>;
  requiredRoles: readonly string[];
  missingRoles: readonly string[];
  posture: SurfaceAppPosture;
  hasRole(role: string): boolean;
  moduleForRole(role: string): SurfaceAppModuleClaim | null;
  modulesForRole(role: string): readonly SurfaceAppModuleClaim[];
  attachContext(extra?: Record<string, unknown>): SurfaceAppAttachContext;
};

export const SURFACE_CONTRACT_ROLE_ORDER: readonly string[];
export function defineSurfaceAppContract(
  contract: SurfaceAppContractShape,
  options?: { validate?: (contract: SurfaceAppContractShape) => SurfaceAppContractShape },
): DefinedSurfaceApp;
export function surfaceAppContractPosture(surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape): SurfaceAppPosture;
export function surfaceAppAttachContext(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  extra?: Record<string, unknown>,
): SurfaceAppAttachContext;
export function surfaceModuleRolePosture(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  role: string,
  options?: { moduleRef?: string; primitiveRef?: string },
): SurfaceModuleRolePosture;
export function requireSurfaceModuleRole(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  role: string,
  options?: { moduleRef?: string; primitiveRef?: string },
): SurfaceAppModuleClaim;
export function surfaceMaterializationBudgetPosture(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  budgetId: string,
  options?: { payloadClass?: string; copyRole?: string; transferMode?: string },
): SurfaceMaterializationBudgetPosture;
export function requireSurfaceMaterializationBudget(
  surfaceAppOrContract: DefinedSurfaceApp | SurfaceAppContractShape,
  budgetId: string,
  options?: { payloadClass?: string; copyRole?: string; transferMode?: string },
): Record<string, unknown>;
export function materializationBudgetLimit(
  budget: Record<string, unknown> | null | undefined,
  key: string,
  fallback?: number,
): number;

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

export type PreparedActionPayload<T = Record<string, unknown>> = {
  kind: string;
  actionId: string;
  recordId: string;
  record: T;
};

export type PreparedAction<TPayload = unknown> = {
  id: string;
  label: string;
  pendingLabel?: string;
  description?: string;
  disabled?: boolean;
  hidden?: boolean;
  pending?: boolean;
  tone?: string;
  payload?: TPayload;
  onSelect?: (payload: TPayload | PreparedActionPayload) => void;
};

export type PreparedCapabilityRecord<TPayload = unknown> = {
  id?: string;
  capability?: string;
  name?: string;
  label?: string;
  title?: string;
  namespace?: string;
  memberRef?: string;
  serviceRef?: string;
  scope?: string;
  status?: string;
  health?: string;
  freshness?: string;
  channels?: string[];
  channelIds?: string[];
  capabilities?: string[];
  actions?: Array<PreparedAction<TPayload>>;
};

export type PreparedChannelRecord<TPayload = unknown> = {
  id?: string;
  channelId?: string;
  label?: string;
  displayName?: string;
  name?: string;
  kind?: string;
  policy?: string;
  owner?: string;
  status?: string;
  freshness?: string;
  capabilities?: string[];
  capabilityRefs?: string[];
  recordKinds?: string[];
  actions?: Array<PreparedAction<TPayload>>;
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

export type FirstPartyShellChromeController = {
  state: {
    drawerOpen: boolean;
    accountCenterOpen: boolean;
    notificationMenuOpen: boolean;
  };
  navButtonActivity(button: HTMLButtonElement): string;
  openDrawer(): void;
  closeDrawer(): void;
  openAccountCenter(): void;
  closeAccountCenter(): void;
  openNotificationMenu(): void;
  closeNotificationMenu(): void;
  closeTransientMenus(): void;
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
export type KeyValueRow = readonly [label: string, value: unknown];
export function createKeyValueGrid(rows?: KeyValueRow[]): HTMLDListElement;
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
export type DataTableColumn<T = Record<string, unknown>> = {
  id: string;
  header?: string;
  label?: string;
  className?: string;
  align?: "start" | "center" | "end";
  hidden?: boolean;
  render?: (row: T, rowIndex: number, column: DataTableColumn<T>) => string | Node | Array<string | Node> | null | undefined;
};
export function renderDataTable<T = Record<string, unknown>>(container: HTMLElement, options?: {
  columns?: Array<DataTableColumn<T>>;
  rows?: T[];
  emptyLabel?: string;
  className?: string;
  getRowClassName?: (row: T, rowIndex: number) => string;
  renderExpandedRow?: (row: T, rowIndex: number) => string | Node | Array<string | Node> | null | undefined | false;
}): { wrap: HTMLElement; table: HTMLTableElement | null } | null;
export function renderPreparedCapabilityList<TPayload = unknown>(container: HTMLElement, options?: {
  records?: Array<PreparedCapabilityRecord<TPayload>>;
  emptyLabel?: string;
  onAction?: (payload: TPayload | PreparedActionPayload<PreparedCapabilityRecord<TPayload>>) => void;
}): { wrap: HTMLElement; items: HTMLElement[] } | null;
export function renderPreparedChannelList<TPayload = unknown>(container: HTMLElement, options?: {
  records?: Array<PreparedChannelRecord<TPayload>>;
  emptyLabel?: string;
  onAction?: (payload: TPayload | PreparedActionPayload<PreparedChannelRecord<TPayload>>) => void;
}): { wrap: HTMLElement; items: HTMLElement[] } | null;
export function renderProjectionSyncStatus<TPayload = unknown>(container: HTMLElement, options?: {
  projectionId?: string;
  revision?: string | number;
  stale?: boolean;
  gap?: boolean;
  pending?: boolean;
  pendingDeltas?: number;
  repair?: boolean;
  repairPending?: boolean;
  repairRequested?: boolean;
  lastAppliedAt?: string;
  actions?: Array<PreparedAction<TPayload>>;
  onAction?: (payload: TPayload | PreparedActionPayload) => void;
}): { wrap: HTMLElement } | null;
export function renderSwarmEdgeStatus<TPayload = unknown>(container: HTMLElement, options?: {
  queued?: number;
  sent?: number;
  rejected?: number;
  lastRejectReason?: string;
  connected?: boolean;
  mode?: string;
  actions?: Array<PreparedAction<TPayload>>;
  onAction?: (payload: TPayload | PreparedActionPayload) => void;
}): { wrap: HTMLElement } | null;
export function renderStreamStatus<TPayload = unknown>(container: HTMLElement, options?: {
  sessionId?: string;
  label?: string;
  state?: string;
  health?: string;
  transport?: string;
  recovering?: boolean;
  backoff?: string;
  updatedAt?: string;
  actions?: Array<PreparedAction<TPayload>>;
  onAction?: (payload: TPayload | PreparedActionPayload) => void;
}): { wrap: HTMLElement } | null;
export function renderFirstPartyShell(root: HTMLDivElement, options?: FirstPartyShellOptions): FirstPartyShell;
export function bindFirstPartyShellChrome(shell: FirstPartyShell, options?: {
  onNavSelect?: (activity: string, button: HTMLButtonElement) => void;
  onNotificationClear?: () => void;
  closeOnOutsideClick?: boolean;
  enableConnectionPopover?: boolean;
}): FirstPartyShellChromeController;

export type PreparedServiceRegistryService = {
  service: string;
  servicePk: string;
  devicePk: string;
  pk: string;
  hostGatewayPk: string;
  label: string;
  status: string;
  health: Record<string, unknown>;
  __registrySource: "serviceRegistry" | "serviceCatalog";
  [key: string]: unknown;
};

export type PreparedServiceRegistry = {
  source: "serviceRegistry" | "serviceCatalog";
  state: string;
  registryId: string;
  updatedAt: number;
  serviceCount: number;
  claimCount: number;
  participantCount: number;
  entryCount: number;
  blockedReasons: readonly string[];
  services: readonly PreparedServiceRegistryService[];
};

export function preparedServiceRegistry(snapshot?: Record<string, unknown>): PreparedServiceRegistry;
export function preparedServiceRegistryServices(snapshot?: Record<string, unknown>): readonly PreparedServiceRegistryService[];

export * from "./projection-read-model.js";
