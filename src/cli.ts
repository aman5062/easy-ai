#!/usr/bin/env node
import { createAI } from './index';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
🧠 easy-ai CLI

Usage:
  easy-ai ask "your question here"
  easy-ai ask "your question" --debug
  easy-ai ask "your question" --trace
  easy-ai ask "your question" --model gpt-4

Examples:
  easy-ai ask "What is AI?"
  easy-ai ask "Explain quantum computing" --debug
  easy-ai ask "Explain quantum computing" --trace
  easy-ai ask "Write a haiku about coding" --model gpt-4

Options:
  --debug          Show detailed debug information
  --trace          Show the execution timeline after the answer
  --model <name>   Specify model (default: auto-selected)
  --help, -h       Show this help message
    `);
    process.exit(0);
  }

  if (args[0] !== 'ask') {
    console.error('❌ Unknown command. Use "easy-ai ask <question>"');
    process.exit(1);
  }

  const question = args[1];
  if (!question) {
    console.error('❌ Please provide a question');
    process.exit(1);
  }

  const debug = args.includes('--debug');
  const trace = args.includes('--trace');
  const modelIndex = args.indexOf('--model');
  const model = modelIndex !== -1 ? args[modelIndex + 1] : undefined;

  try {
    const ai = createAI({ auto: true, debug, model });
    
    console.log('🤔 Thinking...\n');
    const answer = await ai.ask(question);
    
    if (debug) {
      console.log('\n📊 Response:');
      console.log(JSON.stringify(answer, null, 2));
    } else {
      console.log(answer);
    }

    if (trace) {
      const executionTrace = ai.getTrace();
      console.log('\n🧭 Trace:');
      console.log(JSON.stringify(executionTrace, null, 2));
    }
    
    if (!debug) {
      const usage = ai.getUsage();
      console.log(`\n💰 Cost: $${usage.totalCost.toFixed(6)} | Tokens: ${usage.totalTokens}`);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
