import { Request, Response } from 'express';
import { Game } from '../models';
import { ChessComService, ParsedGame } from '../services/chesscom.service';

/**
 * Games Controller
 * Handles all game-related API endpoints
 */
export class GamesController {
  /**
   * Fetch and store games from Chess.com for current month
   * POST /api/games/fetch/:username
   */
  static async fetchCurrentMonth(req: Request, res: Response): Promise<void> {
    try {
      const { username } = req.params;

      if (!username) {
        res.status(400).json({ error: 'Username is required' });
        return;
      }

      console.log(`📥 Fetching current month games for: ${username}`);

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
      const result = await GamesController.saveGames(username, parsedGames);

      res.json({
        message: 'Games fetched successfully',
        username,
        gamesFound: parsedGames.length,
        gamesStored: result.saved,
        gamesDuplicate: result.duplicates
      });
    } catch (error) {
      console.error('❌ Error fetching current month games:', error);
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
  static async fetchSpecificMonth(req: Request, res: Response): Promise<void> {
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

      console.log(`📥 Fetching games for: ${username} (${year}/${month})`);

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
      const result = await GamesController.saveGames(username, parsedGames);

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
      console.error('❌ Error fetching specific month games:', error);
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
  static async getArchives(req: Request, res: Response): Promise<void> {
    try {
      const { username } = req.params;

      if (!username) {
        res.status(400).json({ error: 'Username is required' });
        return;
      }

      console.log(`📋 Fetching archives list for: ${username}`);

      const archives = await ChessComService.getAvailableMonths(username);

      res.json({
        message: 'Archives fetched successfully',
        username,
        totalMonths: archives.length,
        archives
      });
    } catch (error) {
      console.error('❌ Error fetching archives:', error);
      res.status(500).json({
        error: 'Failed to fetch archives',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get stored games for a user (with optional filters)
   * GET /api/games/:username?analyzed=true&limit=20&skip=0
   */
  static async getUserGames(req: Request, res: Response): Promise<void> {
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
      console.error('❌ Error fetching user games:', error);
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
  static async getGameById(req: Request, res: Response): Promise<void> {
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
      console.error('❌ Error fetching game by ID:', error);
      res.status(500).json({
        error: 'Failed to fetch game',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Helper: Save games to database (avoiding duplicates)
   */
  private static async saveGames(
    username: string,
    parsedGames: ParsedGame[]
  ): Promise<{ saved: number; duplicates: number }> {
    let saved = 0;
    let duplicates = 0;

    for (const parsedGame of parsedGames) {
      try {
        // Check if game already exists
        const existingGame = await Game.findOne({ gameId: parsedGame.gameId });

        if (existingGame) {
          duplicates++;
          continue;
        }

        // Create new game document
        await Game.create({
          chessComUsername: username,
          gameId: parsedGame.gameId,
          pgn: parsedGame.pgn,
          white: parsedGame.white,
          black: parsedGame.black,
          result: parsedGame.result,
          datePlayed: parsedGame.datePlayed,
          analyzed: false
        });

        saved++;
      } catch (error) {
        console.error(`⚠️ Error saving game ${parsedGame.gameId}:`, error);
        // Continue with next game even if one fails
      }
    }

    console.log(`✅ Saved ${saved} new games, ${duplicates} duplicates skipped`);

    return { saved, duplicates };
  }
}
