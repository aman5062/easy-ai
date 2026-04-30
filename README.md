# easy-ai

`easy-ai` is a TypeScript AI helper for simple chat, structured output, and plugin-based orchestration.

## Install

```bash
npm install easy-ai
```

## Configure

Set your API key before running the CLI or your app:

```bash
export OPENAI_API_KEY="your-api-key"
```

## Use in code

```typescript
import { createAI } from 'easy-ai';

const ai = createAI({ auto: true });
const answer = await ai.ask('What is artificial intelligence?');
console.log(answer);
```

## Use the CLI

```bash
npx easy-ai ask "What is AI?"
```

## Structured output

```typescript
const profile = await ai.askStructured('Extract a short profile', {
  outputSchema: {
    description: 'Profile object',
    schema: {
      name: 'string',
      role: 'string'
    }
  }
});
```

## Notes

- Node.js 18+ is required.
- `QA_MOCK=true` can be used in local testing to avoid real API calls.
- Build output is written to `dist/`.
# 🧠 easy-ai

[![NPM Version](https://img.shields.io/npm/v/easy-ai.svg)](https://www.npmjs.com/package/easy-ai)
[![License](https://img.shields.io/npm/l/easy-ai.svg)](https://github.com/yourusername/easy-ai/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)

**The magical AI backend framework that just works.**

Build AI features in seconds, not hours. No configs. No complexity. Just pure magic.

```typescript
import { createAI } from "easy-ai";

const ai = createAI({ auto: true });
const answer = await ai.ask("Explain quantum computing");
console.log(answer);
```

That's it. You're done. ✨

---

## 🚀 Quick Start (30 seconds)

### Install

```bash
npm install easy-ai
```

Or use the setup script:

```bash
git clone https://github.com/yourusername/easy-ai.git
cd easy-ai
./setup.sh
```

### Set API Key

```bash
export OPENAI_API_KEY="your-key-here"
```

### Use

```typescript
import { createAI } from "easy-ai";

const ai = createAI({ auto: true });
const res = await ai.ask("What is AI?");
console.log(res);
```

---

## 🌟 Why easy-ai?

| Other Libraries | easy-ai |
|----------------|---------|
| 200 lines of config | 3 lines of code |
| Choose models manually | Auto-selects best model |
| Build RAG from scratch | Built-in, auto-detected |
| Manage costs yourself | Cost-optimized by default |
| Debug with console.log | `.debug()` shows everything |

---

## ✨ Auto Mode (The Magic)

Auto mode is the heart of easy-ai. It automatically:

- ✅ Detects if you need RAG
- ✅ Processes documents intelligently
- ✅ Chooses the right model (cheap vs powerful)
- ✅ Optimizes for cost and speed
- ✅ Caches responses semantically
- ✅ Makes everything just work

```typescript
const ai = createAI({ auto: true });

// Simple query → uses gpt-3.5-turbo (cheap & fast)
await ai.ask("What's 2+2?");

// Complex query → uses gpt-4o-mini (powerful)
await ai.ask("Explain the philosophical implications of consciousness");

// With document → automatically uses RAG
await ai.ask("Summarize this PDF", { 
  documents: ["content here"] 
});
```

**Zero configuration. Maximum intelligence.**

---

## 🔥 Real-World Examples

### 1. Simple Q&A

```typescript
const ai = createAI({ auto: true });
const answer = await ai.ask("What is TypeScript?");
```

### 2. Document Analysis (Auto RAG)

```typescript
import { createAI, useRAG } from "easy-ai";

const ai = createAI({ auto: true })
  .use(useRAG({ file: "./docs.pdf" }));

const summary = await ai.ask("What are the key points?");
```

### 3. Cost-Optimized Pipeline

```typescript
const ai = createAI({ auto: true })
  .use(useCache({ ttl: 3600 }))
  .use(useRouter({ simple: "gpt-3.5-turbo", complex: "gpt-4o-mini" }));

await ai.ask("Hello"); // Cached & cheap model
console.log(ai.getUsage()); // { totalCost: 0.0001, cacheHits: 1 }
```

### 4. Debug Mode (Developer Love)

```typescript
const ai = createAI({ auto: true }).debug();

const res = await ai.ask("Explain AI");
// 🔍 [DEBUG] Query: Explain AI
// 🤖 [DEBUG] Model: gpt-3.5-turbo
// 🎫 [DEBUG] Tokens: 150
// 💰 [DEBUG] Cost: $0.000300
```

### 5. Production-Ready with Guards

```typescript
import { createAI, useGuard, useCache } from "easy-ai";

const ai = createAI({ auto: true })
  .use(useCache())
  .use(useGuard({ 
    minLength: 20,
    validate: (res) => !res.includes("error")
  }));

const answer = await ai.ask("Explain machine learning");
```

---

## 🧩 Plugin System

Extend easy-ai with composable plugins:

```typescript
const ai = createAI()
  .use(useRAG({ file: "docs.pdf" }))      // Document processing
  .use(useCache({ ttl: 3600 }))           // Semantic caching
  .use(useRouter())                        // Smart model selection
  .use(useGuard({ minLength: 10 }))       // Output validation
  .use(useDebug());                        // Development insights
```

### Available Plugins

| Plugin | Purpose | Example |
|--------|---------|---------|
| `useRAG()` | Document processing & retrieval | `useRAG({ file: "doc.pdf" })` |
| `useCache()` | Semantic response caching | `useCache({ ttl: 3600 })` |
| `useRouter()` | Auto model selection | `useRouter({ simple: "gpt-3.5-turbo" })` |
| `useGuard()` | Output validation & retry | `useGuard({ minLength: 20 })` |
| `useDebug()` | Development insights | `useDebug()` |

---

## 📊 Usage Tracking

```typescript
const ai = createAI({ auto: true });

await ai.ask("Question 1");
await ai.ask("Question 2");

const stats = ai.getUsage();
console.log(stats);
// {
//   totalTokens: 500,
//   totalCost: 0.001,
//   requestCount: 2,
//   cacheHits: 0
// }
```

## 🧾 Structured Outputs

**How do you get JSON from easy-ai?** Use `askStructured()` when you need a parsed object instead of plain text.

```typescript
import { createAI } from "easy-ai";

const ai = createAI({ auto: true });

const profile = await ai.askStructured<{ name: string; role: string }>(
  "Extract a developer profile from: Sam is a TypeScript engineer who builds AI tools.",
  {
    outputSchema: {
      description: "Developer profile object",
      schema: {
        name: "string",
        role: "string"
      }
    }
  }
);

console.log(profile.name);
```

## 🧭 Trace and Debug

**How do you inspect what happened during a request?** Call `getTrace()` to see the execution timeline, then use `.debug()` for the full response object.

```typescript
const ai = createAI({ auto: true });
await ai.ask("Explain AI routing");

console.log(ai.getTrace());
```

### Can I use an OpenAI-compatible provider?

Yes. Pass `baseURL` in the config to point at an OpenAI-compatible endpoint, or provide `fallbackModels` to keep the app resilient when the primary model is unavailable.

```typescript
const ai = createAI({
  auto: true,
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://your-compatible-provider.example/v1",
  fallbackModels: ["gpt-4o-mini", "gpt-3.5-turbo"]
});
```

---

## 🎯 Design Philosophy

1. **Simplicity > Flexibility** – Defaults should work for 90% of use cases
2. **Speed > Abstraction** – Minimal overhead, maximum performance
3. **DX First** – Developer experience is the top priority
4. **Cost-Aware** – Optimize for cost without sacrificing quality
5. **Just Works™** – No configs, no setup, no confusion

---

## ❓ Frequently Asked Questions

### What is easy-ai?

easy-ai is a TypeScript AI backend framework that helps developers build AI features with zero-config defaults, auto routing, RAG, caching, tracing, and structured outputs.

### Why is easy-ai SEO and AEO friendly?

The documentation uses question-based headings, direct answers, concrete code examples, and predictable terminology so search engines and answer engines can extract useful snippets quickly.

### How do I get a JSON response?

Use `askStructured()` and provide an `outputSchema`. The framework asks the model for JSON-only output and parses the result for you.

### How do I see the execution path?

Call `getTrace()` after a request. It returns the ordered pipeline timeline with durations and skip reasons.

### Is easy-ai only for OpenAI?

The current implementation uses OpenAI by default, but you can already point the SDK at OpenAI-compatible endpoints with `baseURL`. The provider layer also supports fallback models so apps can degrade more gracefully.

---

## 🏗️ How It Works

```
┌─────────────────────────────────────────────────┐
│  Your Code: ai.ask("Explain this PDF")         │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  Auto Mode (Intelligence Layer)                 │
│  • Detects RAG need                            │
│  • Selects model (cheap vs powerful)           │
│  • Optimizes cost & speed                      │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  Plugin Pipeline                                │
│  Cache → RAG → Router → Guard → Debug          │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  LLM Provider (OpenAI)                          │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  Response + Usage Stats                         │
└─────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture

```
easy-ai/
├── core/          # Engine & orchestration
├── auto/          # Auto-mode intelligence
├── llm/           # LLM provider abstraction
├── plugins/       # Composable plugins
│   ├── rag.ts
│   ├── cache.ts
│   ├── router.ts
│   ├── guard.ts
│   └── debug.ts
└── types.ts       # TypeScript definitions
```

---

## 🔧 Advanced Configuration

While auto mode works out of the box, you can customize:

```typescript
const ai = createAI({
  auto: true,
  apiKey: "your-key",
  model: "gpt-4",
  debug: false
});
```

---

## 🚦 API Reference

### `createAI(config?)`

Creates an AI instance.

```typescript
const ai = createAI({ auto: true });
```

### `ai.ask(query, options?)`

Ask a question.

```typescript
const answer = await ai.ask("What is AI?");
```

### `ai.use(plugin)`

Add a plugin.

```typescript
ai.use(useCache());
```

### `ai.debug()`

Enable debug mode.

```typescript
ai.debug();
```

### `ai.getUsage()`

Get usage statistics.

```typescript
const stats = ai.getUsage();
```

---

## 💡 Tips & Best Practices

1. **Always use auto mode** – It's optimized for cost and performance
2. **Enable caching** – Saves money on repeated queries
3. **Use debug mode in dev** – Understand what's happening
4. **Track usage** – Monitor costs in production
5. **Validate outputs** – Use guards for critical applications

---

## 🖥️ CLI Tool

Use easy-ai from the command line:

```bash
# Install globally
npm install -g easy-ai

# Ask questions instantly
easy-ai ask "What is machine learning?"

# Debug mode
easy-ai ask "Explain AI" --debug

# Specify model
easy-ai ask "Write a poem" --model gpt-4
```

Perfect for quick queries and testing!

---

## 🤝 Contributing

We'd love your help making easy-ai even better!

---

## 📄 License

MIT

---

## 🎉 Why This Exists

Because building AI features shouldn't require a PhD. It should feel like using Express.js or React – simple, intuitive, and delightful.

**Install it. Use it. Love it.** ❤️

```bash
npm install easy-ai
```
