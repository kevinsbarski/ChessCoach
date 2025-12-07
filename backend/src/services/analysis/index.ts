/**
 * Analysis Service - Main Entry Point
 *
 * This is the facade/orchestrator that provides backward compatibility
 * while delegating to specialized modules.
 */

import { Types } from 'mongoose';
import { DepthPreset } from '../stockfish.service';

// Re-export from submodules
export { classifyMove, ClassifyMoveParams } from './move-classifier';
export { analyzeGame } from './game-analyzer';
export { getAnalysis, getUserSummary, deleteAnalysis } from './stats-aggregator';

// Import for the class wrapper
import { analyzeGame } from './game-analyzer';
import { getAnalysis, getUserSummary, deleteAnalysis } from './stats-aggregator';

/**
 * Game Analysis Service Class
 * Provides class-based API for backward compatibility
 */
export class GameAnalysisService {
  async analyzeGame(gameId: Types.ObjectId, depthPreset: DepthPreset = 'fast') {
    return analyzeGame(gameId, depthPreset);
  }

  async getAnalysis(gameId: Types.ObjectId) {
    return getAnalysis(gameId);
  }

  async getUserSummary(username: string) {
    return getUserSummary(username);
  }

  async deleteAnalysis(gameId: Types.ObjectId) {
    return deleteAnalysis(gameId);
  }
}

/**
 * Global analysis service instance (singleton)
 */
let globalAnalysisService: GameAnalysisService | null = null;

export function getAnalysisService(): GameAnalysisService {
  if (!globalAnalysisService) {
    globalAnalysisService = new GameAnalysisService();
  }
  return globalAnalysisService;
}
