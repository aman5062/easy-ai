import type { PipelineContext, Plugin } from '../types';

interface RouterOptions {
  simple?: string;
  complex?: string;
  threshold?: number;
}

export function useRouter(options: RouterOptions = {}): Plugin {
  return {
    name: 'router',
    priority: 100,
    shouldRun: (): boolean => true,
    execute: async (ctx: PipelineContext) => {
      const complexity = analyzeComplexity(ctx.query);
      const threshold = options.threshold || 20;

      ctx.metadata = ctx.metadata || {};
      ctx.metadata.queryComplexity = complexity;
      ctx.metadata.route = complexity > threshold ? 'complex' : 'simple';
      ctx.metadata.selectedModel = complexity > threshold
        ? (options.complex || 'gpt-4o-mini')
        : (options.simple || 'gpt-3.5-turbo');
      ctx.flags.requiresRetrieval = Boolean(ctx.documents && ctx.documents.length > 0) || complexity > threshold + 15;
    },
    modifyPipeline: (pipeline, ctx) => {
      if (!pipeline.getNodes().some((node) => node.name === 'router:planner')) {
        pipeline.addAfter('router', {
          name: 'router:planner',
          priority: 130,
          shouldRun: (plannerCtx): boolean => (plannerCtx.metadata.route === 'complex' || plannerCtx.metadata.route === 'document-based'),
          execute: async (plannerCtx): Promise<void> => {
            plannerCtx.metadata.plan = buildPlan(plannerCtx.query, plannerCtx.flags.requiresRetrieval === true);
          }
        });
      }

      if (!pipeline.getNodes().some((node) => node.name === 'router:refine')) {
        pipeline.addBefore('llm', {
          name: 'router:refine',
          priority: 450,
          shouldRun: (refineCtx): boolean => Boolean(refineCtx.retrievedChunks && refineCtx.retrievedChunks.length > 0),
          execute: async (refineCtx): Promise<void> => {
            const topChunks = (refineCtx.retrievedChunks || []).slice(0, Number(refineCtx.metadata.topK || 5));
            refineCtx.documents = topChunks.map((chunk) => chunk.text);
            refineCtx.metadata.refined = true;
          }
        });
      }

      if (ctx.flags.requiresRetrieval) {
        pipeline.enable('rag');
        pipeline.reorder(['router', 'router:planner', 'rag', 'cache', 'router:refine', 'llm', 'guard', 'debug']);
      } else {
        pipeline.disable('rag');
        pipeline.reorder(['router', 'cache', 'llm', 'guard', 'debug']);
      }
    }
  };
}

function buildPlan(query: string, requiresRetrieval: boolean): string[] {
  if (requiresRetrieval) {
    return ['plan', 'retrieve', 'refine', 'answer'];
  }

  const lower = query.toLowerCase();
  if (/compare|tradeoff|pros|cons|evaluate/.test(lower)) {
    return ['plan', 'analyze', 'answer'];
  }
  return ['plan', 'answer'];
}

function analyzeComplexity(query: string): number {
  const wordCount = query.split(/\s+/).length;
  const hasQuestions = (query.match(/\?/g) || []).length;
  const hasCode = /```|`/.test(query);
  
  let score = wordCount;
  if (hasQuestions > 1) score += 10;
  if (hasCode) score += 15;
  
  return score;
}
