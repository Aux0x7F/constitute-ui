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
