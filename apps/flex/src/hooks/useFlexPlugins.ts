import { useEffect, useMemo } from 'react';
import { useFlex } from '../store/FlexContext';
import { createPluginHost } from '../plugins/host';
import { mountPluginBridge } from '../lib/pluginBridge';
import { useInstalledExtensions } from './useInstalledExtensions';

export function useFlexPlugins() {
  const flex = useFlex();
  const { refreshKey } = useInstalledExtensions();

  const host = useMemo(
    () =>
      createPluginHost(
        () => ({
          dataRequests: flex.dataRequests,
          publishedDatasets: flex.publishedDatasets,
          anomalies: flex.anomalies,
          kpis: flex.kpis,
          transferLog: flex.transferLog,
          savings: flex.savings,
          chargeback: flex.chargeback,
          resourceAllocations: flex.resourceAllocations,
          tagRules: flex.tagRules,
          workforce: flex.workforce,
          connectedApps: flex.connectedApps,
          alignmentRows: flex.alignmentRows,
          resolvedAlignmentIds: flex.resolvedAlignmentIds,
          settings: flex.settings,
        }),
        {
          approveRequest: flex.approveRequest,
          rejectRequest: flex.rejectRequest,
          publishDataset: flex.publishDataset,
          createDataset: flex.createDataset,
          refreshFromExternal: flex.refreshFromExternal,
          pullPartnerData: flex.pullPartnerData,
          resolveAnomaly: flex.resolveAnomaly,
          createAnomaly: flex.createAnomaly,
          advanceSavingsStage: flex.advanceSavingsStage,
          updateChargeback: flex.updateChargeback,
          acknowledgeWorkforceSignal: flex.acknowledgeWorkforceSignal,
          resolveAlignmentConflict: flex.resolveAlignmentConflict,
          setUserRole: flex.setUserRole,
          setSlackApprovals: flex.setSlackApprovals,
          setPresentationMode: flex.setPresentationMode,
          setMeetingMode: flex.setMeetingMode,
          setSpendPulse: flex.setSpendPulse,
          setDesktopNotifications: flex.setDesktopNotifications,
          addInboundRequest: flex.addInboundRequest,
        }
      ),
    [flex, refreshKey]
  );

  useEffect(() => mountPluginBridge(host), [host]);

  return {
    host,
    catalog: host.catalog(),
  };
}
