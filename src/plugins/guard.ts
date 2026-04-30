import type { AIResponse, Plugin } from '../types';
import type { AIEngine } from '../core/engine';
import type { LLMProvider } from '../llm/provider';

interface GuardOptions {
  minLength?: number;
  maxRetries?: number;
  validate?: (response: string) => boolean;
  enforceJson?: boolean;
}

export function useGuard(options: GuardOptions = {}): Plugin {
  let llm: LLMProvider | null = null;

  return {
    name: 'guard',
    priority: 700,
    init: (ai: AIEngine) => {
      llm = ai.getLLM();
    },
    shouldRun: (ctx): boolean => Boolean(ctx.response),
    execute: async (ctx) => {
      if (!ctx.response) {
        return;
      }

      let response: AIResponse = ctx.response;
      const minLength = options.minLength || 10;
      const maxRetries = options.maxRetries || 1;

      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const isValid = isResponseValid(response.answer, minLength, options.validate, options.enforceJson);
        if (isValid) {
          ctx.response = response;
          return;
        };

        if (!llm || attempt === maxRetries) {
          break;
        }

        const retryPrompt = buildRetryPrompt(ctx.query, response.answer, Boolean(options.enforceJson));
        response = await llm.query(retryPrompt, {
          model: typeof ctx.metadata.selectedModel === 'string' ? ctx.metadata.selectedModel : undefined,
          documents: ctx.documents
        });
      }

      ctx.response = {
        ...response,
        answer: options.enforceJson
          ? '{"error":"validation_failed","message":"Unable to generate a valid structured response."}'
          : 'I apologize, but I could not generate a valid response. Please try rephrasing your question.'
      };
    }
  };
}

function isResponseValid(
  answer: string,
  minLength: number,
  validate?: (response: string) => boolean,
  enforceJson?: boolean
): boolean {
  if (answer.length < minLength) {
    return false;
  }
  if (enforceJson) {
    try {
      JSON.parse(answer);
    } catch {
      return false;
    }
  }
  return validate ? validate(answer) : true;
}

function buildRetryPrompt(query: string, previousAnswer: string, enforceJson: boolean): string {
  const formatInstruction = enforceJson
    ? 'Respond with strict JSON only. No markdown, no prose.'
    : 'Respond with a concise and complete answer.';

  return [
    `Original question: ${query}`,
    `Previous invalid answer: ${previousAnswer}`,
    'Rewrite the answer to satisfy validation constraints.',
    formatInstruction
  ].join('\n\n');
}
