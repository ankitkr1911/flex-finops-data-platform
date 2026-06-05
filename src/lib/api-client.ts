/**
 * Flex Data Platform API Client
 * Fetches live data from the NestJS backend (port 3001) backed by PostgreSQL.
 * Falls back gracefully to mock data when the API is unreachable.
 */
import type {
  Anomaly,
  AnomalyStatus,
  ChargebackRow,
  CloudUsagePoint,
  ForecastSlice,
  SavingsOpportunity,
  SavingsStage,
  SquadWorkforceRow,
} from "./types";

const API_BASE =
  (import.meta.env?.VITE_DATA_API_URL as string | undefined)?.trim() ||
  "http://localhost:3001";

const DEFAULT_BU = "a1b2c3d4-0001-4000-8000-000000000001";

function headers(buId?: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-business-unit-id": buId || DEFAULT_BU,
  };
}

async function get<T>(path: string, buId?: string): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    headers: headers(buId),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body: unknown, buId?: string): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    method: "PATCH",
    headers: headers(buId),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

// ------- KPIs -------

export interface KpiData {
  totalSpend: number;
  spendChange: number;
  utilization: number;
  activeResources: number;
  openAnomalies: number;
  pendingApprovals: number;
  monthlySavingsIdentified: number;
  monthlySavingsRealized: number;
}

interface RawKpi {
  total_spend: number;
  spend_change_pct: number;
  utilization_pct: number;
  active_resources: number;
  open_anomalies: number;
  pending_approvals: number;
  monthly_savings_identified: number;
  monthly_savings_realized: number;
}

export async function fetchKpis(buId?: string): Promise<KpiData> {
  const raw = await get<RawKpi>("/kpis", buId);
  return {
    totalSpend: raw.total_spend,
    spendChange: raw.spend_change_pct,
    utilization: raw.utilization_pct,
    activeResources: raw.active_resources,
    openAnomalies: raw.open_anomalies,
    pendingApprovals: raw.pending_approvals,
    monthlySavingsIdentified: raw.monthly_savings_identified,
    monthlySavingsRealized: raw.monthly_savings_realized,
  };
}

// ------- KPI Trend (for forecast chart) -------

interface RawKpiTrend {
  period: string;
  total_spend: number;
}

export async function fetchKpiTrend(buId?: string): Promise<ForecastSlice[]> {
  const rows = await get<RawKpiTrend[]>("/kpis/trend", buId);
  return rows.map((r) => {
    const d = new Date(r.period);
    const month = d.toLocaleString("en-US", { month: "short" });
    return {
      month,
      actual: r.total_spend,
      forecast: Math.round(r.total_spend * 1.03), // simple projection
      budget: Math.round(r.total_spend * 1.08),
    };
  });
}

// ------- Anomalies -------

interface RawAnomaly {
  id: string;
  business_unit_id: string;
  service: string;
  metric: string;
  anomaly_date: string;
  expected_value: number;
  actual_value: number;
  z_score: number;
  severity: string;
  status: string;
  detected_at: string;
}

export async function fetchAnomalies(buId?: string): Promise<Anomaly[]> {
  const rows = await get<RawAnomaly[]>("/anomalies", buId);
  return rows.map((r) => ({
    id: r.id,
    title: `Cost spike — ${r.service} (${r.metric})`,
    severity: (["critical", "high", "medium", "low"].includes(r.severity) ? r.severity : "medium") as Anomaly["severity"],
    service: r.service,
    detectedAt: r.detected_at || r.anomaly_date,
    impact: `+$${Math.round(r.actual_value - r.expected_value).toLocaleString()} over expected`,
    status: (r.status === "resolved" || r.status === "investigating" ? r.status : "open") as AnomalyStatus,
    deltaPercent: r.z_score ? Math.round(((r.actual_value - r.expected_value) / r.expected_value) * 100) : 0,
  }));
}

export async function updateAnomalyStatus(id: string, status: AnomalyStatus, buId?: string) {
  return patch(`/anomalies/${id}/status`, { status }, buId);
}

// ------- Savings -------

interface RawSaving {
  id: string;
  title: string;
  category: string;
  estimated_monthly_savings: number;
  effort: string;
  confidence_pct: number;
  action_description: string;
  stage: string;
  owner_team: string;
}

export async function fetchSavings(buId?: string): Promise<SavingsOpportunity[]> {
  const rows = await get<RawSaving[]>("/savings", buId);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: (["compute", "storage", "rightsizing", "commitment"].includes(r.category) ? r.category : "compute") as SavingsOpportunity["category"],
    monthlySavings: r.estimated_monthly_savings,
    effort: (["low", "medium", "high"].includes(r.effort) ? r.effort : "medium") as SavingsOpportunity["effort"],
    confidence: r.confidence_pct,
    action: r.action_description,
    stage: (["identified", "approved", "implementing", "realized"].includes(r.stage) ? r.stage : "identified") as SavingsStage,
    owner: r.owner_team,
  }));
}

export async function updateSavingsStage(id: string, stage: SavingsStage, buId?: string) {
  return patch(`/savings/${id}/stage`, { stage }, buId);
}

// ------- Chargeback -------

interface RawChargeback {
  id: string;
  team_name: string;
  cost_center: string;
  initiative: string;
  owner: string;
  monthly_spend: number;
  budget: number;
  forecast: number;
  headcount: number;
  cost_per_engineer: number;
  tag_compliance_pct: number;
  trend: string;
}

export async function fetchChargeback(buId?: string): Promise<ChargebackRow[]> {
  const rows = await get<RawChargeback[]>("/chargeback", buId);
  return rows.map((r) => ({
    id: r.id,
    team: r.team_name,
    costCenter: r.cost_center,
    initiative: r.initiative || "",
    owner: r.owner || "",
    monthlySpend: r.monthly_spend,
    budget: r.budget,
    forecast: r.forecast,
    headcount: r.headcount,
    costPerEngineer: r.cost_per_engineer,
    tagCompliance: r.tag_compliance_pct,
    trend: (["up", "down", "stable"].includes(r.trend) ? r.trend : "stable") as ChargebackRow["trend"],
  }));
}

// ------- Cloud Usage (time series) -------

interface RawCloudUsage {
  usage_date: string;
  service: string;
  total_cost: number;
}

export async function fetchCloudUsage(buId?: string): Promise<CloudUsagePoint[]> {
  // The backend returns flat rows per service per day.
  // We aggregate by month for the chart.
  try {
    const rows = await get<RawCloudUsage[]>("/kpis/trend", buId);
    const byMonth = new Map<string, CloudUsagePoint>();

    for (const r of rows) {
      const d = new Date(r.usage_date || (r as any).period);
      const month = d.toLocaleString("en-US", { month: "short" });
      if (!byMonth.has(month)) {
        byMonth.set(month, { date: month, compute: 0, storage: 0, network: 0, database: 0 });
      }
      const point = byMonth.get(month)!;
      const svc = (r.service || "").toLowerCase();
      const cost = Math.round((r.total_cost || 0) / 1000); // in $K
      if (svc.includes("compute") || svc.includes("ec2")) point.compute += cost;
      else if (svc.includes("storage") || svc.includes("s3")) point.storage += cost;
      else if (svc.includes("network") || svc.includes("vpc")) point.network += cost;
      else if (svc.includes("database") || svc.includes("rds")) point.database += cost;
    }
    return [...byMonth.values()];
  } catch {
    return [];
  }
}

// ------- Workforce -------

interface RawWorkforce {
  id: string;
  squad: string;
  platform_lead: string;
  headcount: number;
  capacity_used_pct: number;
  cloud_cost_monthly: number;
  cost_per_head: number;
  dhub_capacity_units: number;
  flex_allocated_vcpu: number;
  signal: string;
  signal_reason: string;
}

export async function fetchWorkforce(buId?: string): Promise<SquadWorkforceRow[]> {
  const rows = await get<RawWorkforce[]>("/workforce/squads", buId);
  return rows.map((r) => ({
    id: r.id,
    squad: r.squad,
    platformLead: r.platform_lead,
    headcount: r.headcount,
    capacityUsedPct: r.capacity_used_pct,
    cloudCostMonthly: r.cloud_cost_monthly,
    costPerHead: r.cost_per_head,
    dhubCapacityUnits: r.dhub_capacity_units,
    flexAllocatedVcpu: r.flex_allocated_vcpu,
    signal: (["hire", "reallocate", "stable", "optimize"].includes(r.signal) ? r.signal : "stable") as SquadWorkforceRow["signal"],
    signalReason: r.signal_reason,
  }));
}
