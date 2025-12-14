/**
 * Opening Book Service
 * Detects book moves using Lichess Opening Explorer API
 */

// Lichess API response types
interface LichessExplorerResponse {
  white: number;
  draws: number;
  black: number;
  moves: Array<{
    san: string;
    uci: string;
    white: number;
    draws: number;
    black: number;
  }>;
  opening?: {
    eco: string;
    name: string;
  };
}

// Simple in-memory cache for book positions
const bookCache = new Map<string, boolean>();

/**
 * Check if a position exists in the Lichess master games database
 * @param fen - The FEN string of the position
 * @returns true if the position has been played in master games
 */
export async function isBookPosition(fen: string): Promise<boolean> {
  // Check cache first
  if (bookCache.has(fen)) {
    return bookCache.get(fen)!;
  }

  try {
    const response = await fetch(
      `https://explorer.lichess.org/masters?fen=${encodeURIComponent(fen)}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn(`Lichess API error: ${response.status}`);
      return false;
    }

    const data = (await response.json()) as LichessExplorerResponse;
    const totalGames = (data.white || 0) + (data.draws || 0) + (data.black || 0);
    const isBook = totalGames > 0;

    // Cache the result
    bookCache.set(fen, isBook);

    return isBook;
  } catch (error) {
    console.warn('Failed to check Lichess opening database:', error);
    return false;
  }
}

/**
 * Check if a specific move is a book move in the given position
 * @param fen - The FEN string of the position BEFORE the move
 * @param move - The move in SAN or UCI format
 * @returns true if this move has been played in master games from this position
 */
export async function isBookMove(fen: string, move: string): Promise<boolean> {
  const cacheKey = `${fen}:${move}`;

  if (bookCache.has(cacheKey)) {
    return bookCache.get(cacheKey)!;
  }

  try {
    const response = await fetch(
      `https://explorer.lichess.org/masters?fen=${encodeURIComponent(fen)}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as LichessExplorerResponse;

    // Check if the move exists in the moves array
    const moves = data.moves || [];
    const isBook = moves.some((m) => m.san === move || m.uci === move);

    bookCache.set(cacheKey, isBook);
    return isBook;
  } catch (error) {
    console.warn('Failed to check Lichess opening database:', error);
    return false;
  }
}

/**
 * Small delay for rate limiting (Lichess allows ~15 req/sec)
 */
export function rateLimitDelay(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 70));
}

/**
 * Clear the book cache (useful for testing)
 */
export function clearBookCache(): void {
  bookCache.clear();
}
