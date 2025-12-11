/**
 * Coaching System Type Definitions
 * Types for LLM-powered chess coaching functionality
 */

import {
  IWeaknessSummary,
  IOpeningRepertoire,
  IPhasePerformance,
  IColorPerformance,
  ITrendAnalysis,
  IChatMessage
} from './index';

/**
 * LLM Provider Interface
 * Abstraction for different LLM providers (OpenAI, Anthropic, etc.)
 */
export interface ILLMProvider {
  /**
   * Send chat messages and get a complete response
   * @param messages - Array of chat messages (conversation history)
   * @param systemPrompt - System prompt that defines the assistant's behavior
   * @returns Promise resolving to the assistant's response
   */
  chat(messages: IChatMessage[], systemPrompt: string): Promise<string>;

  /**
   * Stream chat messages with real-time chunks
   * @param messages - Array of chat messages (conversation history)
   * @param systemPrompt - System prompt that defines the assistant's behavior
   * @param onChunk - Callback function called for each chunk of the response
   * @returns Promise resolving to the complete response
   */
  streamChat(
    messages: IChatMessage[],
    systemPrompt: string,
    onChunk: (chunk: string) => void
  ): Promise<string>;
}

/**
 * Coaching Context
 * Aggregated player data provided to the LLM for personalized coaching
 */
export interface ICoachingContext {
  username: string;
  totalGames: number;
  analyzedGames: number;
  summary: IWeaknessSummary;
  openings: IOpeningRepertoire;
  phases: IPhasePerformance;
  colors: IColorPerformance;
  trends: ITrendAnalysis;
}

/**
 * Coaching Session
 * Represents a coaching conversation with context and message history
 */
export interface ICoachingSession {
  sessionId: string;
  username: string;
  context: ICoachingContext;
  messages: IChatMessage[];
  createdAt: Date;
}
