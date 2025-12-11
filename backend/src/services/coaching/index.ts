/**
 * Coaching Service Barrel Exports
 * Re-exports all coaching-related modules
 */

// Main service
export { CoachService } from './coach.service';

// Context building
export { buildCoachingContext, contextToPromptString } from './context-builder';

// Prompt templates
export { CHESS_COACH_SYSTEM_PROMPT, buildSystemPrompt } from './prompt-templates';

// Provider interface
export { ILLMProvider } from './providers/llm-provider.interface';

// Provider implementations
export { ClaudeProvider } from './providers/claude.provider';
