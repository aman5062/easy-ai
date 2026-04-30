import OpenAI from 'openai';
import type {
  AIConfig,
  AIResponse,
  LLMProviderAdapter,
  ProviderKind,
  ProviderQueryOptions,
  ResponseMode,
  StructuredOutputSpec
} from '../types';

export class LLMProvider {
  private readonly config: AIConfig;
  private readonly adapter: LLMProviderAdapter;

  constructor(config: AIConfig) {
    this.config = config;
    this.adapter = config.providerInstance || this.createAdapter(config);
  }

  async query(prompt: string, options: ProviderQueryOptions = {}): Promise<AIResponse> {
    const candidateModels = this.getCandidateModels(options.model);
    let lastError: unknown = null;

    for (const model of candidateModels) {
      try {
        let finalPrompt = prompt;
        if (options.documents && options.documents.length > 0) {
          finalPrompt = this.buildRAGPrompt(prompt, options.documents);
        }

        if (options.outputMode === 'json' || options.outputSchema) {
          finalPrompt = this.buildStructuredPrompt(finalPrompt, options.outputSchema);
        }

        const response = await this.adapter.query(finalPrompt, {
          ...options,
          model
        });

        const answer = response.answer || response.raw || '';
        const structured = response.structured ?? ((options.outputMode === 'json' || options.outputSchema)
          ? tryParseJson(answer)
          : undefined);

        return {
          ...response,
          answer,
          raw: response.raw || answer,
          structured,
          model: response.model || model,
          cost: response.cost ?? this.calculateCost(model, response.tokens || 0),
          cached: Boolean(response.cached)
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw this.normalizeError(lastError);
  }

  getProviderName(): string {
    return this.adapter.name;
  }

  private buildRAGPrompt(query: string, documents: string[]): string {
    const context = documents.join('\n\n---\n\n');
    return `Context:\n${context}\n\nQuestion: ${query}\n\nAnswer based on the context above:`;
  }

  private buildStructuredPrompt(prompt: string, outputSchema?: StructuredOutputSpec | Record<string, unknown> | string): string {
    const schemaHint = formatSchemaHint(outputSchema);
    return [
      prompt,
      'Return valid JSON only. Do not use markdown, code fences, or extra commentary.',
      schemaHint ? `Follow this schema guidance:\n${schemaHint}` : 'Use a concise JSON object that directly answers the request.'
    ].join('\n\n');
  }

  private calculateCost(model: string, tokens: number): number {
    const rates: Record<string, number> = {
      'gpt-3.5-turbo': 0.002 / 1000,
      'gpt-4o-mini': 0.00015 / 1000,
      'gpt-4': 0.03 / 1000
    };
    return (rates[model] || 0.002 / 1000) * tokens;
  }

  private getCandidateModels(primaryModel?: string): string[] {
    const models = [primaryModel, this.config.model, ...(this.config.fallbackModels || []), 'gpt-3.5-turbo'];
    return [...new Set(models.filter((model): model is string => Boolean(model)))];
  }

  private createAdapter(config: AIConfig): LLMProviderAdapter {
    // If running QA with mocks enabled, return a lightweight deterministic adapter
    if (process.env.QA_MOCK === 'true') {
      return {
        name: 'mock',
        query: async (prompt: string, options: ProviderQueryOptions = {}): Promise<AIResponse> => {
          const model = options.model || config.model || 'gpt-3.5-turbo';
          const wantsJson = options.outputMode === 'json' || Boolean(options.outputSchema) || (typeof prompt === 'string' && prompt.includes('Return valid JSON'));
          const answer = wantsJson ? JSON.stringify({ result: 'mocked', query: prompt }) : `mock response for model ${model}`;

          return {
            answer,
            raw: answer,
            model,
            tokens: 1,
            cost: 0,
            cached: true
          };
        }
      };
    }

    const providerKind: ProviderKind = config.provider || (config.baseURL ? 'openai-compatible' : 'openai');

    if (providerKind === 'custom') {
      throw new Error('providerInstance is required when provider is set to custom.');
    }

    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY env var or pass apiKey in config.');
    }

    const client = new OpenAI({
      apiKey,
      baseURL: config.baseURL
    });

    return {
      name: providerKind,
      query: async (prompt: string, options: ProviderQueryOptions = {}): Promise<AIResponse> => {
        const completion = await client.chat.completions.create({
          model: options.model || config.model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7
        });

        const answer = completion.choices[0]?.message?.content || '';
        const tokens = completion.usage?.total_tokens || 0;

        return {
          answer,
          raw: answer,
          model: options.model || config.model || 'gpt-3.5-turbo',
          tokens,
          cost: this.calculateCost(options.model || config.model || 'gpt-3.5-turbo', tokens),
          cached: false
        };
      }
    };
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    return new Error('All provider/model attempts failed.');
  }
}

function formatSchemaHint(outputSchema?: StructuredOutputSpec | Record<string, unknown> | string): string {
  if (!outputSchema) {
    return '';
  }

  if (typeof outputSchema === 'string') {
    return outputSchema;
  }

  if (typeof outputSchema === 'object' && (('schema' in outputSchema) || ('description' in outputSchema) || ('examples' in (outputSchema as any)))) {
    const lines: string[] = [];
    const o: any = outputSchema;
    if (typeof o.description === 'string') {
      lines.push(`Description: ${o.description}`);
    }
    if (o.schema) {
      lines.push(`Schema: ${typeof o.schema === 'string' ? o.schema : JSON.stringify(o.schema, null, 2)}`);
    }
    if (Array.isArray(o.examples) && o.examples.length > 0) {
      lines.push(`Examples: ${o.examples.join(' | ')}`);
    }
    return lines.join('\n');
  }

  return JSON.stringify(outputSchema, null, 2);
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
