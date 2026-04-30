import type {
  AIConfig,
  AIResponse,
  PipelineContext,
  PipelineNode,
  Plugin,
  QueryContext,
  StructuredQueryContext,
  RuntimeMetrics,
  ResponseMode,
  UsageStats
} from '../types';
import { AutoMode } from '../auto/auto-mode';
import { LLMProvider } from '../llm/provider';
import { PipelineEngine } from '../engine/pipeline';
import { createExecutionReport, type ExecutionReport } from '../engine/executor';

export class AIEngine {
  private config: AIConfig;
  private plugins: Plugin[] = [];
  private autoMode: AutoMode;
  private llm: LLMProvider;
  private pipeline: PipelineEngine;
  private lastRuntime: RuntimeMetrics | null = null;
  private usage: UsageStats = {
    totalTokens: 0,
    totalCost: 0,
    requestCount: 0,
    cacheHits: 0
  };

  constructor(config: AIConfig = {}) {
    this.config = { auto: true, ...config };
    this.llm = new LLMProvider(config);
    this.autoMode = new AutoMode();
    this.pipeline = new PipelineEngine();
    this.pipeline.register(this.createLLMNode());
  }

  use(plugin: Plugin): this {
    this.plugins.push(plugin);
    this.registerPluginNodes(plugin);
    if (plugin.init) {
      plugin.init(this);
    }
    return this;
  }

  async ask(query: string, options: Partial<QueryContext> = {}): Promise<string | AIResponse> {
    const response = await this.executeQuery(query, options);

    return this.config.debug ? response : response.answer;
  }

  async askStructured<T = Record<string, unknown>>(
    query: string,
    options: Partial<StructuredQueryContext> = {}
  ): Promise<T> {
    const response = await this.executeQuery(query, {
      ...options,
      outputMode: 'json'
    });

    const structured = response.structured ?? tryParseJson(response.answer);
    if (structured === undefined) {
      throw new Error('Structured output could not be parsed as JSON.');
    }

    return structured as T;
  }

  private async executeQuery(query: string, options: Partial<StructuredQueryContext> = {}): Promise<AIResponse> {
    const responseMode: ResponseMode = options.outputMode || (options.metadata?.responseMode as ResponseMode | undefined) || this.config.responseMode || 'text';
    const context: PipelineContext = {
      query,
      documents: options.documents,
      history: options.history,
      metadata: { ...(options.metadata || {}), responseMode, outputSchema: options.outputSchema },
      flags: {
        stopExecution: false
      }
    };

    this.lastRuntime = await this.pipeline.execute(context, async (pipeline) => {
      if (this.config.auto) {
        this.autoMode.tune(context, pipeline);
      }
    });

    let response = context.response;
    if (!response) {
      response = await this.llm.query(context.query, {
        model: typeof context.metadata.selectedModel === 'string' ? context.metadata.selectedModel : undefined,
        documents: context.documents,
        outputMode: responseMode,
        outputSchema: options.outputSchema
      });
    }

    if (responseMode === 'json' && !response.structured) {
      response.structured = tryParseJson(response.answer);
    }

    // Track usage
    this.usage.totalTokens += response.tokens || 0;
    this.usage.totalCost += response.cost || 0;
    this.usage.requestCount++;
    if (response.cached) this.usage.cacheHits++;

    // Add debug info
    if (this.config.debug) {
      const timeline = this.lastRuntime?.timeline || [];
      response.debug = {
        pipeline: timeline.map((step) => step.node),
        chunks: context.retrievedChunks,
        model: response.model || 'gpt-3.5-turbo',
        tokens: response.tokens || 0,
        cost: response.cost || 0,
        responseMode,
        duration: this.lastRuntime?.totalDuration || 0,
        cached: response.cached || false,
        timeline
      };
    }

    return response;
  }

  debug(): this {
    this.config.debug = true;
    return this;
  }

  getUsage(): UsageStats {
    return { ...this.usage };
  }

  getLLM(): LLMProvider {
    return this.llm;
  }

  getProviderName(): string {
    return this.llm.getProviderName();
  }

  getTrace(): ExecutionReport | null {
    if (!this.lastRuntime) {
      return null;
    }

    return createExecutionReport(this.lastRuntime);
  }

  private createLLMNode(): PipelineNode {
    return {
      name: 'llm',
      priority: 500,
      execute: async (context): Promise<void> => {
        if (context.response) {
          return;
        }

        const response = await this.llm.query(context.query, {
          model: typeof context.metadata.selectedModel === 'string' ? context.metadata.selectedModel : this.config.model,
          documents: context.documents,
          outputMode: context.metadata.responseMode,
          outputSchema: context.metadata.outputSchema
        });

        context.response = response;
      }
    };
  }

  private registerPluginNodes(plugin: Plugin): void {
    if (plugin.execute) {
      this.pipeline.register({
        name: plugin.name,
        priority: plugin.priority,
        enabled: plugin.enabled,
        shouldRun: plugin.shouldRun,
        execute: plugin.execute,
        modifyPipeline: plugin.modifyPipeline,
        optimize: plugin.optimize
      });
    }

    if (plugin.beforeQuery) {
      this.pipeline.register({
        name: `${plugin.name}:before`,
        priority: (plugin.priority ?? 200) - 100,
        execute: async (context): Promise<void> => {
          const next = await plugin.beforeQuery!({
            query: context.query,
            documents: context.documents,
            history: context.history,
            metadata: context.metadata
          });

          context.query = next.query;
          context.documents = next.documents;
          context.history = next.history;
          context.metadata = next.metadata || context.metadata;
        }
      });
    }

    if (plugin.afterQuery) {
      this.pipeline.register({
        name: `${plugin.name}:after`,
        priority: (plugin.priority ?? 800) + 100,
        shouldRun: (context): boolean => Boolean(context.response),
        execute: async (context): Promise<void> => {
          context.response = await plugin.afterQuery!(context.response as AIResponse);
        }
      });
    }
  }
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
