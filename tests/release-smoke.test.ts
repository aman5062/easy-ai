import assert from 'node:assert/strict';
import { createAI, LLMProvider } from '../src';

async function main(): Promise<void> {
  const provider = new LLMProvider({
    model: 'gpt-3.5-turbo',
    providerInstance: {
      name: 'release-smoke-mock',
      query: async (_prompt, options) => {
        if (options?.outputMode === 'json' || options?.outputSchema) {
          return {
            answer: JSON.stringify({ ok: true }),
            raw: JSON.stringify({ ok: true }),
            model: options?.model,
            tokens: 1,
            cost: 0,
            cached: true
          };
        }

        return {
          answer: 'release smoke ok',
          raw: 'release smoke ok',
          model: options?.model,
          tokens: 1,
          cost: 0,
          cached: true
        };
      }
    }
  });

  const ai = createAI({
    auto: true,
    providerInstance: {
      name: 'release-smoke-mock',
      query: async (prompt, options) => provider.query(prompt, options)
    }
  });

  const answer = await ai.ask('hello');
  assert.equal(answer, 'release smoke ok');

  const structured = await ai.askStructured<{ ok: boolean }>('return json', {
    outputSchema: { description: 'release smoke' }
  });
  assert.equal(structured.ok, true);

  console.log('release smoke tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
