/**
 * Analysis Results Controller
 * Handles retrieval and management of analysis results
 */

import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { getAnalysisService } from '../services/analysis';

/**
 * Get analysis results for a game
 * GET /api/analysis/game/:gameId
 */
export const getAnalysis = async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    // Validate gameId
    if (!Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({
        error: 'Invalid game ID format',
      });
    }

    const gameObjectId = new Types.ObjectId(gameId);

    // Get analysis from database
    const analysisService = getAnalysisService();
    const analysis = await analysisService.getAnalysis(gameObjectId);

    if (!analysis) {
      return res.status(404).json({
        error: 'Analysis not found',
        message: 'This game has not been analyzed yet. Queue it for analysis first.',
      });
    }

    return res.json({
      gameId: analysis.gameId,
      engineDepth: analysis.engineDepth,
      engineVersion: analysis.engineVersion,
      summary: analysis.summary,
      movesCount: analysis.moves.length,
      moves: analysis.moves, // Full move-by-move analysis
      analyzedAt: analysis.createdAt,
    });
  } catch (error) {
    console.error('Error getting analysis:', error);
    return res.status(500).json({
      error: 'Failed to get analysis',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get summary statistics for a user across all analyzed games
 * GET /api/analysis/summary/:username
 */
export const getUserSummary = async (req: Request, res: Response) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({
        error: 'Username is required',
      });
    }

    const analysisService = getAnalysisService();
    const summary = await analysisService.getUserSummary(username);

    return res.json({
      username,
      ...summary,
    });
  } catch (error) {
    console.error('Error getting user summary:', error);
    return res.status(500).json({
      error: 'Failed to get user summary',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Delete analysis for a game
 * DELETE /api/analysis/game/:gameId
 */
export const deleteAnalysis = async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    // Validate gameId
    if (!Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({
        error: 'Invalid game ID format',
      });
    }

    const gameObjectId = new Types.ObjectId(gameId);

    const analysisService = getAnalysisService();
    const deleted = await analysisService.deleteAnalysis(gameObjectId);

    if (!deleted) {
      return res.status(404).json({
        error: 'Analysis not found',
      });
    }

    return res.json({
      message: 'Analysis deleted successfully',
      gameId,
    });
  } catch (error) {
    console.error('Error deleting analysis:', error);
    return res.status(500).json({
      error: 'Failed to delete analysis',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
