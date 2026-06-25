/**
 * INFRA-824: Cap metric cardinality in production instrumentation.
 *
 * Prevents unbounded label growth on metrics by enforcing cardinality limits
 * and capping label dimensions. This keeps observability affordable and useful
 * under Wave 5 production load.
 */

import { Injectable, Logger } from "@nestjs/common";

export interface MetricLabel {
  name: string;
  value: string;
}

export interface MetricEntry {
  name: string;
  value: number;
  labels: MetricLabel[];
  timestamp: Date;
}

const MAX_METRIC_LABELS = 10;
const MAX_LABEL_VALUE_LENGTH = 128;
const ALLOWED_METRIC_NAMES = [
  "job.enqueued",
  "job.completed",
  "job.failed",
  "job.dead",
  "job.replayed",
  "job.claimed",
  "web.request",
  "api.request",
  "rpc.call",
  "db.query",
  "cache.hit",
  "cache.miss",
];

@Injectable()
export class MetricCardinalityService {
  private readonly logger = new Logger(MetricCardinalityService.name);
  private readonly labelCardinality = new Map<string, Set<string>>();
  private readonly MAX_CARDINALITY_PER_METRIC = 100;

  validate(entry: MetricEntry): boolean {
    if (!ALLOWED_METRIC_NAMES.includes(entry.name)) {
      this.logger.warn(`Metric name not in allowlist: ${entry.name}`);
      return false;
    }

    if (entry.labels.length > MAX_METRIC_LABELS) {
      this.logger.warn(`Metric ${entry.name} exceeds max label count: ${entry.labels.length} > ${MAX_METRIC_LABELS}`);
      return false;
    }

    for (const label of entry.labels) {
      if (label.value.length > MAX_LABEL_VALUE_LENGTH) {
        this.logger.warn(`Label value too long for ${entry.name}.${label.name}: ${label.value.length} chars`);
        return false;
      }
    }

    const labelKey = entry.labels.map((l) => `${l.name}=${l.value}`).join(",");
    const cardinalityKey = `${entry.name}:${labelKey}`;
    if (!this.labelCardinality.has(cardinalityKey)) {
      this.labelCardinality.set(cardinalityKey, new Set());
    }

    const values = this.labelCardinality.get(cardinalityKey)!;
    for (const label of entry.labels) {
      values.add(label.value);
      if (values.size > this.MAX_CARDINALITY_PER_METRIC) {
        this.logger.warn(`Cardinality cap reached for ${entry.name}.${label.name}: ${values.size} unique values`);
        return false;
      }
    }

    return true;
  }

  getCardinalityReport(): Record<string, number> {
    const report: Record<string, number> = {};
    for (const [key, values] of this.labelCardinality.entries()) {
      report[key] = values.size;
    }
    return report;
  }
}
