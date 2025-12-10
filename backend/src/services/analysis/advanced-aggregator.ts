/**
 * Advanced Aggregator Service
 * Provides sophisticated aggregations for coaching insights
 *
 * This service does NOT modify stats-aggregator.ts - it's a new layer
 * that provides deeper analysis for the coaching system.
 */

import { Game } from '../../models/Game';
import { Analysis } from '../../models/Analysis';
import {
  IGame,
  IOpeningRepertoire,
  IOpeningStats,
  IPhasePerformance,
  IPhaseStats,
  ITimeControlPerformance,
  ITimeControlStats,
  ITrendAnalysis,
  ITrendPeriod,
  IColorPerformance,
  IColorStats,
  IWeaknessSummary,
  GamePhase,
  MoveClassification
} from '../../types';

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate accuracy from move classifications
 * Accuracy = (brilliant + great + best + excellent + good + book) / total
 */
function calculateAccuracy(
  brilliant: number,
  great: number,
  best: number,
  excellent: number,
  good: number,
  book: number,
  total: number
): number {
  if (total === 0) return 0;
  const goodMoves = brilliant + great + best + excellent + good + book;
  return goodMoves / total;
}

/**
 * Determine if a classification is a "good" move
 */
function isGoodMove(classification: MoveClassification): boolean {
  return ['brilliant', 'great', 'best', 'excellent', 'good', 'book'].includes(classification);
}

// ============================================
// Opening Repertoire Analysis
// ============================================

/**
 * Get opening repertoire statistics for a user
 * Groups games by ECO code and calculates performance metrics
 */
export async function getOpeningRepertoire(username: string): Promise<IOpeningRepertoire> {
  // Get all analyzed games for this user with opening data
  const games = await Game.find<IGame>({
    chessComUsername: username,
    analyzed: true,
    eco: { $exists: true, $ne: null }
  });

  if (games.length === 0) {
    return { asWhite: [], asBlack: [] };
  }

  // Get analyses for these games
  const gameIds = games.map(g => (g as any)._id);
  const analyses = await Analysis.find({ gameId: { $in: gameIds } });
  const analysisMap = new Map(analyses.map(a => [a.gameId.toString(), a]));

  // Group by color and ECO
  const whiteOpenings = new Map<string, { games: typeof games; analyses: typeof analyses }>();
  const blackOpenings = new Map<string, { games: typeof games; analyses: typeof analyses }>();

  for (const game of games) {
    const eco = game.eco!;
    const analysis = analysisMap.get((game as any)._id.toString());
    if (!analysis) continue;

    const isWhite = game.white.toLowerCase() === username.toLowerCase();
    const targetMap = isWhite ? whiteOpenings : blackOpenings;

    if (!targetMap.has(eco)) {
      targetMap.set(eco, { games: [], analyses: [] });
    }
    targetMap.get(eco)!.games.push(game);
    targetMap.get(eco)!.analyses.push(analysis);
  }

  // Calculate stats for each opening
  const calculateOpeningStats = (
    openingsMap: Map<string, { games: typeof games; analyses: typeof analyses }>,
    isWhite: boolean
  ): IOpeningStats[] => {
    const stats: IOpeningStats[] = [];

    for (const [eco, data] of openingsMap) {
      let wins = 0, draws = 0, losses = 0;
      let totalEPL = 0;
      let totalAccuracy = 0;
      const openingName = data.games[0].opening || eco;

      for (let i = 0; i < data.games.length; i++) {
        const game = data.games[i];
        const analysis = data.analyses[i];

        // Count results
        if (game.result === '1-0') {
          isWhite ? wins++ : losses++;
        } else if (game.result === '0-1') {
          isWhite ? losses++ : wins++;
        } else {
          draws++;
        }

        // Get player-specific stats
        const playerSummary = isWhite ? analysis.summary.white : analysis.summary.black;
        totalEPL += playerSummary.avgExpectedPointsLost;

        const accuracy = calculateAccuracy(
          playerSummary.brilliant,
          playerSummary.great,
          playerSummary.best,
          playerSummary.excellent,
          playerSummary.good,
          playerSummary.book,
          playerSummary.moves
        );
        totalAccuracy += accuracy;
      }

      const gamesCount = data.games.length;
      stats.push({
        eco,
        name: openingName,
        games: gamesCount,
        wins,
        draws,
        losses,
        winRate: gamesCount > 0 ? wins / gamesCount : 0,
        avgAccuracy: gamesCount > 0 ? totalAccuracy / gamesCount : 0,
        avgEPL: gamesCount > 0 ? totalEPL / gamesCount : 0
      });
    }

    // Sort by games played (descending)
    return stats.sort((a, b) => b.games - a.games);
  };

  return {
    asWhite: calculateOpeningStats(whiteOpenings, true),
    asBlack: calculateOpeningStats(blackOpenings, false)
  };
}

// ============================================
// Phase Performance Analysis
// ============================================

/**
 * Get performance statistics by game phase (opening/middlegame/endgame)
 */
export async function getPhasePerformance(username: string): Promise<IPhasePerformance> {
  const games = await Game.find<IGame>({
    chessComUsername: username,
    analyzed: true
  });

  const gameIds = games.map(g => (g as any)._id);
  const analyses = await Analysis.find({ gameId: { $in: gameIds } });

  // Initialize phase counters
  const phaseData: Record<GamePhase, {
    totalMoves: number;
    totalEPL: number;
    blunders: number;
    mistakes: number;
    inaccuracies: number;
    brilliantMoves: number;
    goodMoves: number;
  }> = {
    opening: { totalMoves: 0, totalEPL: 0, blunders: 0, mistakes: 0, inaccuracies: 0, brilliantMoves: 0, goodMoves: 0 },
    middlegame: { totalMoves: 0, totalEPL: 0, blunders: 0, mistakes: 0, inaccuracies: 0, brilliantMoves: 0, goodMoves: 0 },
    endgame: { totalMoves: 0, totalEPL: 0, blunders: 0, mistakes: 0, inaccuracies: 0, brilliantMoves: 0, goodMoves: 0 }
  };

  // Create a map of game IDs to determine player color
  const gameMap = new Map(games.map(g => [(g as any)._id.toString(), g]));

  for (const analysis of analyses) {
    const game = gameMap.get(analysis.gameId.toString());
    if (!game) continue;

    const isWhite = game.white.toLowerCase() === username.toLowerCase();

    // Iterate through moves and categorize by phase
    for (let i = 0; i < analysis.moves.length; i++) {
      const move = analysis.moves[i];

      // Only count moves by the player (odd moves for white, even for black)
      const isPlayerMove = (i % 2 === 0) === isWhite;
      if (!isPlayerMove) continue;

      const phase = move.gamePhase;
      phaseData[phase].totalMoves++;
      phaseData[phase].totalEPL += move.expectedPointsLost;

      if (move.classification === 'blunder') phaseData[phase].blunders++;
      if (move.classification === 'mistake') phaseData[phase].mistakes++;
      if (move.classification === 'inaccuracy') phaseData[phase].inaccuracies++;
      if (move.classification === 'brilliant') phaseData[phase].brilliantMoves++;
      if (isGoodMove(move.classification)) phaseData[phase].goodMoves++;
    }
  }

  const buildPhaseStats = (phase: GamePhase): IPhaseStats => {
    const data = phaseData[phase];
    return {
      phase,
      totalMoves: data.totalMoves,
      avgEPL: data.totalMoves > 0 ? data.totalEPL / data.totalMoves : 0,
      accuracy: data.totalMoves > 0 ? data.goodMoves / data.totalMoves : 0,
      blunders: data.blunders,
      mistakes: data.mistakes,
      inaccuracies: data.inaccuracies,
      brilliantMoves: data.brilliantMoves
    };
  };

  return {
    opening: buildPhaseStats('opening'),
    middlegame: buildPhaseStats('middlegame'),
    endgame: buildPhaseStats('endgame')
  };
}

// ============================================
// Time Control Performance Analysis
// ============================================

/**
 * Get performance statistics by time control
 */
export async function getTimeControlPerformance(username: string): Promise<ITimeControlPerformance> {
  const games = await Game.find<IGame>({
    chessComUsername: username,
    analyzed: true,
    timeClass: { $exists: true, $ne: null }
  });

  const gameIds = games.map(g => (g as any)._id);
  const analyses = await Analysis.find({ gameId: { $in: gameIds } });
  const analysisMap = new Map(analyses.map(a => [a.gameId.toString(), a]));

  // Group by time class
  const timeClassData = new Map<string, {
    games: number;
    wins: number;
    draws: number;
    losses: number;
    totalAccuracy: number;
    totalBlunders: number;
    totalEPL: number;
  }>();

  for (const game of games) {
    const timeClass = game.timeClass!;
    const analysis = analysisMap.get((game as any)._id.toString());
    if (!analysis) continue;

    if (!timeClassData.has(timeClass)) {
      timeClassData.set(timeClass, {
        games: 0, wins: 0, draws: 0, losses: 0,
        totalAccuracy: 0, totalBlunders: 0, totalEPL: 0
      });
    }

    const data = timeClassData.get(timeClass)!;
    const isWhite = game.white.toLowerCase() === username.toLowerCase();

    data.games++;

    // Count results
    if (game.result === '1-0') {
      isWhite ? data.wins++ : data.losses++;
    } else if (game.result === '0-1') {
      isWhite ? data.losses++ : data.wins++;
    } else {
      data.draws++;
    }

    // Get player stats
    const playerSummary = isWhite ? analysis.summary.white : analysis.summary.black;
    data.totalBlunders += playerSummary.blunders;
    data.totalEPL += playerSummary.avgExpectedPointsLost;

    const accuracy = calculateAccuracy(
      playerSummary.brilliant,
      playerSummary.great,
      playerSummary.best,
      playerSummary.excellent,
      playerSummary.good,
      playerSummary.book,
      playerSummary.moves
    );
    data.totalAccuracy += accuracy;
  }

  const result: ITimeControlPerformance = {};

  for (const [timeClass, data] of timeClassData) {
    const stats: ITimeControlStats = {
      timeClass,
      games: data.games,
      wins: data.wins,
      draws: data.draws,
      losses: data.losses,
      winRate: data.games > 0 ? data.wins / data.games : 0,
      avgAccuracy: data.games > 0 ? data.totalAccuracy / data.games : 0,
      blunderRate: data.games > 0 ? data.totalBlunders / data.games : 0,
      avgEPL: data.games > 0 ? data.totalEPL / data.games : 0
    };

    (result as any)[timeClass] = stats;
  }

  return result;
}

// ============================================
// Trend Over Time Analysis
// ============================================

/**
 * Get performance trend over time
 * Divides games into periods and calculates metrics for each
 */
export async function getTrendOverTime(
  username: string,
  periodDays: number = 30
): Promise<ITrendAnalysis> {
  const games = await Game.find<IGame>({
    chessComUsername: username,
    analyzed: true
  }).sort({ datePlayed: 1 });

  if (games.length === 0) {
    return {
      periods: [],
      trend: 'stable',
      improvementRate: 0
    };
  }

  const gameIds = games.map(g => (g as any)._id);
  const analyses = await Analysis.find({ gameId: { $in: gameIds } });
  const analysisMap = new Map(analyses.map(a => [a.gameId.toString(), a]));

  // Group games into periods
  const periods: ITrendPeriod[] = [];
  let currentPeriodStart = new Date(games[0].datePlayed);
  let currentPeriodGames: { game: typeof games[0]; analysis: typeof analyses[0] }[] = [];

  const finalizePeriod = () => {
    if (currentPeriodGames.length === 0) return;

    let totalAccuracy = 0;
    let totalBlunders = 0;
    let totalEPL = 0;
    let wins = 0;

    for (const { game, analysis } of currentPeriodGames) {
      const isWhite = game.white.toLowerCase() === username.toLowerCase();
      const playerSummary = isWhite ? analysis.summary.white : analysis.summary.black;

      const accuracy = calculateAccuracy(
        playerSummary.brilliant,
        playerSummary.great,
        playerSummary.best,
        playerSummary.excellent,
        playerSummary.good,
        playerSummary.book,
        playerSummary.moves
      );

      totalAccuracy += accuracy;
      totalBlunders += playerSummary.blunders;
      totalEPL += playerSummary.avgExpectedPointsLost;

      // Count wins
      if ((game.result === '1-0' && isWhite) || (game.result === '0-1' && !isWhite)) {
        wins++;
      }
    }

    const count = currentPeriodGames.length;
    const periodEnd = new Date(currentPeriodStart);
    periodEnd.setDate(periodEnd.getDate() + periodDays - 1);

    periods.push({
      startDate: new Date(currentPeriodStart),
      endDate: periodEnd,
      games: count,
      avgAccuracy: totalAccuracy / count,
      blunderRate: totalBlunders / count,
      avgEPL: totalEPL / count,
      winRate: wins / count
    });
  };

  for (const game of games) {
    const analysis = analysisMap.get((game as any)._id.toString());
    if (!analysis) continue;

    const gameDate = new Date(game.datePlayed);
    const daysDiff = Math.floor((gameDate.getTime() - currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff >= periodDays) {
      // Finalize current period and start new one
      finalizePeriod();
      currentPeriodStart = new Date(gameDate);
      currentPeriodGames = [];
    }

    currentPeriodGames.push({ game, analysis });
  }

  // Finalize last period
  finalizePeriod();

  // Calculate trend
  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  let improvementRate = 0;

  if (periods.length >= 2) {
    const firstPeriod = periods[0];
    const lastPeriod = periods[periods.length - 1];
    const accuracyChange = lastPeriod.avgAccuracy - firstPeriod.avgAccuracy;

    improvementRate = (accuracyChange / periods.length) * 100; // % per period

    if (accuracyChange > 0.02) { // More than 2% improvement
      trend = 'improving';
    } else if (accuracyChange < -0.02) { // More than 2% decline
      trend = 'declining';
    }
  }

  return { periods, trend, improvementRate };
}

// ============================================
// Color Performance Analysis
// ============================================

/**
 * Get performance statistics by color (white vs black)
 */
export async function getColorPerformance(username: string): Promise<IColorPerformance> {
  const games = await Game.find<IGame>({
    chessComUsername: username,
    analyzed: true
  });

  const gameIds = games.map(g => (g as any)._id);
  const analyses = await Analysis.find({ gameId: { $in: gameIds } });
  const analysisMap = new Map(analyses.map(a => [a.gameId.toString(), a]));

  const whiteData = { games: 0, wins: 0, draws: 0, losses: 0, totalAccuracy: 0, totalEPL: 0 };
  const blackData = { games: 0, wins: 0, draws: 0, losses: 0, totalAccuracy: 0, totalEPL: 0 };

  for (const game of games) {
    const analysis = analysisMap.get((game as any)._id.toString());
    if (!analysis) continue;

    const isWhite = game.white.toLowerCase() === username.toLowerCase();
    const data = isWhite ? whiteData : blackData;
    const playerSummary = isWhite ? analysis.summary.white : analysis.summary.black;

    data.games++;

    // Count results
    if (game.result === '1-0') {
      isWhite ? data.wins++ : data.losses++;
    } else if (game.result === '0-1') {
      isWhite ? data.losses++ : data.wins++;
    } else {
      data.draws++;
    }

    // Calculate accuracy
    const accuracy = calculateAccuracy(
      playerSummary.brilliant,
      playerSummary.great,
      playerSummary.best,
      playerSummary.excellent,
      playerSummary.good,
      playerSummary.book,
      playerSummary.moves
    );

    data.totalAccuracy += accuracy;
    data.totalEPL += playerSummary.avgExpectedPointsLost;
  }

  const buildColorStats = (data: typeof whiteData): IColorStats => ({
    games: data.games,
    wins: data.wins,
    draws: data.draws,
    losses: data.losses,
    winRate: data.games > 0 ? data.wins / data.games : 0,
    avgAccuracy: data.games > 0 ? data.totalAccuracy / data.games : 0,
    avgEPL: data.games > 0 ? data.totalEPL / data.games : 0
  });

  return {
    asWhite: buildColorStats(whiteData),
    asBlack: buildColorStats(blackData)
  };
}

// ============================================
// Weakness Summary (Coaching Insights)
// ============================================

/**
 * Get a summary of player weaknesses for coaching
 * Combines all other analyses into actionable insights
 */
export async function getWeaknessSummary(username: string): Promise<IWeaknessSummary> {
  // Gather all data
  const [openings, phases, timeControls, trends, colors] = await Promise.all([
    getOpeningRepertoire(username),
    getPhasePerformance(username),
    getTimeControlPerformance(username),
    getTrendOverTime(username),
    getColorPerformance(username)
  ]);

  const topIssues: string[] = [];

  // Find weakest/strongest opening
  const allOpenings = [...openings.asWhite, ...openings.asBlack].filter(o => o.games >= 3);
  let weakestOpening: IWeaknessSummary['weakestOpening'] = null;
  let strongestOpening: IWeaknessSummary['strongestOpening'] = null;

  if (allOpenings.length > 0) {
    const sorted = [...allOpenings].sort((a, b) => a.winRate - b.winRate);
    const worst = sorted[0];
    const best = sorted[sorted.length - 1];

    if (worst.winRate < 0.4) {
      weakestOpening = { eco: worst.eco, name: worst.name, winRate: worst.winRate };
      topIssues.push(`${worst.name} (${worst.eco}): ${(worst.winRate * 100).toFixed(0)}% win rate - consider alternatives`);
    }
    if (best.winRate > 0.5) {
      strongestOpening = { eco: best.eco, name: best.name, winRate: best.winRate };
    }
  }

  // Find weakest/strongest phase
  const phaseArray = [phases.opening, phases.middlegame, phases.endgame];
  const sortedPhases = [...phaseArray].sort((a, b) => b.avgEPL - a.avgEPL);
  const weakestPhase = sortedPhases[0].phase;
  const strongestPhase = sortedPhases[sortedPhases.length - 1].phase;

  // Add phase insight
  const weakPhaseData = sortedPhases[0];
  const strongPhaseData = sortedPhases[sortedPhases.length - 1];
  const phaseDiff = ((weakPhaseData.avgEPL - strongPhaseData.avgEPL) * 100).toFixed(1);
  if (parseFloat(phaseDiff) > 2) {
    topIssues.push(`${weakestPhase} is ${phaseDiff}% worse than ${strongestPhase} - focus on ${weakestPhase} training`);
  }

  // Find worst/best time control
  const timeControlArray = Object.values(timeControls).filter(tc => tc && tc.games >= 3) as ITimeControlStats[];
  let worstTimeControl: string | null = null;
  let bestTimeControl: string | null = null;

  if (timeControlArray.length > 0) {
    const sortedTC = [...timeControlArray].sort((a, b) => a.winRate - b.winRate);
    worstTimeControl = sortedTC[0].timeClass;
    bestTimeControl = sortedTC[sortedTC.length - 1].timeClass;

    // Add time control insight if there's a significant difference
    if (sortedTC.length >= 2) {
      const worstTC = sortedTC[0];
      const bestTC = sortedTC[sortedTC.length - 1];
      const blunderDiff = worstTC.blunderRate - bestTC.blunderRate;

      if (blunderDiff > 0.5) {
        topIssues.push(`${worstTC.timeClass}: ${worstTC.blunderRate.toFixed(1)} blunders/game vs ${bestTC.blunderRate.toFixed(1)} in ${bestTC.timeClass}`);
      }
    }
  }

  // Color struggle
  let colorStruggle: 'white' | 'black' | 'none' = 'none';
  const colorDiff = Math.abs(colors.asWhite.winRate - colors.asBlack.winRate);

  if (colorDiff > 0.1) { // More than 10% difference
    colorStruggle = colors.asWhite.winRate < colors.asBlack.winRate ? 'white' : 'black';
    const struggleColor = colorStruggle === 'white' ? colors.asWhite : colors.asBlack;
    const betterColor = colorStruggle === 'white' ? colors.asBlack : colors.asWhite;
    topIssues.push(`As ${colorStruggle}: ${(struggleColor.winRate * 100).toFixed(0)}% win rate vs ${(betterColor.winRate * 100).toFixed(0)}% as ${colorStruggle === 'white' ? 'black' : 'white'}`);
  }

  // Add trend insight
  if (trends.trend === 'improving') {
    topIssues.push(`Trending upward: +${trends.improvementRate.toFixed(1)}% accuracy improvement per period`);
  } else if (trends.trend === 'declining') {
    topIssues.push(`Trending downward: ${trends.improvementRate.toFixed(1)}% accuracy decline per period`);
  }

  return {
    weakestOpening,
    strongestOpening,
    weakestPhase,
    strongestPhase,
    worstTimeControl,
    bestTimeControl,
    trend: trends.trend,
    colorStruggle,
    topIssues
  };
}
