import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditService } from '../modules/audit/audit.service';

/**
 * Event Handlers
 * Listens to domain events and performs side effects:
 * - Audit logging
 * - Notifications (Slack webhook placeholder)
 * - KPI cache invalidation
 *
 * In production, these map to AWS EventBridge → Lambda handlers.
 */
@Injectable()
export class EventHandlers {
  private readonly logger = new Logger(EventHandlers.name);

  constructor(private auditService: AuditService) {}

  @OnEvent('anomaly.detected')
  async handleAnomalyDetected(payload: any) {
    this.logger.warn(`🚨 ANOMALY DETECTED: ${payload.title} [${payload.severity}]`);

    await this.auditService.log(
      payload.businessUnitId,
      null, // system actor
      'anomaly.detected',
      'anomaly',
      payload.anomalyId || 'auto',
      payload,
    );

    // TODO: Slack webhook notification
    // await this.slackNotify(payload);
  }

  @OnEvent('anomaly.resolved')
  async handleAnomalyResolved(payload: any) {
    this.logger.log(`✅ Anomaly resolved: ${payload.title}`);

    await this.auditService.log(
      payload.businessUnitId,
      null,
      'anomaly.resolved',
      'anomaly',
      payload.anomalyId,
      payload,
    );
  }

  @OnEvent('exchange.requested')
  async handleExchangeRequested(payload: any) {
    this.logger.log(`📋 Data exchange requested: ${payload.request.dataset}`);

    await this.auditService.log(
      payload.businessUnitId,
      payload.request.requested_by,
      'exchange.requested',
      'data_request',
      payload.request.id,
      { dataset: payload.request.dataset, purpose: payload.request.purpose },
    );
  }

  @OnEvent('exchange.approved')
  async handleExchangeApproved(payload: any) {
    this.logger.log(`✅ Data exchange approved: ${payload.request.dataset}`);

    await this.auditService.log(
      payload.businessUnitId,
      payload.request.decided_by,
      'exchange.approved',
      'data_request',
      payload.request.id,
      { dataset: payload.request.dataset },
    );

    // TODO: Trigger actual data transfer pipeline
    // await this.triggerDataTransfer(payload.request);
  }

  @OnEvent('savings.stage_changed')
  async handleSavingsStageChanged(payload: any) {
    this.logger.log(`💰 Savings stage changed: ${payload.title} → ${payload.newStage}`);

    await this.auditService.log(
      payload.businessUnitId,
      payload.actorId,
      'savings.stage_changed',
      'savings',
      payload.savingsId,
      { from: payload.oldStage, to: payload.newStage },
    );
  }
}
