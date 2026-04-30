import { AIEngine } from './engine';
import type { AIConfig } from '../types';

export function createAI(config: AIConfig = {}): AIEngine {
  return new AIEngine(config);
}
