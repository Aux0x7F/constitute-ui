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
  materializationPosture: Readonly<Record<string, unknown>>;
  services: readonly PreparedServiceRegistryService[];
};

export type PreparedServiceRegistryOptions = {
  clientId?: string;
  surface?: string;
  materializationBudget?: Record<string, unknown>;
  consumerFloor?: Record<string, unknown>;
};

export type ServiceHostFabricReadModel = Readonly<{
  kind: "service.host-fabric.read-model";
  state: string;
  ready: boolean;
  blocked: boolean;
  degraded: boolean;
  blockedReasons: readonly string[];
  handoffRef: string;
  label: string;
}>;

export type ServiceLaunchReadModel = Readonly<{
  kind: "service.launch.read-model";
  state: string;
  ready: boolean;
  blocked: boolean;
  reason: string;
  label: string;
}>;

export type ServiceLaunchPostureOptions = {
  requiredSource?: string;
};

export function preparedServiceRegistry(snapshot?: Record<string, unknown>, options?: PreparedServiceRegistryOptions): PreparedServiceRegistry;
export function preparedServiceRegistryServices(snapshot?: Record<string, unknown>, options?: PreparedServiceRegistryOptions): readonly PreparedServiceRegistryService[];
export function prepareServiceHostFabricPosture(value?: Record<string, unknown>): ServiceHostFabricReadModel;
export function prepareServiceLaunchPosture(record?: Record<string, unknown>, options?: ServiceLaunchPostureOptions): ServiceLaunchReadModel;
