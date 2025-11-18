import { Chess } from 'chess.js';
import { Types } from 'mongoose';
import { getStockfishEngine, DepthPreset } from './stockfish.service';
import { Analysis } from '../models/Analysis';
import { Game } from '../models/Game';
import { IMoveAnalysis, IAnalysisSummary } from '../types';

/**
 * Move classification thresholds (centipawn loss)
 * Based on Chess.com and Lichess standards
 */
const CLASSIFICATION_THRESHOLDS = {
  EXCELLENT: 10,    // 0-10 cp loss
  GOOD: 50,         // 10-50 cp loss
  INACCURACY: 100,  // 50-100 cp loss
  MISTAKE: 200,     // 100-200 cp loss
  // BLUNDER: > 200 cp loss
} as const;

/**
 * Classify a move based on centipawn loss
 */
function classifyMove(cpLoss: number, missedMate: boolean): IMoveAnalysis['classification'] {
  if (missedMate) return 'missed_mate';
  if (cpLoss <= CLASSIFICATION_THRESHOLDS.EXCELLENT) return 'excellent';
  if (cpLoss <= CLASSIFICATION_THRESHOLDS.GOOD) return 'good';
  if (cpLoss <= CLASSIFICATION_THRESHOLDS.INACCURACY) return 'inaccuracy';
  if (cpLoss <= CLASSIFICATION_THRESHOLDS.MISTAKE) return 'mistake';
  return 'blunder';
}

/**
 * Calculate accuracy percentage (Chess.com style)
 * Formula: 100 - (avgCpLoss / 2.5)
 * Capped between 0 and 100
 */
function calculateAccuracy(avgCpLoss: number): number {
  const accuracy = 100 - (avgCpLoss / 2.5);
  return Math.max(0, Math.min(100, accuracy));
}

/**
 * Estimate performance rating based on evaluation
 * This is a simplified estimation - actual performance rating
 * would require opponent rating and game outcome
 */
function estimatePerformanceRating(
  avgEvaluation: number,
  playerRating?: number
): number | undefined {
  if (!playerRating) return undefined;

  // Convert average evaluation to rating adjustment
  // Roughly: 100 cp = 100 rating points
  const ratingAdjustment = avgEvaluation / 100;

  return Math.round(playerRating + ratingAdjustment);
}

/**
 * Game Analysis Service
 * Analyzes chess games using Stockfish engine
 */
export class GameAnalysisService {
  /**
   * Analyze a complete chess game
   * @param gameId - MongoDB ObjectId of the game
   * @param depthPreset - Analysis depth (fast/balanced/thorough)
   * @returns Analysis document saved to database
   */
  async analyzeGame(
    gameId: Types.ObjectId,
    depthPreset: DepthPreset = 'fast'
  ): Promise<typeof Analysis.prototype> {
    console.log(`🔍 Starting analysis for game ${gameId} (depth: ${depthPreset})`);

    // Fetch game from database
    const game = await Game.findById(gameId);
    if (!game) {
      throw new Error(`Game not found: ${gameId}`);
    }

    // Check if already analyzed
    const existingAnalysis = await Analysis.findOne({ gameId });
    if (existingAnalysis) {
      console.log('⚠️ Game already analyzed, returning existing analysis');
      return existingAnalysis;
    }

    // Initialize chess.js with the PGN
    const chess = new Chess();

    try {
      chess.loadPgn(game.pgn);
    } catch (error) {
      throw new Error(`Invalid PGN: ${error}`);
    }

    // Get move history before resetting the board
    const history = chess.history({ verbose: true });

    // Reset to starting position and prepare Stockfish
    const stockfish = await getStockfishEngine();
    chess.reset();

    if (history.length === 0) {
      throw new Error('No moves found in game');
    }

    console.log(`📊 Analyzing ${history.length} moves...`);

    // Track move analyses
    const moveAnalyses: IMoveAnalysis[] = [];
    let totalCpLoss = 0;
    let moveCount = 0;

    // Counters for summary
    const summary = {
      excellent: 0,
      good: 0,
      inaccuracies: 0,
      mistakes: 0,
      blunders: 0,
      missedMates: 0,
    };

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

      // Analyze position with Stockfish
      const analysis = await stockfish.analyzePosition(fenBefore, depthPreset);

      // Store evaluation from current player's perspective
      // White wants positive, black wants negative
      const evalBefore = currentPlayer === 'w'
        ? analysis.evaluation
        : -analysis.evaluation;

      // Apply the actual move
      chess.move(move);
      const fenAfter = chess.fen();

      // Get evaluation after the move (from opponent's perspective now)
      const analysisAfter = await stockfish.analyzePosition(fenAfter, depthPreset);

      // Convert to current player's perspective
      // After the move, it's the opponent's turn, so flip sign
      const evalAfter = currentPlayer === 'w'
        ? -analysisAfter.evaluation
        : analysisAfter.evaluation;

      // Calculate centipawn loss
      // Loss = how much the position got worse for the current player
      const cpLoss = Math.max(0, evalBefore - evalAfter);

      // Check for missed mate
      const missedMate = analysis.mateIn !== undefined && analysis.bestMove !== move.from + move.to;

      // Classify the move
      const classification = classifyMove(cpLoss, missedMate);

      // Update summary counters
      if (classification === 'excellent') summary.excellent++;
      else if (classification === 'good') summary.good++;
      else if (classification === 'inaccuracy') summary.inaccuracies++;
      else if (classification === 'mistake') summary.mistakes++;
      else if (classification === 'blunder') summary.blunders++;
      // Note: missed_mate is counted separately below

      if (missedMate) summary.missedMates++;

      // Track total CP loss for average
      totalCpLoss += cpLoss;
      moveCount++;

      // Store move analysis
      moveAnalyses.push({
        moveNumber: Math.floor(i / 2) + 1,
        move: move.san,
        fen: fenAfter,
        evalBefore,
        evalAfter,
        cpLoss,
        classification,
        bestMove: analysis.bestMove,
        bestLine: analysis.bestLine,
      });

      // Progress logging
      if ((i + 1) % 10 === 0) {
        console.log(`  ✓ Analyzed ${i + 1}/${history.length} moves`);
      }
    }

    // Calculate summary statistics
    const avgCpLoss = moveCount > 0 ? totalCpLoss / moveCount : 0;
    const accuracy = calculateAccuracy(avgCpLoss);

    const analysisSummary: IAnalysisSummary = {
      totalMoves: moveCount,
      excellent: summary.excellent,
      good: summary.good,
      inaccuracies: summary.inaccuracies,
      mistakes: summary.mistakes,
      blunders: summary.blunders,
      avgCpLoss,
      accuracy,
      performanceRating: undefined, // Could be calculated if we have player rating
      missedMates: summary.missedMates,
    };

    console.log(`✅ Analysis complete!`);
    console.log(`   Accuracy: ${accuracy.toFixed(1)}%`);
    console.log(`   Avg CP Loss: ${avgCpLoss.toFixed(1)}`);
    console.log(`   Excellent: ${summary.excellent}, Good: ${summary.good}, Inaccuracies: ${summary.inaccuracies}`);
    console.log(`   Mistakes: ${summary.mistakes}, Blunders: ${summary.blunders}, Missed Mates: ${summary.missedMates}`);

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

    console.log(`💾 Analysis saved to database`);

    return analysisDoc;
  }

  /**
   * Get analysis for a game (if it exists)
   */
  async getAnalysis(gameId: Types.ObjectId) {
    return await Analysis.findOne({ gameId }).populate('gameId');
  }

  /**
   * Get summary statistics for all analyzed games by a user
   */
  async getUserSummary(username: string) {
    // Find all games for the user
    const games = await Game.find({
      chessComUsername: username,
      analyzed: true
    });

    if (games.length === 0) {
      return {
        gamesAnalyzed: 0,
        message: 'No analyzed games found for this user',
      };
    }

    // Get analyses for these games
    const gameIds = games.map(g => g._id);
    const analyses = await Analysis.find({ gameId: { $in: gameIds } });

    // Aggregate statistics
    let totalAccuracy = 0;
    let totalExcellent = 0;
    let totalGood = 0;
    let totalInaccuracies = 0;
    let totalMistakes = 0;
    let totalBlunders = 0;
    let totalMissedMates = 0;
    let totalAvgCpLoss = 0;

    for (const analysis of analyses) {
      totalAccuracy += analysis.summary.accuracy;
      totalExcellent += analysis.summary.excellent;
      totalGood += analysis.summary.good;
      totalInaccuracies += analysis.summary.inaccuracies;
      totalMistakes += analysis.summary.mistakes;
      totalBlunders += analysis.summary.blunders;
      totalMissedMates += analysis.summary.missedMates;
      totalAvgCpLoss += analysis.summary.avgCpLoss;
    }

    const count = analyses.length;

    return {
      gamesAnalyzed: count,
      averageAccuracy: totalAccuracy / count,
      averageExcellent: totalExcellent / count,
      averageGood: totalGood / count,
      averageInaccuracies: totalInaccuracies / count,
      averageMistakes: totalMistakes / count,
      averageBlunders: totalBlunders / count,
      totalMissedMates,
      averageCpLoss: totalAvgCpLoss / count,
    };
  }

  /**
   * Delete analysis for a game
   */
  async deleteAnalysis(gameId: Types.ObjectId) {
    const analysis = await Analysis.findOneAndDelete({ gameId });

    if (analysis) {
      // Update game to mark as not analyzed
      await Game.findByIdAndUpdate(gameId, {
        analyzed: false,
        analyzedAt: undefined,
      });
    }

    return analysis;
  }
}

/**
 * Global analysis service instance
 */
let globalAnalysisService: GameAnalysisService | null = null;

export function getAnalysisService(): GameAnalysisService {
  if (!globalAnalysisService) {
    globalAnalysisService = new GameAnalysisService();
  }
  return globalAnalysisService;
}
