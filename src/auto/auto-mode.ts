import type { MutablePipeline, PipelineContext } from '../types';

interface AutoDecision {
  queryType: 'simple' | 'complex' | 'document-based';
  complexityScore: number;
  model: string;
  useCache: boolean;
  needsRAG: boolean;
  topK: number;
}

export class AutoMode {
  tune(context: PipelineContext, pipeline: MutablePipeline): AutoDecision {
    const decision = this.analyze(context);

    context.metadata.routing = {
      queryType: decision.queryType,
      complexityScore: decision.complexityScore
    };
    context.metadata.selectedModel = decision.model;
    context.metadata.topK = decision.topK;
    context.metadata.workflow = decision.queryType === 'complex'
      ? ['plan', 'retrieve', 'refine', 'answer']
      : ['answer'];

    context.flags.requiresRetrieval = decision.needsRAG;
    context.flags.useCache = decision.useCache;

    if (!decision.useCache) {
      pipeline.disable('cache');
    } else {
      pipeline.enable('cache');
    }

    if (!decision.needsRAG) {
      pipeline.disable('rag');
    } else {
      pipeline.enable('rag');
    }

    if (decision.queryType === 'simple') {
      pipeline.reorder(['router', 'cache', 'llm', 'guard', 'debug']);
    } else {
      pipeline.reorder(['router', 'rag', 'cache', 'llm', 'guard', 'debug']);
    }

    return decision;
  }

  private analyze(context: PipelineContext): AutoDecision {
    const query = context.query.toLowerCase();
    const hasDocuments = Boolean(context.documents && context.documents.length > 0);
    const wordCount = context.query.trim().split(/\s+/).filter(Boolean).length;
    const hasHistory = Boolean(context.history && context.history.length > 0);
    const hasReasoningSignals = /why|compare|tradeoff|design|architecture|analyze|explain/.test(query);
    const asksForDocument = /document|pdf|file|source|citation|chunk/.test(query);

    let complexityScore = wordCount;
    if (hasHistory) complexityScore += 15;
    if (hasReasoningSignals) complexityScore += 20;
    if (asksForDocument || hasDocuments) complexityScore += 25;

    const needsRAG = hasDocuments || asksForDocument;
    const queryType: AutoDecision['queryType'] = needsRAG
      ? 'document-based'
      : complexityScore > 45
        ? 'complex'
        : 'simple';

    const model = queryType === 'simple' ? 'gpt-3.5-turbo' : 'gpt-4o-mini';
    const useCache = !hasHistory && complexityScore < 90;
    const topK = queryType === 'simple' ? 3 : queryType === 'complex' ? 8 : 6;

    return {
      queryType,
      complexityScore,
      model,
      useCache,
      needsRAG,
      topK
    };
  }
}
