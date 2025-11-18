import { Router } from 'express';
import {
  queueAnalysis,
  getAnalysisStatus,
  getAnalysis,
  getUserSummary,
  getQueueStats,
  clearFinishedJobs,
  deleteAnalysis,
} from '../controllers/analysis.controller';

const router = Router();

/**
 * Analysis Routes
 * Base path: /api/analysis
 */

// Queue a game for analysis
// POST /api/analysis/game/:gameId?depth=fast
router.post('/game/:gameId', queueAnalysis);

// Get analysis results
// GET /api/analysis/game/:gameId
router.get('/game/:gameId', getAnalysis);

// Get analysis status
// GET /api/analysis/status/:gameId
router.get('/status/:gameId', getAnalysisStatus);

// Get user summary across all games
// GET /api/analysis/summary/:username
router.get('/summary/:username', getUserSummary);

// Get queue statistics
// GET /api/analysis/queue/stats
router.get('/queue/stats', getQueueStats);

// Clear finished jobs from queue
// DELETE /api/analysis/queue/finished
router.delete('/queue/finished', clearFinishedJobs);

// Delete analysis for a game
// DELETE /api/analysis/game/:gameId
router.delete('/game/:gameId', deleteAnalysis);

export default router;
