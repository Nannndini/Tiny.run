export type HealthStatus = "ok" | "error";

export type HealthResponse = {
  status: HealthStatus;
  service: string;
};

export type PublicConfig = {
  apiUrl: string;
};
