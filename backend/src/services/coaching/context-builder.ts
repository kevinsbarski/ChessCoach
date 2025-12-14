/**
 * Coaching Context Builder
 * Builds coaching context by aggregating player performance data
 */

import { Game } from '../../models/Game';
import {
  getOpeningRepertoire,
  getPhasePerformance,
  getTimeControlPerformance,
  getTrendOverTime,
  getColorPerformance,
  getWeaknessSummary
} from '../analysis/advanced-aggregator';
import { ICoachingContext } from '../../types/coaching.types';

/**
 * Build coaching context for a player
 * Calls all aggregation functions in parallel and combines the results
 *
 * @param username - Chess.com username
 * @returns Promise resolving to complete coaching context
 */
export async function buildCoachingContext(username: string): Promise<ICoachingContext> {
  // Get total game counts
  const totalGames = await Game.countDocuments({ chessComUsername: username });
  const analyzedGames = await Game.countDocuments({
    chessComUsername: username,
    analyzed: true
  });

  // Fetch all aggregations in parallel for performance
  const [summary, openings, phases, colors, trends] = await Promise.all([
    getWeaknessSummary(username),
    getOpeningRepertoire(username),
    getPhasePerformance(username),
    getColorPerformance(username),
    getTrendOverTime(username)
  ]);

  return {
    username,
    totalGames,
    analyzedGames,
    summary,
    openings,
    phases,
    colors,
    trends
  };
}

/**
 * Convert coaching context to a readable string for LLM prompts
 * Formats the aggregated data in a clear, structured way
 *
 * @param ctx - Coaching context to format
 * @returns Formatted string representation of the context
 */
export function contextToPromptString(ctx: ICoachingContext): string {
  const lines: string[] = [];

  // Header
  lines.push(`PLAYER PROFILE: ${ctx.username}`);
  lines.push(`Total Games: ${ctx.totalGames} (${ctx.analyzedGames} analyzed)`);
  lines.push('');

  // Summary insights
  lines.push('KEY INSIGHTS:');
  ctx.summary.topIssues.forEach((issue, idx) => {
    lines.push(`${idx + 1}. ${issue}`);
  });
  lines.push('');

  // Color performance
  lines.push('COLOR PERFORMANCE:');
  lines.push(`As White: ${ctx.colors.asWhite.games} games, ${(ctx.colors.asWhite.winRate * 100).toFixed(1)}% win rate, ${(ctx.colors.asWhite.avgAccuracy * 100).toFixed(1)}% accuracy`);
  lines.push(`As Black: ${ctx.colors.asBlack.games} games, ${(ctx.colors.asBlack.winRate * 100).toFixed(1)}% win rate, ${(ctx.colors.asBlack.avgAccuracy * 100).toFixed(1)}% accuracy`);
  if (ctx.summary.colorStruggle !== 'none') {
    lines.push(`⚠️ Struggling more as ${ctx.summary.colorStruggle}`);
  }
  lines.push('');

  // Phase performance
  lines.push('PERFORMANCE BY GAME PHASE:');
  const phases = [ctx.phases.opening, ctx.phases.middlegame, ctx.phases.endgame];
  phases.forEach(phase => {
    lines.push(`${phase.phase.toUpperCase()}: ${phase.totalMoves} moves, ${(phase.accuracy * 100).toFixed(1)}% accuracy, ${phase.blunders} blunders, ${phase.mistakes} mistakes`);
  });
  lines.push(`Weakest Phase: ${ctx.summary.weakestPhase}`);
  lines.push(`Strongest Phase: ${ctx.summary.strongestPhase}`);
  lines.push('');

  // Opening repertoire
  lines.push('OPENING REPERTOIRE:');

  if (ctx.openings.asWhite.length > 0) {
    lines.push('As White (Top 5):');
    ctx.openings.asWhite.slice(0, 5).forEach((opening, idx) => {
      lines.push(`  ${idx + 1}. ${opening.name} (${opening.eco}): ${opening.games} games, ${(opening.winRate * 100).toFixed(1)}% win rate, ${(opening.avgAccuracy * 100).toFixed(1)}% accuracy`);
    });
  } else {
    lines.push('As White: No opening data available');
  }

  if (ctx.openings.asBlack.length > 0) {
    lines.push('As Black (Top 5):');
    ctx.openings.asBlack.slice(0, 5).forEach((opening, idx) => {
      lines.push(`  ${idx + 1}. ${opening.name} (${opening.eco}): ${opening.games} games, ${(opening.winRate * 100).toFixed(1)}% win rate, ${(opening.avgAccuracy * 100).toFixed(1)}% accuracy`);
    });
  } else {
    lines.push('As Black: No opening data available');
  }

  if (ctx.summary.weakestOpening) {
    lines.push(`⚠️ Weakest Opening: ${ctx.summary.weakestOpening.name} (${(ctx.summary.weakestOpening.winRate * 100).toFixed(1)}% win rate)`);
  }
  if (ctx.summary.strongestOpening) {
    lines.push(`✓ Strongest Opening: ${ctx.summary.strongestOpening.name} (${(ctx.summary.strongestOpening.winRate * 100).toFixed(1)}% win rate)`);
  }
  lines.push('');

  // Trend analysis
  lines.push('PERFORMANCE TREND:');
  lines.push(`Overall Trend: ${ctx.trends.trend.toUpperCase()}`);
  if (ctx.trends.improvementRate !== 0) {
    const sign = ctx.trends.improvementRate > 0 ? '+' : '';
    lines.push(`Improvement Rate: ${sign}${ctx.trends.improvementRate.toFixed(1)}% accuracy per period`);
  }
  if (ctx.trends.periods.length > 0) {
    const latest = ctx.trends.periods[ctx.trends.periods.length - 1];
    lines.push(`Recent Performance (latest period): ${latest.games} games, ${(latest.avgAccuracy * 100).toFixed(1)}% accuracy, ${(latest.winRate * 100).toFixed(1)}% win rate`);
  }
  lines.push('');

  return lines.join('\n');
}
