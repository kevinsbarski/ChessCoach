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

// Note: ILLMProvider interface is defined in services/coaching/providers/llm-provider.interface.ts

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
