/**
 * Move Classifier Service
 * Classifies chess moves using Expected Points Loss (EPL)
 */

import { MoveClassification, GamePhase } from '../../types';
import {
  CLASSIFICATION_THRESHOLDS,
  isPositionCompetitive,
  isPositionWinning,
  isPositionLosing,
} from '../utils';

/**
 * Parameters for move classification
 */
export interface ClassifyMoveParams {
  expectedPointsLost: number;
  winChanceBefore: number;
  winChanceAfter: number;
  isSacrifice: boolean;
  isBestMove: boolean;
  gamePhase: GamePhase;
  mateInBefore?: number;
  mateInAfter?: number;
  allAlternativesWorse: boolean;
  missedOpportunity: boolean;
}

/**
 * Classify a move using Expected Points Loss (EPL):
 * - EPL thresholds for all classifications
 * - Position-aware: decisive positions get lenient treatment
 */
export function classifyMove(params: ClassifyMoveParams): MoveClassification {
  const {
    expectedPointsLost,
    winChanceBefore,
    winChanceAfter,
    isSacrifice,
    isBestMove,
    gamePhase,
    mateInBefore,
    mateInAfter,
    allAlternativesWorse,
    missedOpportunity,
  } = params;

  // MISSED MATE: Had forced mate and lost it
  if (mateInBefore !== undefined && mateInAfter === undefined) {
    return 'missed_mate';
  }

  // MISS: Played an okay move but missed a significantly better opportunity
  if (missedOpportunity) {
    return 'miss';
  }

  // BRILLIANT: Material sacrifice that's best/nearly best in competitive position
  if (
    isSacrifice &&
    expectedPointsLost <= CLASSIFICATION_THRESHOLDS.EXCELLENT &&
    isPositionCompetitive(winChanceBefore) &&
    !isPositionWinning(winChanceBefore)
  ) {
    // In endgame, must be only good move
    if (gamePhase === 'endgame') {
      if (allAlternativesWorse) {
        return 'brilliant';
      }
    } else {
      // In opening/middlegame, can be one of several good options
      return 'brilliant';
    }
  }

  // GREAT: Critical move that changes game outcome
  if (
    expectedPointsLost <= CLASSIFICATION_THRESHOLDS.EXCELLENT &&
    allAlternativesWorse
  ) {
    // Converting losing → equal or equal → winning
    const wasLosing = isPositionLosing(winChanceBefore);
    const wasCompetitive = isPositionCompetitive(winChanceBefore);
    const nowWinning = isPositionWinning(winChanceAfter);
    const nowCompetitive = isPositionCompetitive(winChanceAfter);

    if ((wasLosing && nowCompetitive) || (wasCompetitive && nowWinning)) {
      return 'great';
    }
  }

  // Position-aware EPL:
  // If position was already decisive, don't count errors as harshly
  // This prevents "blunder inflation" in already-lost positions
  const wasDecisive = winChanceBefore >= CLASSIFICATION_THRESHOLDS.DECISIVE_WIN_PROB ||
                      winChanceBefore <= CLASSIFICATION_THRESHOLDS.DECISIVE_LOSE_PROB;
  // In decisive positions, cap EPL to 0 for classification - errors don't matter much
  const effectiveEPL = wasDecisive ? 0 : expectedPointsLost;

  // Use EPL thresholds for error classification
  if (effectiveEPL >= CLASSIFICATION_THRESHOLDS.BLUNDER_EPL) {
    return 'blunder';
  }

  if (effectiveEPL >= CLASSIFICATION_THRESHOLDS.MISTAKE_EPL) {
    return 'mistake';
  }

  if (effectiveEPL >= CLASSIFICATION_THRESHOLDS.INACCURACY_EPL) {
    return 'inaccuracy';
  }

  // For good moves, use expected points for fine gradation
  // BEST: Perfect move (essentially 0% expected points loss)
  if (isBestMove && expectedPointsLost < CLASSIFICATION_THRESHOLDS.BEST) {
    return 'best';
  }

  // EXCELLENT: Nearly perfect (0-2% loss)
  if (expectedPointsLost <= CLASSIFICATION_THRESHOLDS.EXCELLENT) {
    return 'excellent';
  }

  // GOOD: Solid move (2-5% loss)
  if (expectedPointsLost <= CLASSIFICATION_THRESHOLDS.GOOD) {
    return 'good';
  }

  // Default: EPL > 5% but < 10% is still inaccuracy
  return 'inaccuracy';
}
