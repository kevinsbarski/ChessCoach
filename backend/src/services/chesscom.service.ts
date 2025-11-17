import axios from 'axios';
import { Chess } from 'chess.js';

/**
 * Chess.com API Response Types
 */
interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  end_time: number;
  rated: boolean;
  fen: string;
  time_class: string;
  rules: string;
  white: {
    rating: number;
    result: string;
    '@id': string;
    username: string;
  };
  black: {
    rating: number;
    result: string;
    '@id': string;
    username: string;
  };
}

interface ChessComArchivesResponse {
  archives: string[];
}

interface ChessComGamesResponse {
  games: ChessComGame[];
}

/**
 * Parsed Game Data (ready for our database)
 */
export interface ParsedGame {
  gameId: string;
  pgn: string;
  white: string;
  black: string;
  result: string;
  datePlayed: Date;
  timeControl: string;
  timeClass: string;
  whiteRating: number;
  blackRating: number;
}

/**
 * Chess.com Service
 * Handles all interactions with Chess.com Public API
 */
export class ChessComService {
  private static readonly BASE_URL = 'https://api.chess.com/pub';

  /**
   * Get list of all available game archives for a user
   * Returns URLs to monthly archives
   */
  static async getArchivesList(username: string): Promise<string[]> {
    try {
      const url = `${this.BASE_URL}/player/${username}/games/archives`;
      const response = await axios.get<ChessComArchivesResponse>(url);
      return response.data.archives;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error(`User '${username}' not found on Chess.com`);
      }
      throw new Error(`Failed to fetch archives for ${username}: ${error}`);
    }
  }

  /**
   * Fetch games from a specific month
   */
  static async fetchMonthlyGames(
    username: string,
    year: number,
    month: number
  ): Promise<ParsedGame[]> {
    try {
      // Month should be 2 digits (01-12)
      const monthStr = month.toString().padStart(2, '0');
      const url = `${this.BASE_URL}/player/${username}/games/${year}/${monthStr}`;

      const response = await axios.get<ChessComGamesResponse>(url);
      const games = response.data.games;

      if (!games || games.length === 0) {
        return [];
      }

      return games.map(game => this.parseGame(game, username));
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // No games for this month - return empty array
        return [];
      }
      throw new Error(`Failed to fetch games for ${username} (${year}/${month}): ${error}`);
    }
  }

  /**
   * Fetch games from the current month
   */
  static async fetchCurrentMonthGames(username: string): Promise<ParsedGame[]> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // JavaScript months are 0-indexed

    return this.fetchMonthlyGames(username, year, month);
  }

  /**
   * Fetch games from multiple months (for bulk import)
   */
  static async fetchMultipleMonths(
    username: string,
    startYear: number,
    startMonth: number,
    endYear: number,
    endMonth: number
  ): Promise<ParsedGame[]> {
    const allGames: ParsedGame[] = [];

    let currentYear = startYear;
    let currentMonth = startMonth;

    while (
      currentYear < endYear ||
      (currentYear === endYear && currentMonth <= endMonth)
    ) {
      try {
        const games = await this.fetchMonthlyGames(username, currentYear, currentMonth);
        allGames.push(...games);

        // Move to next month
        if (currentMonth === 12) {
          currentMonth = 1;
          currentYear++;
        } else {
          currentMonth++;
        }
      } catch (error) {
        console.error(`Error fetching ${currentYear}/${currentMonth}:`, error);
        // Continue to next month even if one fails
      }
    }

    return allGames;
  }

  /**
   * Parse a Chess.com game into our format
   */
  private static parseGame(game: ChessComGame, requestedUsername: string): ParsedGame {
    // Extract game ID from URL (e.g., "https://www.chess.com/game/live/123456" -> "123456")
    const gameId = game.url.split('/').pop() || game.url;

    // Determine result from the game PGN or white/black result
    let result = '*'; // Default to ongoing/unknown

    if (game.white.result === 'win') {
      result = '1-0';
    } else if (game.black.result === 'win') {
      result = '0-1';
    } else if (game.white.result === 'agreed' || game.white.result === 'stalemate' ||
               game.white.result === 'repetition' || game.white.result === 'insufficient') {
      result = '1/2-1/2';
    }

    // Convert Unix timestamp to Date
    const datePlayed = new Date(game.end_time * 1000);

    return {
      gameId,
      pgn: game.pgn,
      white: game.white.username,
      black: game.black.username,
      result,
      datePlayed,
      timeControl: game.time_control,
      timeClass: game.time_class,
      whiteRating: game.white.rating,
      blackRating: game.black.rating
    };
  }

  /**
   * Validate PGN format using chess.js
   */
  static validatePGN(pgn: string): boolean {
    try {
      const chess = new Chess();
      chess.loadPgn(pgn);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get available months for a user in a readable format
   */
  static async getAvailableMonths(username: string): Promise<Array<{ year: number; month: number; url: string }>> {
    const archives = await this.getArchivesList(username);

    return archives.map(archiveUrl => {
      // Extract year and month from URL
      // Format: "https://api.chess.com/pub/player/{username}/games/YYYY/MM"
      const parts = archiveUrl.split('/');
      const year = parseInt(parts[parts.length - 2]);
      const month = parseInt(parts[parts.length - 1]);

      return { year, month, url: archiveUrl };
    });
  }
}
