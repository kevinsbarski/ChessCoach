/**
 * Position Utilities
 *
 * Functions for analyzing chess positions: material calculation,
 * sacrifice detection, game phase determination, and position assessment.
 */

import { PIECE_VALUES } from './thresholds';

/**
 * Calculate material count from FEN position
 *
 * @param fen - Position in FEN notation
 * @param color - 'w' for white, 'b' for black
 * @returns Total material value
 */
export function calculateMaterial(fen: string, color: 'w' | 'b'): number {
  const position = fen.split(' ')[0]; // Get piece placement from FEN
  let material = 0;

  for (const char of position) {
    // White pieces are uppercase, black are lowercase
    const isWhite = char === char.toUpperCase();
    const piece = char.toLowerCase();

    if (color === 'w' && isWhite && piece in PIECE_VALUES) {
      material += PIECE_VALUES[piece as keyof typeof PIECE_VALUES];
    } else if (color === 'b' && !isWhite && piece in PIECE_VALUES) {
      material += PIECE_VALUES[piece as keyof typeof PIECE_VALUES];
    }
  }

  return material;
}

/**
 * Detect if a move involved a material sacrifice
 *
 * @param fenBefore - Position before the move
 * @param fenAfter - Position after the move
 * @param playerColor - 'w' or 'b'
 * @returns Object with sacrifice info
 */
export function detectSacrifice(
  fenBefore: string,
  fenAfter: string,
  playerColor: 'w' | 'b'
): { isSacrifice: boolean; materialLost: number } {
  const materialBefore = calculateMaterial(fenBefore, playerColor);
  const materialAfter = calculateMaterial(fenAfter, playerColor);

  const materialLost = materialBefore - materialAfter;

  // Sacrifice if material decreased (typically 2+ points for minor piece)
  // Don't count single pawn losses as sacrifices
  const isSacrifice = materialLost >= 2;

  return {
    isSacrifice,
    materialLost,
  };
}

/**
 * Determine game phase based on move number and material
 *
 * @param moveNumber - Current move number
 * @param fen - Position in FEN notation
 * @returns Game phase
 */
export function determineGamePhase(moveNumber: number, fen: string): 'opening' | 'middlegame' | 'endgame' {
  // Simple heuristic based on move number and material
  const totalMaterial = calculateMaterial(fen, 'w') + calculateMaterial(fen, 'b');

  // Opening: First 10-15 moves typically
  if (moveNumber <= 12) {
    return 'opening';
  }

  // Endgame: Low material remaining (less than ~13 points total)
  // This usually means only a few pieces left
  if (totalMaterial <= 13) {
    return 'endgame';
  }

  // Middlegame: Everything else
  return 'middlegame';
}

/**
 * Check if position is competitive (not already winning/losing heavily)
 * Required for brilliant move classification
 *
 * @param winChance - Current win probability (0.0-1.0)
 * @returns True if position is competitive
 */
export function isPositionCompetitive(winChance: number): boolean {
  // Position is competitive if between ~20% and ~80% win probability
  // Chess.com uses proprietary thresholds; this is an approximation
  return winChance >= 0.20 && winChance <= 0.80;
}

/**
 * Check if position is already winning
 *
 * @param winChance - Current win probability (0.0-1.0)
 * @returns True if position is already winning
 */
export function isPositionWinning(winChance: number): boolean {
  // Position is winning if > ~75% win probability
  return winChance > 0.75;
}

/**
 * Check if position is losing
 *
 * @param winChance - Current win probability (0.0-1.0)
 * @returns True if position is losing
 */
export function isPositionLosing(winChance: number): boolean {
  // Position is losing if < ~25% win probability
  return winChance < 0.25;
}
