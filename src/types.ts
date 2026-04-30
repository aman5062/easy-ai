export interface AIConfig {
  auto?: boolean;
  apiKey?: string;
  model?: string;
  debug?: boolean;
  provider?: ProviderKind;
  baseURL?: string;
  fallbackModels?: string[];
  responseMode?: ResponseMode;
  providerInstance?: LLMProviderAdapter;
}

export type ProviderKind = 'openai' | 'openai-compatible' | 'custom';

export interface LLMProviderAdapter {
  name: string;
  query: (prompt: string, options?: ProviderQueryOptions) => Promise<AIResponse>;
}

export interface ProviderQueryOptions {
  model?: string;
  documents?: string[];
  outputMode?: ResponseMode;
  outputSchema?: StructuredOutputSpec | Record<string, unknown> | string;
}

export type ResponseMode = 'text' | 'json';

export interface StructuredOutputSpec {
  description?: string;
  schema?: Record<string, unknown> | string;
  examples?: string[];
}

export interface QueryContext {
  query: string;
  documents?: string[];
  history?: Message[];
  metadata?: Record<string, any>;
  outputMode?: ResponseMode;
  outputSchema?: StructuredOutputSpec | Record<string, unknown> | string;
}

export interface StructuredQueryContext extends QueryContext {
  outputMode?: ResponseMode;
  outputSchema?: StructuredOutputSpec | Record<string, unknown> | string;
}

export interface RetrievedChunk {
  text: string;
  score: number;
  source?: string;
}

export interface PipelineFlags {
  stopExecution: boolean;
  requiresRetrieval?: boolean;
  useCache?: boolean;
  [key: string]: boolean | undefined;
}

export interface PipelineContext extends QueryContext {
  embeddings?: number[][];
  retrievedChunks?: RetrievedChunk[];
  response?: AIResponse;
  metadata: Record<string, any>;
  flags: PipelineFlags;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  answer: string;
  raw?: string;
  structured?: unknown;
  sources?: string[];
  model?: string;
  tokens?: number;
  cost?: number;
  cached?: boolean;
  debug?: DebugInfo;
}

export interface DebugInfo {
  pipeline: string[];
  chunks?: Array<{ text: string; score: number }>;
  model: string;
  tokens: number;
  cost: number;
  duration: number;
  cached: boolean;
  responseMode?: ResponseMode;
  timeline?: Array<{ node: string; duration: number; skipped: boolean; reason?: string }>;
}

export interface MutablePipeline {
  addBefore: (target: string, node: PipelineNode) => void;
  addAfter: (target: string, node: PipelineNode) => void;
  remove: (name: string) => void;
  disable: (name: string) => void;
  enable: (name: string) => void;
  reorder: (names: string[]) => void;
  getNodes: () => PipelineNode[];
}

export interface RuntimeMetrics {
  timeline: Array<{ node: string; duration: number; skipped: boolean; reason?: string }>;
  totalDuration: number;
  tokenUsage: number;
  estimatedCost: number;
}

export interface PipelineAPI {
  pipeline: MutablePipeline;
  runParallel: (units: Array<PipelineNode | (() => Promise<void> | void)>) => Promise<void>;
  markStop: () => void;
  setFlag: (key: string, value: boolean) => void;
  getMetrics: () => RuntimeMetrics;
}

export interface PipelineNode {
  name: string;
  priority?: number;
  enabled?: boolean;
  shouldRun?: (context: PipelineContext, api: PipelineAPI) => boolean | Promise<boolean>;
  execute: (context: PipelineContext, api: PipelineAPI) => void | Promise<void>;
  modifyPipeline?: (pipeline: MutablePipeline, context: PipelineContext) => void | Promise<void>;
  optimize?: (context: PipelineContext, pipeline: MutablePipeline) => void | Promise<void>;
}

export interface Plugin {
  name: string;
  priority?: number;
  enabled?: boolean;
  shouldRun?: (context: PipelineContext, api: PipelineAPI) => boolean | Promise<boolean>;
  execute?: (context: PipelineContext, api: PipelineAPI) => void | Promise<void>;
  modifyPipeline?: (pipeline: MutablePipeline, context: PipelineContext) => void | Promise<void>;
  optimize?: (context: PipelineContext, pipeline: MutablePipeline) => void | Promise<void>;
  init?: (ai: any) => void | Promise<void>;
  beforeQuery?: (ctx: QueryContext) => QueryContext | Promise<QueryContext>;
  afterQuery?: (response: AIResponse) => AIResponse | Promise<AIResponse>;
}

export interface PipelineRuntime {
  pipeline: MutablePipeline;
  api: PipelineAPI;
  next: () => PipelineNode | null;
  getOrderedNodes: () => PipelineNode[];
}

export interface UsageStats {
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  cacheHits: number;
}
