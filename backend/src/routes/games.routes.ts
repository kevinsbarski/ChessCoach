import { Router } from 'express';
import { GamesController } from '../controllers/games.controller';

const router = Router();

/**
 * Game Routes
 * All routes prefixed with /api/games
 */

// Fetch games from Chess.com
router.post('/fetch/:username', GamesController.fetchCurrentMonth);
router.post('/fetch/:username/:year/:month', GamesController.fetchSpecificMonth);

// Get available archives
router.get('/archives/:username', GamesController.getArchives);

// Get stored games
router.get('/:username', GamesController.getUserGames);
router.get('/by-id/:id', GamesController.getGameById);

export default router;
