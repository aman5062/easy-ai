import type { AIResponse, PipelineContext, Plugin } from '../types';
import { createHash } from 'crypto';

interface CacheOptions {
  ttl?: number; // seconds
  similarityThreshold?: number;
}

interface CacheEntry {
  query: string;
  queryTokens: Set<string>;
  response: AIResponse;
  timestamp: number;
}

export function useCache(options: CacheOptions = {}): Plugin {
  const cache = new Map<string, CacheEntry>();
  const ttl = (options.ttl || 3600) * 1000; // convert to ms
  const similarityThreshold = options.similarityThreshold || 0.82;

  return {
    name: 'cache',
    priority: 300,
    shouldRun: (ctx): boolean => Boolean(ctx.flags.useCache ?? true),
    execute: async (ctx: PipelineContext, api) => {
      if (ctx.response) {
        return;
      }

      // Exact key lookup first for minimal overhead.
      const key = hashQuery(ctx.query);
      const entry = cache.get(key);
      const now = Date.now();

      if (entry && Date.now() - entry.timestamp < ttl) {
        ctx.response = { ...entry.response, cached: true };
        api.markStop();
        return;
      }

      // Semantic fallback: threshold-based nearest match.
      const currentTokens = tokenize(ctx.query);
      for (const candidate of cache.values()) {
        if (now - candidate.timestamp >= ttl) {
          continue;
        }

        const similarity = jaccard(currentTokens, candidate.queryTokens);
        if (similarity >= similarityThreshold) {
          ctx.response = {
            ...candidate.response,
            cached: true,
            metadata: {
              ...(candidate.response as any).metadata,
              cacheSimilarity: similarity
            } as any
          } as AIResponse;
          api.markStop();
          return;
        }
      }
    },
    modifyPipeline: (pipeline) => {
      if (pipeline.getNodes().some((node) => node.name === 'cache:store')) {
        return;
      }

      pipeline.addAfter('guard', {
        name: 'cache:store',
        priority: 750,
        shouldRun: (ctx): boolean => Boolean(ctx.response && !ctx.response.cached),
        execute: async (ctx): Promise<void> => {
          if (!ctx.response || ctx.response.cached) {
            return;
          }
          cache.set(hashQuery(ctx.query), {
            query: ctx.query,
            queryTokens: tokenize(ctx.query),
            response: ctx.response,
            timestamp: Date.now()
          });
        }
      });
    }
  };
}

function hashQuery(text: string): string {
  return createHash('md5').update(text.toLowerCase().trim()).digest('hex');
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
