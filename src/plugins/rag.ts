import type { PipelineContext, Plugin, RetrievedChunk } from '../types';
import { readFileSync } from 'fs';

interface RAGOptions {
  file?: string;
  text?: string;
  chunkSize?: number;
  minChunkSize?: number;
  maxChunkSize?: number;
  topK?: number;
}

export function useRAG(options: RAGOptions): Plugin {
  let documents: string[] = [];

  return {
    name: 'rag',
    priority: 200,
    init: async () => {
      if (options.file) {
        const content = readFileSync(options.file, 'utf-8');
        documents = chunkText(content, options.chunkSize || 900);
      } else if (options.text) {
        documents = chunkText(options.text, options.chunkSize || 900);
      }
    },
    shouldRun: (ctx): boolean => {
      if (ctx.flags.requiresRetrieval === true) return true;
      return Boolean((documents.length > 0 || (ctx.documents && ctx.documents.length > 0)) && !ctx.response);
    },
    optimize: (ctx): void => {
      const querySize = ctx.query.trim().split(/\s+/).filter(Boolean).length;
      const base = options.chunkSize || 900;
      const adaptiveChunkSize = querySize > 40 ? Math.min(base + 400, options.maxChunkSize || 1400) : Math.max(base - 200, options.minChunkSize || 600);
      ctx.metadata.chunkSize = adaptiveChunkSize;
      ctx.metadata.topK = ctx.metadata.topK || options.topK || (querySize > 30 ? 8 : 4);
    },
    execute: async (ctx: PipelineContext, api) => {
      const corpus = documents.length > 0 ? documents : (ctx.documents || []);
      if (corpus.length === 0) {
        return;
      }

      const queryTokens = tokenize(ctx.query);
      const topK = Number(ctx.metadata.topK || options.topK || 5);

      let keywordScores: number[] = [];
      let semanticScores: number[] = [];

      await api.runParallel([
        async () => {
          keywordScores = corpus.map((chunk) => keywordOverlapScore(queryTokens, chunk));
        },
        async () => {
          semanticScores = corpus.map((chunk) => semanticProxySimilarity(ctx.query, chunk));
        }
      ]);

      const hybridRanked: RetrievedChunk[] = corpus.map((chunk, index) => {
        const keywordScore = keywordScores[index] || 0;
        const semanticProxyScore = semanticScores[index] || 0;
        const score = (keywordScore * 0.55) + (semanticProxyScore * 0.45);
        return { text: chunk, score };
      });

      const reranked = hybridRanked
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(1, topK));

      const compressed = reranked.map((chunk) => ({
        ...chunk,
        text: compressChunk(chunk.text, 480)
      }));

      ctx.retrievedChunks = compressed;
      ctx.documents = compressed.map((chunk) => chunk.text);
      ctx.metadata.retrieval = {
        strategy: 'hybrid+rerank+compress',
        selected: compressed.length,
        topScore: compressed[0]?.score || 0
      };
    }
  };
}

function chunkText(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  
  let currentChunk = '';
  for (const para of paragraphs) {
    if (currentChunk.length + para.length > chunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function keywordOverlapScore(queryTokens: string[], chunk: string): number {
  if (queryTokens.length === 0) return 0;
  const chunkTokens = new Set(tokenize(chunk));
  let overlap = 0;
  for (const token of queryTokens) {
    if (chunkTokens.has(token)) overlap += 1;
  }
  return overlap / queryTokens.length;
}

function semanticProxySimilarity(query: string, chunk: string): number {
  const q = query.toLowerCase();
  const c = chunk.toLowerCase();
  const qBigrams = buildNgrams(q, 2);
  const cBigrams = buildNgrams(c, 2);
  if (qBigrams.size === 0 || cBigrams.size === 0) return 0;

  let intersection = 0;
  for (const gram of qBigrams) {
    if (cBigrams.has(gram)) intersection += 1;
  }
  const union = qBigrams.size + cBigrams.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function buildNgrams(text: string, n: number): Set<string> {
  const clean = text.replace(/\s+/g, ' ').trim();
  const grams = new Set<string>();
  for (let i = 0; i <= clean.length - n; i += 1) {
    grams.add(clean.slice(i, i + n));
  }
  return grams;
}

function compressChunk(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const head = text.slice(0, Math.floor(maxLength * 0.7));
  const tail = text.slice(-Math.floor(maxLength * 0.2));
  return `${head}\n...\n${tail}`;
}
