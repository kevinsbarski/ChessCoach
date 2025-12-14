/**
 * Game Analyzer Service
 * Main analysis loop that processes chess games move-by-move
 */

import { Chess } from 'chess.js';
import { Types } from 'mongoose';
import { getStockfishEngine, DepthPreset } from '../stockfish.service';
import { Analysis } from '../../models/Analysis';
import { Game } from '../../models/Game';
import { IMoveAnalysis, IAnalysisSummary, IPerPlayerSummary } from '../../types';
import {
  centipawnsToWinProbability,
  calculateExpectedPointsLost,
  detectSacrifice,
  determineGamePhase,
  adjustForMateDistance,
  isBookMove,
  rateLimitDelay,
} from '../utils';
import { classifyMove } from './move-classifier';

/**
 * Helper to create empty per-player summary
 */
function createEmptyPlayerSummary() {
  return {
    moves: 0,
    brilliant: 0,
    great: 0,
    best: 0,
    excellent: 0,
    good: 0,
    book: 0,
    inaccuracies: 0,
    mistakes: 0,
    misses: 0,
    blunders: 0,
    missedMates: 0,
    avgExpectedPointsLost: 0,
    totalExpectedPointsLost: 0,
  };
}

/**
 * Update player summary counters based on classification
 */
function updateClassificationCount(
  summary: ReturnType<typeof createEmptyPlayerSummary>,
  classification: string
): void {
  const classificationMap: Record<string, keyof ReturnType<typeof createEmptyPlayerSummary>> = {
    brilliant: 'brilliant',
    great: 'great',
    best: 'best',
    excellent: 'excellent',
    good: 'good',
    book: 'book',
    inaccuracy: 'inaccuracies',
    mistake: 'mistakes',
    miss: 'misses',
    blunder: 'blunders',
    missed_mate: 'missedMates',
  };

  const key = classificationMap[classification];
  if (key && typeof summary[key] === 'number') {
    (summary[key] as number)++;
  }
}

/**
 * Analyze a complete chess game with Chess.com-style classification
 */
export async function analyzeGame(
  gameId: Types.ObjectId,
  depthPreset: DepthPreset = 'fast'
): Promise<typeof Analysis.prototype> {
  console.log(`Starting Chess.com-style analysis for game ${gameId} (depth: ${depthPreset})`);

  // Fetch game from database
  const game = await Game.findById(gameId);
  if (!game) {
    throw new Error(`Game not found: ${gameId}`);
  }

  // Check if already analyzed
  const existingAnalysis = await Analysis.findOne({ gameId });
  if (existingAnalysis) {
    console.log('Game already analyzed, returning existing analysis');
    return existingAnalysis;
  }

  // Initialize chess.js with the PGN
  const chess = new Chess();
  try {
    chess.loadPgn(game.pgn);
  } catch (error) {
    throw new Error(`Invalid PGN: ${error}`);
  }

  // Get move history
  const history = chess.history({ verbose: true });
  if (history.length === 0) {
    throw new Error('No moves found in game');
  }

  // Reset to starting position and prepare Stockfish
  const stockfish = await getStockfishEngine();
  chess.reset();

  console.log(`Analyzing ${history.length} moves...`);

  // Track move analyses
  const moveAnalyses: IMoveAnalysis[] = [];

  // Per-player counters
  const whiteSummary = createEmptyPlayerSummary();
  const blackSummary = createEmptyPlayerSummary();

  // Combined counters for summary
  const combinedSummary = createEmptyPlayerSummary();
  let criticalMoments = 0;

  // Track if we've left opening book
  let stillInBook = true;

  // Analyze each move
  for (let i = 0; i < history.length; i++) {
    const move = history[i];

    // Get position BEFORE the move
    chess.reset();
    for (let j = 0; j < i; j++) {
      chess.move(history[j]);
    }

    const fenBefore = chess.fen();
    const currentPlayer = chess.turn(); // 'w' or 'b'
    const moveNumber = Math.floor(i / 2) + 1;

    // Determine game phase
    const gamePhase = determineGamePhase(moveNumber, fenBefore);

    // Analyze position with Stockfish
    const analysisBefore = await stockfish.analyzePosition(fenBefore, depthPreset);

    // Get raw Stockfish evaluations (always from White's perspective)
    const rawEvalBefore = analysisBefore.evaluation;

    // Convert to win probability (always White's perspective)
    const whiteWinBefore = centipawnsToWinProbability(rawEvalBefore);

    // Convert to CURRENT PLAYER's win chance
    const winChanceBefore = currentPlayer === 'w' ? whiteWinBefore : (1 - whiteWinBefore);

    // Apply the actual move
    chess.move(move);
    const fenAfter = chess.fen();

    // Get evaluation after the move
    const analysisAfter = await stockfish.analyzePosition(fenAfter, depthPreset);

    // Get raw evaluation (always from White's perspective)
    const rawEvalAfter = analysisAfter.evaluation;

    // Convert to win probability (always White's perspective)
    const whiteWinAfter = centipawnsToWinProbability(rawEvalAfter);

    // Convert to CURRENT PLAYER's win chance (same player who just moved)
    const winChanceAfter = currentPlayer === 'w' ? whiteWinAfter : (1 - whiteWinAfter);

    // For display purposes, keep eval from player's perspective
    const evalBefore = currentPlayer === 'w' ? rawEvalBefore : -rawEvalBefore;
    const evalAfter = currentPlayer === 'w' ? rawEvalAfter : -rawEvalAfter;

    // Calculate expected points lost
    let expectedPointsLost = calculateExpectedPointsLost(winChanceBefore, winChanceAfter);

    // Adjust for mate-distance scoring
    expectedPointsLost = adjustForMateDistance(
      expectedPointsLost,
      analysisBefore.mateIn,
      analysisAfter.mateIn
    );

    // Detect sacrifice
    const { isSacrifice } = detectSacrifice(fenBefore, fenAfter, currentPlayer);

    // Check if this is the best move
    const isBestMove = move.from + move.to === analysisBefore.bestMove;

    // If this is the best move with nearly zero loss, consider all alternatives worse
    const allAlternativesWorse = isBestMove && expectedPointsLost < 0.005;

    // Detect missed opportunity (miss):
    // Best move creates significant advantage but player's move keeps position neutral
    const bestMoveCreatesAdvantage =
      rawEvalBefore > 150 || // +1.5 or better from current player's perspective
      analysisBefore.mateIn !== undefined;
    const playedMoveIsNeutral = Math.abs(rawEvalAfter) < 100; // Position stays ~equal
    const moveWasntBad = expectedPointsLost < 0.05; // Less than inaccuracy threshold
    const missedOpportunity =
      bestMoveCreatesAdvantage &&
      playedMoveIsNeutral &&
      !isBestMove &&
      moveWasntBad;

    // Check if this is a book move (only if still in book and in opening phase)
    let isBook = false;
    if (stillInBook && gamePhase === 'opening') {
      try {
        // Local Polyglot book lookup - no rate limiting needed
        // UCI format: "e2e4" or "e7e8q" for promotions
        const uciMove = move.from + move.to + (move.promotion || '');
        isBook = await isBookMove(fenBefore, uciMove);
        if (!isBook) {
          stillInBook = false; // Once we leave book, don't check anymore
          console.log(`  Left opening book at move ${moveNumber}`);
        }
      } catch (error) {
        console.warn('Book check failed, continuing without:', error);
        stillInBook = false;
      }
    }

    // Classify the move (book moves get 'book' classification)
    const classification = isBook ? 'book' : classifyMove({
      expectedPointsLost,
      winChanceBefore,
      winChanceAfter,
      isSacrifice,
      isBestMove,
      gamePhase,
      mateInBefore: analysisBefore.mateIn,
      mateInAfter: analysisAfter.mateIn,
      allAlternativesWorse,
      missedOpportunity,
    });

    // Determine if this is a critical moment
    const isCritical = expectedPointsLost >= 0.15 || classification === 'brilliant' || classification === 'great';

    // Determine which player made this move
    const playerSummary = currentPlayer === 'w' ? whiteSummary : blackSummary;

    // Update per-player and combined counters
    updateClassificationCount(playerSummary, classification);
    updateClassificationCount(combinedSummary, classification);

    if (isCritical) criticalMoments++;

    // Exclude book moves from EPL calculations
    if (classification !== 'book') {
      // Per-player tracking
      playerSummary.totalExpectedPointsLost += expectedPointsLost;
      playerSummary.moves++;

      // Combined tracking
      combinedSummary.totalExpectedPointsLost += expectedPointsLost;
      combinedSummary.moves++;
    }

    // Store move analysis
    moveAnalyses.push({
      moveNumber,
      move: move.san,
      fen: fenAfter,
      evalBefore,
      evalAfter,
      winChanceBefore,
      winChanceAfter,
      expectedPointsLost,
      classification,
      isBook,
      gamePhase,
      bestMove: analysisBefore.bestMove,
      bestLine: analysisBefore.bestLine,
      isSacrifice,
      isOnlyGoodMove: allAlternativesWorse,
      isCritical,
    });

    // Progress logging
    if ((i + 1) % 10 === 0) {
      console.log(`  Analyzed ${i + 1}/${history.length} moves`);
    }
  }

  // Calculate summary statistics
  const avgExpectedPointsLost =
    combinedSummary.moves > 0 ? combinedSummary.totalExpectedPointsLost / combinedSummary.moves : 0;

  // Calculate per-player average EPL
  const whiteAvgEPL = whiteSummary.moves > 0 ? whiteSummary.totalExpectedPointsLost / whiteSummary.moves : 0;
  const blackAvgEPL = blackSummary.moves > 0 ? blackSummary.totalExpectedPointsLost / blackSummary.moves : 0;

  // Build per-player summary objects
  const whiteFinalSummary: IPerPlayerSummary = {
    moves: whiteSummary.moves,
    brilliant: whiteSummary.brilliant,
    great: whiteSummary.great,
    best: whiteSummary.best,
    excellent: whiteSummary.excellent,
    good: whiteSummary.good,
    book: whiteSummary.book,
    inaccuracies: whiteSummary.inaccuracies,
    mistakes: whiteSummary.mistakes,
    misses: whiteSummary.misses,
    blunders: whiteSummary.blunders,
    missedMates: whiteSummary.missedMates,
    avgExpectedPointsLost: whiteAvgEPL,
  };

  const blackFinalSummary: IPerPlayerSummary = {
    moves: blackSummary.moves,
    brilliant: blackSummary.brilliant,
    great: blackSummary.great,
    best: blackSummary.best,
    excellent: blackSummary.excellent,
    good: blackSummary.good,
    book: blackSummary.book,
    inaccuracies: blackSummary.inaccuracies,
    mistakes: blackSummary.mistakes,
    misses: blackSummary.misses,
    blunders: blackSummary.blunders,
    missedMates: blackSummary.missedMates,
    avgExpectedPointsLost: blackAvgEPL,
  };

  const analysisSummary: IAnalysisSummary = {
    totalMoves: history.length,
    white: whiteFinalSummary,
    black: blackFinalSummary,
    brilliant: combinedSummary.brilliant,
    great: combinedSummary.great,
    best: combinedSummary.best,
    excellent: combinedSummary.excellent,
    good: combinedSummary.good,
    book: combinedSummary.book,
    inaccuracies: combinedSummary.inaccuracies,
    mistakes: combinedSummary.mistakes,
    misses: combinedSummary.misses,
    blunders: combinedSummary.blunders,
    missedMates: combinedSummary.missedMates,
    avgExpectedPointsLost,
    performanceRating: undefined,
    numberOfCriticalMoments: criticalMoments,
  };

  console.log(`Analysis complete!`);
  console.log(`   White - EPL: ${(whiteAvgEPL * 100).toFixed(1)}% | Black - EPL: ${(blackAvgEPL * 100).toFixed(1)}%`);
  console.log(`   White - Brilliant: ${whiteSummary.brilliant}, Best: ${whiteSummary.best}, Excellent: ${whiteSummary.excellent}, Good: ${whiteSummary.good}`);
  console.log(`   White - Inaccuracies: ${whiteSummary.inaccuracies}, Mistakes: ${whiteSummary.mistakes}, Blunders: ${whiteSummary.blunders}`);
  console.log(`   Black - Brilliant: ${blackSummary.brilliant}, Best: ${blackSummary.best}, Excellent: ${blackSummary.excellent}, Good: ${blackSummary.good}`);
  console.log(`   Black - Inaccuracies: ${blackSummary.inaccuracies}, Mistakes: ${blackSummary.mistakes}, Blunders: ${blackSummary.blunders}`);

  // Save to database
  const analysisDoc = new Analysis({
    gameId,
    engineDepth: depthPreset === 'fast' ? 15 : depthPreset === 'balanced' ? 20 : 25,
    engineVersion: 'Stockfish 17.1',
    moves: moveAnalyses,
    summary: analysisSummary,
  });

  await analysisDoc.save();

  // Mark game as analyzed
  game.analyzed = true;
  game.analyzedAt = new Date();
  await game.save();

  console.log(`Analysis saved to database`);

  return analysisDoc;
}
