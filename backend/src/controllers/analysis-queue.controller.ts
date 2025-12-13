/**
 * Analysis Queue Controller
 * Handles queue management operations for game analysis
 */

import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { getAnalysisQueue } from '../services/queue.service';
import { DepthPreset } from '../services/stockfish.service';
import { Game } from '../models/Game';

/**
 * Queue a game for analysis
 * POST /api/analysis/game/:gameId?depth=fast
 */
export const queueAnalysis = async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const depth = (req.query.depth as DepthPreset) || 'fast';

    // Validate gameId
    if (!Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({
        error: 'Invalid game ID format',
      });
    }

    const gameObjectId = new Types.ObjectId(gameId);

    // Check if game exists
    const game = await Game.findById(gameObjectId);
    if (!game) {
      return res.status(404).json({
        error: 'Game not found',
      });
    }

    // Add to queue (depth type is enforced by TypeScript)
    const queue = getAnalysisQueue();
    const job = queue.addJob(gameObjectId, depth);

    // Get estimated time
    const estimatedTime = queue.getEstimatedTime(gameObjectId);

    return res.status(202).json({
      message: 'Game queued for analysis',
      job: {
        gameId: job.gameId,
        depth: job.depth,
        status: job.status,
        createdAt: job.createdAt,
        estimatedTimeSeconds: estimatedTime,
      },
      game: {
        white: game.white,
        black: game.black,
        result: game.result,
        datePlayed: game.datePlayed,
      },
    });
  } catch (error) {
    console.error('Error queueing analysis:', error);
    return res.status(500).json({
      error: 'Failed to queue analysis',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get analysis status for a game
 * GET /api/analysis/status/:gameId
 */
export const getAnalysisStatus = async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    // Validate gameId
    if (!Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({
        error: 'Invalid game ID format',
      });
    }

    const gameObjectId = new Types.ObjectId(gameId);

    // Check queue
    const queue = getAnalysisQueue();
    const job = queue.getJobStatus(gameObjectId);

    if (!job) {
      return res.status(404).json({
        error: 'No analysis job found for this game',
      });
    }

    const estimatedTime = queue.getEstimatedTime(gameObjectId);

    return res.json({
      gameId: job.gameId,
      status: job.status,
      depth: job.depth,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      estimatedTimeSeconds: estimatedTime,
    });
  } catch (error) {
    console.error('Error getting analysis status:', error);
    return res.status(500).json({
      error: 'Failed to get analysis status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get queue statistics
 * GET /api/analysis/queue/stats
 */
export const getQueueStats = async (req: Request, res: Response) => {
  try {
    const queue = getAnalysisQueue();
    const stats = queue.getQueueStats();

    return res.json(stats);
  } catch (error) {
    console.error('Error getting queue stats:', error);
    return res.status(500).json({
      error: 'Failed to get queue stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Clear finished jobs from queue
 * DELETE /api/analysis/queue/finished
 */
export const clearFinishedJobs = async (req: Request, res: Response) => {
  try {
    const queue = getAnalysisQueue();
    const cleared = queue.clearFinishedJobs();

    return res.json({
      message: `Cleared ${cleared} finished jobs`,
      cleared,
    });
  } catch (error) {
    console.error('Error clearing finished jobs:', error);
    return res.status(500).json({
      error: 'Failed to clear finished jobs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
