import type { PipelineContext, Plugin } from '../types';

export function useDebug(): Plugin {
  return {
    name: 'debug',
    priority: 900,
    shouldRun: (): boolean => true,
    execute: async (ctx: PipelineContext, api) => {
      const metrics = api.getMetrics();
      const completed = metrics.timeline.map((item) => item.node);

      ctx.metadata.debug = {
        query: ctx.query,
        pipelineSteps: completed,
        durations: metrics.timeline,
        tokenUsage: ctx.response?.tokens || 0,
        estimatedCost: ctx.response?.cost || 0
      };

      console.log('[DEBUG] Query:', ctx.query);
      console.log('[DEBUG] Route:', ctx.metadata.route || 'default');
      console.log('[DEBUG] Steps:', completed.join(' -> '));
      if (ctx.response) {
        console.log('[DEBUG] Tokens:', ctx.response.tokens || 0);
        console.log('[DEBUG] Cost:', (ctx.response.cost || 0).toFixed(6));
        console.log('[DEBUG] Cached:', Boolean(ctx.response.cached));
      }
    }
  };
}
