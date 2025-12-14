/**
 * Stats Aggregator Service
 * Aggregates analysis statistics across multiple games
 */

import { Types } from 'mongoose';
import { Analysis } from '../../models/Analysis';
import { Game } from '../../models/Game';

/**
 * Get analysis for a game (if it exists)
 */
export async function getAnalysis(gameId: Types.ObjectId) {
  return await Analysis.findOne({ gameId }).populate('gameId');
}

/**
 * Get summary statistics for all analyzed games by a user
 */
export async function getUserSummary(username: string) {
  const games = await Game.find({
    chessComUsername: username,
    analyzed: true,
  });

  if (games.length === 0) {
    return {
      gamesAnalyzed: 0,
      message: 'No analyzed games found for this user',
    };
  }

  const gameIds = games.map((g) => g._id);
  const analyses = await Analysis.find({ gameId: { $in: gameIds } });

  // Aggregate statistics
  let totalBrilliant = 0;
  let totalGreat = 0;
  let totalBest = 0;
  let totalExcellent = 0;
  let totalGood = 0;
  let totalInaccuracies = 0;
  let totalMistakes = 0;
  let totalMisses = 0;
  let totalBlunders = 0;
  let totalMissedMates = 0;
  let totalAvgExpectedPointsLost = 0;

  for (const analysis of analyses) {
    totalBrilliant += analysis.summary.brilliant;
    totalGreat += analysis.summary.great;
    totalBest += analysis.summary.best;
    totalExcellent += analysis.summary.excellent;
    totalGood += analysis.summary.good;
    totalInaccuracies += analysis.summary.inaccuracies;
    totalMistakes += analysis.summary.mistakes;
    totalMisses += analysis.summary.misses;
    totalBlunders += analysis.summary.blunders;
    totalMissedMates += analysis.summary.missedMates;
    totalAvgExpectedPointsLost += analysis.summary.avgExpectedPointsLost;
  }

  const count = analyses.length;

  return {
    gamesAnalyzed: count,
    averageBrilliant: totalBrilliant / count,
    averageGreat: totalGreat / count,
    averageBest: totalBest / count,
    averageExcellent: totalExcellent / count,
    averageGood: totalGood / count,
    averageInaccuracies: totalInaccuracies / count,
    averageMistakes: totalMistakes / count,
    averageMisses: totalMisses / count,
    averageBlunders: totalBlunders / count,
    totalMissedMates,
    averageExpectedPointsLost: totalAvgExpectedPointsLost / count,
  };
}

/**
 * Delete analysis for a game
 */
export async function deleteAnalysis(gameId: Types.ObjectId) {
  const analysis = await Analysis.findOneAndDelete({ gameId });

  if (analysis) {
    await Game.findByIdAndUpdate(gameId, {
      analyzed: false,
      analyzedAt: undefined,
    });
  }

  return analysis;
}
