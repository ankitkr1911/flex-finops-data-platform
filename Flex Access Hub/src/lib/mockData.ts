import type {
  AlignmentItem,
  Anomaly,
  ChargebackRow,
  CloudUsagePoint,
  ConnectedApp,
  DataRequest,
  ForecastSlice,
  PublishedDataset,
  ResourceAllocation,
  SavingsOpportunity,
  SquadWorkforceRow,
} from "./types";

export const kpis = {
  totalSpend: 284750,
  spendChange: -4.2,
  utilization: 78.4,
  activeResources: 1247,
  openAnomalies: 5,
  pendingApprovals: 3,
  monthlySavingsIdentified: 41200,
  monthlySavingsRealized: 14800,
};

export const cloudUsageHistory: CloudUsagePoint[] = [
  { date: "Dec", compute: 38, storage: 16, network: 10, database: 26 },
  { date: "Jan", compute: 42, storage: 18, network: 12, database: 28 },
  { date: "Feb", compute: 45, storage: 19, network: 11, database: 30 },
  { date: "Mar", compute: 48, storage: 20, network: 13, database: 29 },
  { date: "Apr", compute: 52, storage: 22, network: 14, database: 32 },
  { date: "May", compute: 49, storage: 21, network: 12, database: 31 },
];

export const forecastData: ForecastSlice[] = [
  { month: "Jan", actual: 245000, forecast: 248000, budget: 250000 },
  { month: "Feb", actual: 258000, forecast: 252000, budget: 260000 },
  { month: "Mar", actual: 271000, forecast: 265000, budget: 270000 },
  { month: "Apr", actual: 289000, forecast: 278000, budget: 280000 },
  { month: "May", actual: 284750, forecast: 285000, budget: 290000 },
  { month: "Jun", actual: null, forecast: 294000, budget: 300000 },
  { month: "Jul", actual: null, forecast: 302000, budget: 310000 },
];

export const resourceAllocations: ResourceAllocation[] = [
  { id: "r1", name: "EKS Production", team: "Platform", allocated: 120, used: 98, unit: "vCPU", trend: "up" },
  { id: "r2", name: "RDS Analytics", team: "Data", allocated: 64, used: 61, unit: "vCPU", trend: "stable" },
  { id: "r3", name: "S3 Data Lake", team: "Data", allocated: 50, used: 42, unit: "TB", trend: "up" },
  { id: "r4", name: "Lambda APIs", team: "Product", allocated: 2000, used: 1450, unit: "GB-sec", trend: "down" },
  { id: "r5", name: "Redshift DW", team: "Finance", allocated: 32, used: 28, unit: "nodes", trend: "stable" },
  { id: "r6", name: "CDN Edge", team: "Platform", allocated: 8, used: 6.2, unit: "TB/mo", trend: "up" },
  { id: "r7", name: "ElastiCache", team: "Product", allocated: 24, used: 19, unit: "nodes", trend: "stable" },
  { id: "r8", name: "OpenSearch", team: "Data", allocated: 16, used: 11, unit: "nodes", trend: "down" },
];

export const initialAnomalies: Anomaly[] = [
  { id: "a1", title: "Compute spike — us-east-1", severity: "critical", service: "EC2", detectedAt: "2026-05-22T08:14:00Z", impact: "+$12.4K projected", status: "open", deltaPercent: 34 },
  { id: "a2", title: "Unattached EBS volumes", severity: "high", service: "EBS", detectedAt: "2026-05-21T16:30:00Z", impact: "$2.1K/mo waste", status: "investigating", deltaPercent: 0 },
  { id: "a3", title: "S3 egress anomaly", severity: "medium", service: "S3", detectedAt: "2026-05-20T11:00:00Z", impact: "Unusual transfer pattern", status: "open", deltaPercent: 18 },
  { id: "a4", title: "Idle RDS instances", severity: "medium", service: "RDS", detectedAt: "2026-05-19T09:45:00Z", impact: "$890/mo", status: "resolved", deltaPercent: -12 },
  { id: "a5", title: "Reserved instance mismatch", severity: "low", service: "Cost Explorer", detectedAt: "2026-05-18T14:20:00Z", impact: "Coverage gap 8%", status: "open", deltaPercent: 8 },
  { id: "a6", title: "NAT Gateway traffic surge", severity: "high", service: "VPC", detectedAt: "2026-05-22T03:11:00Z", impact: "+$3.8K projected", status: "open", deltaPercent: 22 },
];

export const connectedApps: ConnectedApp[] = [
  { id: "eztrac", name: "EzTrac", description: "Finance forecasting — budget & spend projections", status: "connected", lastSync: "2026-05-22T07:55:00Z", direction: "bidirectional" },
  { id: "dhub-rpt", name: "dhub-rpt", description: "Resource planning — capacity & allocation workflows", status: "connected", lastSync: "2026-05-22T07:42:00Z", direction: "bidirectional" },
  { id: "snowflake", name: "Snowflake", description: "Data warehouse — usage & spend telemetry", status: "connected", lastSync: "2026-05-22T06:10:00Z", direction: "inbound" },
  { id: "okta", name: "Okta", description: "Identity provider — RBAC sync", status: "pending", lastSync: "", direction: "inbound" },
];

export const initialDataRequests: DataRequest[] = [
  { id: "dr1", fromApp: "eztrac", dataset: "monthly_spend_by_service", requestedAt: "2026-05-22T06:00:00Z", status: "pending", recordCount: 1240, purpose: "Q3 forecast model refresh" },
  { id: "dr2", fromApp: "dhub-rpt", dataset: "resource_utilization_snapshots", requestedAt: "2026-05-21T14:30:00Z", status: "pending", recordCount: 890, purpose: "Capacity planning cycle" },
  { id: "dr3", fromApp: "eztrac", dataset: "anomaly_summary_export", requestedAt: "2026-05-20T10:00:00Z", status: "approved", recordCount: 45, purpose: "Risk-adjusted forecast" },
  { id: "dr4", fromApp: "snowflake", dataset: "tag_compliance_audit", requestedAt: "2026-05-22T09:12:00Z", status: "pending", recordCount: 320, purpose: "Governance audit" },
];

export const initialPublishedDatasets: PublishedDataset[] = [
  { id: "pd1", name: "cloud_cost_daily", description: "Daily aggregated cloud spend by service & region", schema: ["date", "service", "region", "amount_usd"], consumers: ["eztrac", "dhub-rpt"], lastPublished: "2026-05-22T00:00:00Z", status: "active", recordCount: 36500 },
  { id: "pd2", name: "allocation_matrix", description: "Team-level resource allocation vs actual usage", schema: ["team", "resource", "allocated", "used", "unit"], consumers: ["dhub-rpt"], lastPublished: "2026-05-21T18:00:00Z", status: "active", recordCount: 420 },
  { id: "pd3", name: "finops_kpi_bundle", description: "Executive KPIs for dashboards", schema: ["kpi", "value", "period"], consumers: ["eztrac"], lastPublished: "2026-05-20T12:00:00Z", status: "active", recordCount: 24 },
  { id: "pd4", name: "anomaly_feed", description: "Real-time anomaly events (draft)", schema: ["id", "severity", "service", "impact"], consumers: [], lastPublished: "", status: "draft", recordCount: 0 },
];

export const initialSavings: SavingsOpportunity[] = [
  { id: "s1", title: "Rightsize EC2 in us-east-1", category: "rightsizing", monthlySavings: 12400, effort: "low", confidence: 92, action: "Downsize 14 instances from m5.2xlarge → m5.xlarge", stage: "implementing", owner: "Platform" },
  { id: "s2", title: "Delete unattached EBS volumes", category: "storage", monthlySavings: 2100, effort: "low", confidence: 98, action: "Remove 23 volumes · 4.2 TB", stage: "realized", owner: "Cloud Ops" },
  { id: "s3", title: "Savings Plan coverage gap", category: "commitment", monthlySavings: 8700, effort: "medium", confidence: 85, action: "Increase Compute SP by $18K/mo", stage: "approved", owner: "Finance" },
  { id: "s4", title: "Schedule non-prod shutdowns", category: "compute", monthlySavings: 5400, effort: "low", confidence: 90, action: "Auto-stop 32 dev/staging EC2 nights & weekends", stage: "identified", owner: "Platform" },
  { id: "s5", title: "S3 Intelligent-Tiering migration", category: "storage", monthlySavings: 3200, effort: "medium", confidence: 88, action: "Move 18 TB cold data to IA/Glacier tiers", stage: "identified", owner: "Data" },
  { id: "s6", title: "Spot instances for batch jobs", category: "compute", monthlySavings: 9400, effort: "high", confidence: 76, action: "Convert ETL fleet to mixed-instance ASG with 70% spot", stage: "identified", owner: "Data" },
];

export const chargebackRows: ChargebackRow[] = [
  { id: "cb1", team: "Platform Engineering", costCenter: "CC-4100", initiative: "INIT-CLOUD-OPS", owner: "S. Chen", monthlySpend: 142500, budget: 135000, forecast: 148200, headcount: 24, costPerEngineer: 5938, tagCompliance: 94, trend: "up" },
  { id: "cb2", team: "Data Platform", costCenter: "CC-4200", initiative: "INIT-DATA-PLATFORM", owner: "M. Patel", monthlySpend: 78400, budget: 82000, forecast: 79100, headcount: 18, costPerEngineer: 4356, tagCompliance: 88, trend: "stable" },
  { id: "cb3", team: "Product Engineering", costCenter: "CC-4300", initiative: "INIT-PRODUCT-CORE", owner: "J. Rivera", monthlySpend: 36800, budget: 40000, forecast: 36200, headcount: 32, costPerEngineer: 1150, tagCompliance: 72, trend: "down" },
  { id: "cb4", team: "Finance Systems", costCenter: "CC-1100", initiative: "INIT-FIN-OPS", owner: "A. Okonkwo", monthlySpend: 12400, budget: 15000, forecast: 12800, headcount: 6, costPerEngineer: 2067, tagCompliance: 100, trend: "stable" },
  { id: "cb5", team: "Security & Compliance", costCenter: "CC-5100", initiative: "INIT-SEC-GOV", owner: "L. Kim", monthlySpend: 8650, budget: 9500, forecast: 8800, headcount: 9, costPerEngineer: 961, tagCompliance: 98, trend: "stable" },
  { id: "cb6", team: "ML Research", costCenter: "CC-4500", initiative: "INIT-AI-RND", owner: "R. Nakamura", monthlySpend: 56200, budget: 50000, forecast: 61400, headcount: 11, costPerEngineer: 5109, tagCompliance: 81, trend: "up" },
];

export const squadWorkforceRows: SquadWorkforceRow[] = [
  { id: "wf1", squad: "FinOps", platformLead: "Platform Engineering", headcount: 8, capacityUsedPct: 112, cloudCostMonthly: 42800, costPerHead: 5350, dhubCapacityUnits: 36, flexAllocatedVcpu: 32, signal: "reallocate", signalReason: "dhub-rpt at 112% — reallocate vCPU or defer new workloads" },
  { id: "wf2", squad: "Data Ingest", platformLead: "Data Platform", headcount: 12, capacityUsedPct: 94, cloudCostMonthly: 31200, costPerHead: 2600, dhubCapacityUnits: 28, flexAllocatedVcpu: 26, signal: "stable", signalReason: "Capacity and cloud spend aligned within 6%" },
  { id: "wf3", squad: "Core API", platformLead: "Product Engineering", headcount: 22, capacityUsedPct: 78, cloudCostMonthly: 18400, costPerHead: 836, dhubCapacityUnits: 40, flexAllocatedVcpu: 18, signal: "optimize", signalReason: "Low cloud per head — rightsizing opportunity in Lambda layer" },
  { id: "wf4", squad: "ML Platform", platformLead: "Data Platform", headcount: 6, capacityUsedPct: 118, cloudCostMonthly: 52400, costPerHead: 8733, dhubCapacityUnits: 14, flexAllocatedVcpu: 16, signal: "hire", signalReason: "GPU spend rising 34% — squad over capacity, hiring signal for dhub-rpt" },
  { id: "wf5", squad: "SRE", platformLead: "Platform Engineering", headcount: 10, capacityUsedPct: 88, cloudCostMonthly: 22100, costPerHead: 2210, dhubCapacityUnits: 22, flexAllocatedVcpu: 20, signal: "stable", signalReason: "Steady utilization, on-budget" },
  { id: "wf6", squad: "Security Eng", platformLead: "Security & Compliance", headcount: 7, capacityUsedPct: 71, cloudCostMonthly: 9400, costPerHead: 1343, dhubCapacityUnits: 18, flexAllocatedVcpu: 8, signal: "optimize", signalReason: "Headroom for additional automation workloads" },
];

export const alignmentItems: AlignmentItem[] = [
  { id: "al1", initiative: "INIT-CLOUD-OPS", squad: "FinOps", finance: "at-risk", planning: "off-track", spendDeltaPct: 9.8, capacityDeltaPct: 12, note: "Over budget; capacity strained by ad-hoc projects" },
  { id: "al2", initiative: "INIT-DATA-PLATFORM", squad: "Data Ingest", finance: "on-track", planning: "on-track", spendDeltaPct: -4.4, capacityDeltaPct: -6, note: "Aligned; small under-utilization" },
  { id: "al3", initiative: "INIT-PRODUCT-CORE", squad: "Core API", finance: "on-track", planning: "on-track", spendDeltaPct: -8, capacityDeltaPct: -22, note: "Lambda rightsizing realized; capacity available" },
  { id: "al4", initiative: "INIT-AI-RND", squad: "ML Platform", finance: "off-track", planning: "off-track", spendDeltaPct: 12.4, capacityDeltaPct: 18, note: "GPU demand outpacing forecast — escalate to LT" },
  { id: "al5", initiative: "INIT-SEC-GOV", squad: "Security Eng", finance: "on-track", planning: "on-track", spendDeltaPct: -8.9, capacityDeltaPct: -29, note: "Major headroom — candidate for new workloads" },
];
