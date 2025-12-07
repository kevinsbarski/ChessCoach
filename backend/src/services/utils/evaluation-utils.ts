/**
 * Evaluation Utilities
 *
 * Functions for converting engine evaluations to win probabilities
 * and calculating expected points lost.
 */

import { LICHESS_WIN_RATE_COEFFICIENT } from './thresholds';

/**
 * Convert centipawn evaluation to win percentage (0-100)
 *
 * Lichess formula: Win% = 50 + 50 × (2 / (1 + exp(-0.00368208 × centipawns)) - 1)
 *
 * @param centipawns - Engine evaluation in centipawns (positive = white advantage)
 * @returns Win percentage from 0 (black certain win) to 100 (white certain win)
 */
export function centipawnsToWinPercent(centipawns: number): number {
  // Handle mate scores (values > 10000 indicate mate)
  if (centipawns > 10000) return 100;
  if (centipawns < -10000) return 0;

  // Lichess formula with their coefficient
  // Note: This always returns White's winning percentage
  // 0 = Black certain win, 100 = White certain win
  return 50 + 50 * (2 / (1 + Math.exp(-LICHESS_WIN_RATE_COEFFICIENT * centipawns)) - 1);
}

/**
 * Convert centipawn evaluation to win probability (0.0-1.0)
 * Legacy function for backwards compatibility
 *
 * @param centipawns - Engine evaluation in centipawns
 * @returns Win probability from 0.0 to 1.0
 */
export function centipawnsToWinProbability(centipawns: number): number {
  return centipawnsToWinPercent(centipawns) / 100;
}

/**
 * Calculate expected points lost for a move
 *
 * @param winChanceBefore - Win probability before the move (0.0-1.0)
 * @param winChanceAfter - Win probability after the move (0.0-1.0)
 * @returns Expected points lost (0.0-1.0), capped at 0 minimum
 */
export function calculateExpectedPointsLost(
  winChanceBefore: number,
  winChanceAfter: number
): number {
  // Expected points lost = how much worse the position got
  // Negative value means position improved
  return Math.max(0, winChanceBefore - winChanceAfter);
}

/**
 * Adjust accuracy calculation for mate-distance scoring
 * When checkmate sequences are involved, adjust evaluation
 *
 * @param expectedPointsLost - Base expected points lost
 * @param mateInBefore - Mate in N moves before the move (undefined if no mate)
 * @param mateInAfter - Mate in N moves after the move (undefined if no mate)
 * @returns Adjusted expected points lost
 */
export function adjustForMateDistance(
  expectedPointsLost: number,
  mateInBefore?: number,
  mateInAfter?: number
): number {
  // If had forced mate and lost it entirely, massive penalty
  if (mateInBefore !== undefined && mateInAfter === undefined) {
    return Math.max(expectedPointsLost, 0.5); // At least 50% loss
  }

  // If found forced mate when didn't have one, reward
  if (mateInBefore === undefined && mateInAfter !== undefined) {
    return 0; // Perfect move
  }

  // Both positions have mate - check for side-switch or mate getting longer
  if (mateInBefore !== undefined && mateInAfter !== undefined) {
    // CATASTROPHIC: Mate switched sides (you had mate -> opponent has mate)
    // mateInBefore > 0 means we were mating, mateInAfter < 0 means opponent is now mating
    const hadMateForUs = mateInBefore > 0;
    const opponentHasMate = mateInAfter < 0;
    if (hadMateForUs && opponentHasMate) {
      return 1.0; // Maximum penalty - went from mating to getting mated
    }

    // Mate got longer (same side, but more moves needed)
    if (mateInBefore > 0 && mateInAfter > 0 && mateInAfter > mateInBefore) {
      // Mate still for us but got longer, small penalty
      return Math.min(expectedPointsLost + 0.05, 0.1);
    }
  }

  return expectedPointsLost;
}
