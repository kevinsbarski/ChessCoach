import { Router } from 'express';
import {
  fetchCurrentMonth,
  fetchSpecificMonth,
  getArchives,
} from '../controllers/games-fetch.controller';
import {
  getUserGames,
  getGameById,
} from '../controllers/games-query.controller';

const router = Router();

/**
 * Game Routes
 * All routes prefixed with /api/games
 */

// Fetch games from Chess.com
router.post('/fetch/:username', fetchCurrentMonth);
router.post('/fetch/:username/:year/:month', fetchSpecificMonth);
router.get('/archives/:username', getArchives);

// Query stored games
router.get('/by-id/:id', getGameById);
router.get('/:username', getUserGames);

export default router;
