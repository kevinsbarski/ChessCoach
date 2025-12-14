/**
 * Thresholds and Constants for Chess Analysis
 *
 * Contains classification thresholds and piece values used throughout the analysis system.
 */

/**
 * Lichess win rate coefficient for centipawn to win% conversion
 */
export const LICHESS_WIN_RATE_COEFFICIENT = 0.00368208;

/**
 * Move classification thresholds
 *
 * Uses Expected Points Loss (EPL) for all classifications.
 * EPL measures the percentage of winning chance lost by a move.
 *
 * Approximate conversions from centipawns:
 * - 300cp ≈ 20% EPL (blunder)
 * - 100cp ≈ 10% EPL (mistake)
 * - 50cp ≈ 5% EPL (inaccuracy)
 */
export const CLASSIFICATION_THRESHOLDS = {
  // Expected points loss thresholds for errors
  BLUNDER_EPL: 0.20,    // 20%+ win chance lost - major error
  MISTAKE_EPL: 0.10,    // 10-20% win chance lost - significant error
  INACCURACY_EPL: 0.05, // 5-10% win chance lost - small error

  // Expected points loss thresholds for good moves
  BEST: 0.001,          // Essentially perfect (accounts for floating point)
  EXCELLENT: 0.02,      // 0-2% expected points loss
  GOOD: 0.05,           // 2-5% expected points loss

  // Position awareness - moves in decisive positions are treated leniently
  // When win probability is already >80% or <20%, further errors matter less
  DECISIVE_WIN_PROB: 0.80,  // Position is decisively winning
  DECISIVE_LOSE_PROB: 0.20, // Position is decisively losing
} as const;

/**
 * Material values for sacrifice detection
 */
export const PIECE_VALUES = {
  p: 1,   // Pawn
  n: 3,   // Knight
  b: 3,   // Bishop
  r: 5,   // Rook
  q: 9,   // Queen
  k: 0,   // King (not counted)
} as const;
