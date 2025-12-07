import { Router } from 'express';
import {
  queueAnalysis,
  getAnalysisStatus,
  getQueueStats,
  clearFinishedJobs,
} from '../controllers/analysis-queue.controller';
import {
  getAnalysis,
  getUserSummary,
  deleteAnalysis,
} from '../controllers/analysis-results.controller';

const router = Router();

/**
 * Analysis Routes
 * Base path: /api/analysis
 */

// Queue operations
router.post('/game/:gameId', queueAnalysis);
router.get('/status/:gameId', getAnalysisStatus);
router.get('/queue/stats', getQueueStats);
router.delete('/queue/finished', clearFinishedJobs);

// Results operations
router.get('/game/:gameId', getAnalysis);
router.get('/summary/:username', getUserSummary);
router.delete('/game/:gameId', deleteAnalysis);

export default router;
