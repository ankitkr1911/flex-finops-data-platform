// Domain types for Flex FinOps

export type Severity = "critical" | "high" | "medium" | "low";
export type AnomalyStatus = "open" | "investigating" | "resolved";

export interface Anomaly {
  id: string;
  title: string;
  severity: Severity;
  service: string;
  detectedAt: string;
  impact: string;
  status: AnomalyStatus;
  deltaPercent: number;
}

export interface ResourceAllocation {
  id: string;
  name: string;
  team: string;
  allocated: number;
  used: number;
  unit: string;
  trend: "up" | "down" | "stable";
}

export interface CloudUsagePoint {
  date: string;
  compute: number;
  storage: number;
  network: number;
  database: number;
}

export interface ForecastSlice {
  month: string;
  actual: number | null;
  forecast: number;
  budget: number;
}

export interface ConnectedApp {
  id: string;
  name: string;
  description: string;
  status: "connected" | "disconnected" | "pending";
  lastSync: string;
  direction: "inbound" | "outbound" | "bidirectional";
}

export type RequestStatus = "pending" | "approved" | "rejected";

export interface DataRequest {
  id: string;
  fromApp: string;
  dataset: string;
  requestedAt: string;
  status: RequestStatus;
  recordCount: number;
  purpose: string;
  changeSummary?: string;
  changePayload?: unknown;
}

export interface PublishedDataset {
  id: string;
  name: string;
  description: string;
  schema: string[];
  consumers: string[];
  lastPublished: string;
  status: "active" | "draft";
  recordCount: number;
}

export type SavingsStage = "identified" | "approved" | "implementing" | "realized";

export interface SavingsOpportunity {
  id: string;
  title: string;
  category: "compute" | "storage" | "rightsizing" | "commitment";
  monthlySavings: number;
  effort: "low" | "medium" | "high";
  confidence: number;
  action: string;
  stage: SavingsStage;
  owner: string;
}

export interface ChargebackRow {
  id: string;
  team: string;
  costCenter: string;
  initiative: string;
  owner: string;
  monthlySpend: number;
  budget: number;
  forecast: number;
  headcount: number;
  costPerEngineer: number;
  tagCompliance: number;
  trend: "up" | "down" | "stable";
}

export type WorkforceSignal = "hire" | "reallocate" | "stable" | "optimize";

export interface SquadWorkforceRow {
  id: string;
  squad: string;
  platformLead: string;
  headcount: number;
  capacityUsedPct: number;
  cloudCostMonthly: number;
  costPerHead: number;
  dhubCapacityUnits: number;
  flexAllocatedVcpu: number;
  signal: WorkforceSignal;
  signalReason: string;
}

export interface AlignmentItem {
  id: string;
  initiative: string;
  squad: string;
  finance: "on-track" | "at-risk" | "off-track";
  planning: "on-track" | "at-risk" | "off-track";
  spendDeltaPct: number;
  capacityDeltaPct: number;
  note: string;
}
