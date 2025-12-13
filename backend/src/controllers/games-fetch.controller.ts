/**
 * Games Fetch Controller
 * Handles fetching games from Chess.com API
 */

import { Request, Response } from 'express';
import { ChessComService } from '../services/chesscom.service';
import { saveGamesWithDuplicateCheck } from '../services/game.service';

/**
 * Fetch and store games from Chess.com for current month
 * POST /api/games/fetch/:username
 */
export async function fetchCurrentMonth(req: Request, res: Response): Promise<void> {
  try {
    const { username } = req.params;

    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    console.log(`Fetching current month games for: ${username}`);

    // Fetch games from Chess.com
    const parsedGames = await ChessComService.fetchCurrentMonthGames(username);

    if (parsedGames.length === 0) {
      res.json({
        message: 'No games found for current month',
        username,
        gamesFound: 0,
        gamesStored: 0
      });
      return;
    }

    // Save games to database (avoiding duplicates)
    const result = await saveGamesWithDuplicateCheck(username, parsedGames);

    res.json({
      message: 'Games fetched successfully',
      username,
      gamesFound: parsedGames.length,
      gamesStored: result.saved,
      gamesDuplicate: result.duplicates
    });
  } catch (error) {
    console.error('Error fetching current month games:', error);
    res.status(500).json({
      error: 'Failed to fetch games',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Fetch and store games from a specific month
 * POST /api/games/fetch/:username/:year/:month
 */
export async function fetchSpecificMonth(req: Request, res: Response): Promise<void> {
  try {
    const { username, year, month } = req.params;

    if (!username || !year || !month) {
      res.status(400).json({ error: 'Username, year, and month are required' });
      return;
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      res.status(400).json({ error: 'Invalid year or month' });
      return;
    }

    console.log(`Fetching games for: ${username} (${year}/${month})`);

    // Fetch games from Chess.com
    const parsedGames = await ChessComService.fetchMonthlyGames(username, yearNum, monthNum);

    if (parsedGames.length === 0) {
      res.json({
        message: `No games found for ${year}/${month}`,
        username,
        year: yearNum,
        month: monthNum,
        gamesFound: 0,
        gamesStored: 0
      });
      return;
    }

    // Save games to database
    const result = await saveGamesWithDuplicateCheck(username, parsedGames);

    res.json({
      message: 'Games fetched successfully',
      username,
      year: yearNum,
      month: monthNum,
      gamesFound: parsedGames.length,
      gamesStored: result.saved,
      gamesDuplicate: result.duplicates
    });
  } catch (error) {
    console.error('Error fetching specific month games:', error);
    res.status(500).json({
      error: 'Failed to fetch games',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get available archive months for a user
 * GET /api/games/archives/:username
 */
export async function getArchives(req: Request, res: Response): Promise<void> {
  try {
    const { username } = req.params;

    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    console.log(`Fetching archives list for: ${username}`);

    const archives = await ChessComService.getAvailableMonths(username);

    res.json({
      message: 'Archives fetched successfully',
      username,
      totalMonths: archives.length,
      archives
    });
  } catch (error) {
    console.error('Error fetching archives:', error);
    res.status(500).json({
      error: 'Failed to fetch archives',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
