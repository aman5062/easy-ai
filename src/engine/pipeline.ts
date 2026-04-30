import { performance } from 'node:perf_hooks';
import type {
  MutablePipeline,
  PipelineContext,
  PipelineNode,
  PipelineRuntime,
  RuntimeMetrics
} from '../types';

export class PipelineEngine {
  private readonly nodes = new Map<string, PipelineNode>();

  register(node: PipelineNode): this {
    this.nodes.set(node.name, node);
    return this;
  }

  unregister(name: string): this {
    this.nodes.delete(name);
    return this;
  }

  has(name: string): boolean {
    return this.nodes.has(name);
  }

  list(): PipelineNode[] {
    return [...this.nodes.values()];
  }

  async execute(
    context: PipelineContext,
    configurePipeline?: (pipeline: MutablePipeline) => void | Promise<void>
  ): Promise<RuntimeMetrics> {
    const start = performance.now();
    const metrics: RuntimeMetrics = {
      timeline: [],
      totalDuration: 0,
      tokenUsage: 0,
      estimatedCost: 0
    };

    const runtime = this.createRuntime(context, metrics);

    if (configurePipeline) {
      await configurePipeline(runtime.pipeline);
    }

    // Let nodes optimize and mutate pipeline before execution starts.
    for (const node of runtime.getOrderedNodes()) {
      if (node.optimize) {
        await node.optimize(context, runtime.pipeline);
      }
      if (node.modifyPipeline) {
        await node.modifyPipeline(runtime.pipeline, context);
      }
    }

    while (!context.flags.stopExecution) {
      const next = runtime.next();
      if (!next) break;

      const shouldRun = next.shouldRun ? await next.shouldRun(context, runtime.api) : true;
      if (!shouldRun) {
        metrics.timeline.push({
          node: next.name,
          duration: 0,
          skipped: true,
          reason: 'shouldRun=false'
        });
        continue;
      }

      const nodeStart = performance.now();
      await next.execute(context, runtime.api);
      metrics.timeline.push({
        node: next.name,
        duration: performance.now() - nodeStart,
        skipped: false
      });

      if (context.response?.tokens) {
        metrics.tokenUsage = context.response.tokens;
      }
      if (context.response?.cost) {
        metrics.estimatedCost = context.response.cost;
      }
    }

    metrics.totalDuration = performance.now() - start;
    return metrics;
  }

  private createRuntime(context: PipelineContext, metrics: RuntimeMetrics): PipelineRuntime {
    let queue = this.getSortedNodes();
    let index = 0;

    const pipeline: MutablePipeline = {
      addBefore: (target: string, node: PipelineNode) => {
        const at = queue.findIndex((item) => item.name === target);
        if (at === -1) {
          queue.push(node);
        } else {
          queue.splice(at, 0, node);
        }
        this.nodes.set(node.name, node);
      },
      addAfter: (target: string, node: PipelineNode) => {
        const at = queue.findIndex((item) => item.name === target);
        if (at === -1) {
          queue.push(node);
        } else {
          queue.splice(at + 1, 0, node);
        }
        this.nodes.set(node.name, node);
      },
      remove: (name: string) => {
        const at = queue.findIndex((node) => node.name === name);
        if (at === -1) return;
        queue.splice(at, 1);
        this.nodes.delete(name);
        if (at <= index && index > 0) {
          index -= 1;
        }
      },
      disable: (name: string) => {
        const node = this.nodes.get(name);
        if (node) {
          node.enabled = false;
        }
      },
      enable: (name: string) => {
        const node = this.nodes.get(name);
        if (node) {
          node.enabled = true;
        }
      },
      reorder: (names: string[]) => {
        const preferred = new Set(names);
        const preferredNodes = names
          .map((name) => queue.find((node) => node.name === name))
          .filter((node): node is PipelineNode => Boolean(node));
        const rest = queue.filter((node) => !preferred.has(node.name));
        queue = [...preferredNodes, ...rest];
        index = 0;
      },
      getNodes: () => [...queue]
    };

    const api = {
      pipeline,
      runParallel: async (units: Array<PipelineNode | (() => Promise<void> | void)>): Promise<void> => {
        const runners = units.map(async (unit) => {
          if (typeof unit === 'function') {
            await unit();
            return;
          }

          const shouldRun = unit.shouldRun ? await unit.shouldRun(context, api) : true;
          if (!shouldRun) return;
          await unit.execute(context, api);
        });

        await Promise.all(runners);
      },
      markStop: (): void => {
        context.flags.stopExecution = true;
      },
      setFlag: (key: string, value: boolean): void => {
        context.flags[key] = value;
      },
      getMetrics: () => metrics
    };

    return {
      pipeline,
      api,
      next: () => {
        while (index < queue.length) {
          const node = queue[index++];
          if (node.enabled === false) {
            metrics.timeline.push({
              node: node.name,
              duration: 0,
              skipped: true,
              reason: 'disabled'
            });
            continue;
          }
          return node;
        }
        return null;
      },
      getOrderedNodes: () => [...queue]
    };
  }

  private getSortedNodes(): PipelineNode[] {
    return [...this.nodes.values()].sort((a, b) => {
      const aPriority = a.priority ?? 100;
      const bPriority = b.priority ?? 100;
      if (aPriority === bPriority) {
        return a.name.localeCompare(b.name);
      }
      return aPriority - bPriority;
    });
  }
}
