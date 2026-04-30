import { performance } from 'node:perf_hooks';
import type { PipelineContext, PipelineNode, RuntimeMetrics } from '../types';

export interface NodeExecutionReport {
  node: string;
  duration: number;
  skipped: boolean;
  reason?: string;
}

export interface ExecutionReport {
  timeline: NodeExecutionReport[];
  totalDuration: number;
}

export function createExecutionReport(metrics: RuntimeMetrics): ExecutionReport {
  return {
    timeline: metrics.timeline,
    totalDuration: metrics.totalDuration
  };
}

export async function executeNode(
  node: PipelineNode,
  context: PipelineContext,
  invoke: () => Promise<void>
): Promise<NodeExecutionReport> {
  const start = performance.now();
  await invoke();
  return {
    node: node.name,
    duration: performance.now() - start,
    skipped: false
  };
}
