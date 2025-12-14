/**
 * Game Service
 * Shared utilities for game operations
 */

import { Game } from '../models/Game';
import { ParsedGame } from './chesscom.service';

/**
 * Save parsed games to database (avoiding duplicates)
 * Used by both the API controller and CLI
 */
export async function saveGamesWithDuplicateCheck(
  username: string,
  games: ParsedGame[]
): Promise<{ saved: number; duplicates: number }> {
  let saved = 0;
  let duplicates = 0;

  for (const game of games) {
    try {
      // Check if game already exists
      const exists = await Game.findOne({ gameId: game.gameId });

      if (exists) {
        duplicates++;
        continue;
      }

      // Create new game document with all fields
      await Game.create({
        chessComUsername: username.toLowerCase(),
        gameId: game.gameId,
        pgn: game.pgn,
        white: game.white,
        black: game.black,
        result: game.result,
        datePlayed: game.datePlayed,
        analyzed: false,
        // Time control data
        timeControl: game.timeControl,
        timeClass: game.timeClass,
        whiteRating: game.whiteRating,
        blackRating: game.blackRating,
        // Opening data
        opening: game.opening,
        eco: game.eco
      });

      saved++;
    } catch (error) {
      console.error(`Error saving game ${game.gameId}:`, error);
      // Continue with next game even if one fails
    }
  }

  return { saved, duplicates };
}
