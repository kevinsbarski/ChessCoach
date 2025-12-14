/**
 * Games Query Controller
 * Handles retrieving games from the database
 */

import { Request, Response } from 'express';
import { Game } from '../models';

/**
 * Get stored games for a user (with optional filters)
 * GET /api/games/:username?analyzed=true&limit=20&skip=0
 */
export async function getUserGames(req: Request, res: Response): Promise<void> {
  try {
    const { username } = req.params;
    const { analyzed, limit = '20', skip = '0', timeClass } = req.query;

    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    // Build query filter
    const filter: any = { chessComUsername: username };

    if (analyzed !== undefined) {
      filter.analyzed = analyzed === 'true';
    }

    if (timeClass) {
      // Note: We don't store timeClass in the Game model yet
      // This can be added if needed
    }

    // Fetch games from database
    const games = await Game.find(filter)
      .sort({ datePlayed: -1 })
      .limit(parseInt(limit as string))
      .skip(parseInt(skip as string))
      .lean();

    const total = await Game.countDocuments(filter);

    res.json({
      message: 'Games retrieved successfully',
      username,
      total,
      returned: games.length,
      games
    });
  } catch (error) {
    console.error('Error fetching user games:', error);
    res.status(500).json({
      error: 'Failed to fetch games',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get a specific game by ID
 * GET /api/games/by-id/:id
 */
export async function getGameById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Game ID is required' });
      return;
    }

    const game = await Game.findById(id).lean();

    if (!game) {
      res.status(404).json({ error: 'Game not found' });
      return;
    }

    res.json({
      message: 'Game retrieved successfully',
      game
    });
  } catch (error) {
    console.error('Error fetching game by ID:', error);
    res.status(500).json({
      error: 'Failed to fetch game',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
