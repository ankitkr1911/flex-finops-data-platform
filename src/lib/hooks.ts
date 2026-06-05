/**
 * React Query hooks for Flex Data Platform API.
 * Uses the api-client functions; provides caching, refetching, and error handling.
 * Falls back to mock data when the API is unreachable.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchKpis,
  fetchKpiTrend,
  fetchAnomalies,
  fetchSavings,
  fetchChargeback,
  fetchCloudUsage,
  fetchWorkforce,
  updateAnomalyStatus,
  updateSavingsStage,
  type KpiData,
} from "./api-client";
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
import {
  kpis as mockKpis,
  cloudUsageHistory,
  forecastData,
  initialAnomalies,
  initialSavings,
  chargebackRows,
  squadWorkforceRows,
} from "./mockData";

const STALE_TIME = 30_000; // 30s
const REFETCH_INTERVAL = 60_000; // 60s

// ------- KPIs -------

export function useKpis() {
  return useQuery<KpiData>({
    queryKey: ["kpis"],
    queryFn: () => fetchKpis(),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    placeholderData: mockKpis,
  });
}

// ------- KPI Trend / Forecast -------

export function useKpiTrend() {
  return useQuery<ForecastSlice[]>({
    queryKey: ["kpis", "trend"],
    queryFn: () => fetchKpiTrend(),
    staleTime: STALE_TIME,
    placeholderData: forecastData,
  });
}

// ------- Cloud Usage -------

export function useCloudUsage() {
  return useQuery<CloudUsagePoint[]>({
    queryKey: ["cloudUsage"],
    queryFn: () => fetchCloudUsage(),
    staleTime: STALE_TIME,
    placeholderData: cloudUsageHistory,
  });
}

// ------- Anomalies -------

export function useAnomalies() {
  return useQuery<Anomaly[]>({
    queryKey: ["anomalies"],
    queryFn: () => fetchAnomalies(),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    placeholderData: initialAnomalies,
  });
}

export function useUpdateAnomalyStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AnomalyStatus }) =>
      updateAnomalyStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anomalies"] });
      queryClient.invalidateQueries({ queryKey: ["kpis"] });
    },
  });
}

// ------- Savings -------

export function useSavings() {
  return useQuery<SavingsOpportunity[]>({
    queryKey: ["savings"],
    queryFn: () => fetchSavings(),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    placeholderData: initialSavings,
  });
}

export function useUpdateSavingsStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: SavingsStage }) =>
      updateSavingsStage(id, stage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings"] });
      queryClient.invalidateQueries({ queryKey: ["kpis"] });
    },
  });
}

// ------- Chargeback -------

export function useChargeback() {
  return useQuery<ChargebackRow[]>({
    queryKey: ["chargeback"],
    queryFn: () => fetchChargeback(),
    staleTime: STALE_TIME,
    placeholderData: chargebackRows,
  });
}

// ------- Workforce -------

export function useWorkforce() {
  return useQuery<SquadWorkforceRow[]>({
    queryKey: ["workforce"],
    queryFn: () => fetchWorkforce(),
    staleTime: STALE_TIME,
    placeholderData: squadWorkforceRows,
  });
}
