/**
 * Utils Module
 *
 * Barrel export for all utility functions and constants.
 */

// Constants and thresholds
export {
  LICHESS_WIN_RATE_COEFFICIENT,
  CLASSIFICATION_THRESHOLDS,
  PIECE_VALUES,
} from './thresholds';

// Evaluation utilities (win chance calculations)
export {
  centipawnsToWinPercent,
  centipawnsToWinProbability,
  calculateExpectedPointsLost,
  adjustForMateDistance,
} from './evaluation-utils';

// Position utilities (material, sacrifice, game phase)
export {
  calculateMaterial,
  detectSacrifice,
  determineGamePhase,
  isPositionCompetitive,
  isPositionWinning,
  isPositionLosing,
} from './position-utils';

// Opening book utilities (local Polyglot book)
export {
  isBookPosition,
  isBookMove,
  rateLimitDelay,
  clearBookCache,
} from './opening-book';
