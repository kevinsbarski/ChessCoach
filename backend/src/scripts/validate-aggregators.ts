/**
 * Phase 1 Validation Script
 *
 * Tests all aggregation functions against real database data
 * Run: npx ts-node src/scripts/validate-aggregators.ts [username]
 */

import dotenv from 'dotenv';
dotenv.config();

import { connectDatabase, disconnectDatabase } from '../config/database';
import { Game } from '../models/Game';
import { Analysis } from '../models/Analysis';
import {
  getOpeningRepertoire,
  getPhasePerformance,
  getTimeControlPerformance,
  getTrendOverTime,
  getColorPerformance,
  getWeaknessSummary
} from '../services/analysis';

// ============================================
// Test Utilities
// ============================================

let passCount = 0;
let failCount = 0;

function logPass(testName: string, duration: number, details?: string) {
  passCount++;
  console.log(`  ✅ ${testName} (${duration}ms)`);
  if (details) {
    console.log(`     ${details}`);
  }
}

function logFail(testName: string, error: any) {
  failCount++;
  console.log(`  ❌ ${testName} FAILED`);
  console.log(`     Error: ${error.message || error}`);
}

function logSection(title: string) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(50));
}

// ============================================
// PGN Extraction Tests
// ============================================

/**
 * Local copy of extractPgnHeader for testing
 * (Original is private in ChessComService)
 */
function extractPgnHeader(pgn: string, headerName: string): string | undefined {
  const regex = new RegExp(`\\[${headerName}\\s+"([^"]*)"\\]`, 'i');
  const match = pgn.match(regex);
  return match ? match[1] : undefined;
}

async function testPgnExtraction() {
  logSection('PGN Header Extraction Tests');

  const testCases = [
    {
      name: 'Standard Opening header',
      pgn: '[Opening "Sicilian Defense"]\n1. e4 c5',
      header: 'Opening',
      expected: 'Sicilian Defense'
    },
    {
      name: 'ECO code',
      pgn: '[ECO "B90"]\n1. e4 c5',
      header: 'ECO',
      expected: 'B90'
    },
    {
      name: 'Case insensitive',
      pgn: '[OPENING "Test Opening"]\n1. e4 e5',
      header: 'Opening',
      expected: 'Test Opening'
    },
    {
      name: 'Missing header returns undefined',
      pgn: '[Event "Test"]\n1. e4 e5',
      header: 'Opening',
      expected: undefined
    },
    {
      name: 'Quotes in value',
      pgn: '[Opening "King\'s Gambit"]\n1. e4 e5',
      header: 'Opening',
      expected: "King's Gambit"
    },
    {
      name: 'Full PGN with multiple headers',
      pgn: `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2024.12.10"]
[White "player1"]
[Black "player2"]
[Result "1-0"]
[ECO "B90"]
[Opening "Sicilian Defense: Najdorf Variation"]
[TimeControl "300"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 1-0`,
      header: 'Opening',
      expected: 'Sicilian Defense: Najdorf Variation'
    },
    {
      name: 'Extract ECO from full PGN',
      pgn: `[Event "Live Chess"]
[ECO "B90"]
[Opening "Sicilian Defense"]

1. e4 c5 1-0`,
      header: 'ECO',
      expected: 'B90'
    }
  ];

  for (const tc of testCases) {
    const start = Date.now();
    try {
      const result = extractPgnHeader(tc.pgn, tc.header);
      const duration = Date.now() - start;

      if (result === tc.expected) {
        logPass(tc.name, duration, `Got: "${result}"`);
      } else {
        logFail(tc.name, { message: `Expected "${tc.expected}", got "${result}"` });
      }
    } catch (error) {
      logFail(tc.name, error);
    }
  }
}

// ============================================
// Database Prerequisite Checks
// ============================================

async function checkPrerequisites(username: string) {
  logSection('Database Prerequisites');

  const start = Date.now();

  // Check total games
  const totalGames = await Game.countDocuments({ chessComUsername: username });
  console.log(`  📊 Total games for ${username}: ${totalGames}`);

  // Check analyzed games
  const analyzedGames = await Game.countDocuments({
    chessComUsername: username,
    analyzed: true
  });
  console.log(`  📊 Analyzed games: ${analyzedGames}`);

  // Check games with opening data
  const gamesWithOpening = await Game.countDocuments({
    chessComUsername: username,
    opening: { $exists: true, $ne: null }
  });
  console.log(`  📊 Games with opening data: ${gamesWithOpening}`);

  // Check games with ECO
  const gamesWithEco = await Game.countDocuments({
    chessComUsername: username,
    eco: { $exists: true, $ne: null }
  });
  console.log(`  📊 Games with ECO code: ${gamesWithEco}`);

  // Check games with time class
  const gamesWithTimeClass = await Game.countDocuments({
    chessComUsername: username,
    timeClass: { $exists: true, $ne: null }
  });
  console.log(`  📊 Games with time class: ${gamesWithTimeClass}`);

  // Check analyses
  const analysisCount = await Analysis.countDocuments({});
  console.log(`  📊 Total analysis documents: ${analysisCount}`);

  const duration = Date.now() - start;
  console.log(`  ⏱️  Checks completed in ${duration}ms`);

  if (analyzedGames === 0) {
    console.log('\n  ⚠️  WARNING: No analyzed games found!');
    console.log('     Run game analysis first to populate test data.');
    return false;
  }

  return true;
}

// ============================================
// Aggregation Function Tests
// ============================================

async function testAggregationFunction<T>(
  name: string,
  fn: () => Promise<T>,
  validator: (result: T) => { valid: boolean; details: string }
) {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;

    const validation = validator(result);
    if (validation.valid) {
      logPass(name, duration, validation.details);
    } else {
      logFail(name, { message: validation.details });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logFail(name, error);
    return null;
  }
}

async function testAllAggregations(username: string) {
  logSection('Aggregation Function Tests');

  // Test 1: getOpeningRepertoire
  await testAggregationFunction(
    'getOpeningRepertoire()',
    () => getOpeningRepertoire(username),
    (result) => {
      if (!result || !Array.isArray(result.asWhite) || !Array.isArray(result.asBlack)) {
        return { valid: false, details: 'Missing asWhite or asBlack arrays' };
      }
      const totalOpenings = result.asWhite.length + result.asBlack.length;
      return {
        valid: true,
        details: `Found ${result.asWhite.length} white openings, ${result.asBlack.length} black openings`
      };
    }
  );

  // Test 2: getPhasePerformance
  await testAggregationFunction(
    'getPhasePerformance()',
    () => getPhasePerformance(username),
    (result) => {
      if (!result || !result.opening || !result.middlegame || !result.endgame) {
        return { valid: false, details: 'Missing phase data' };
      }
      const totalMoves = result.opening.totalMoves + result.middlegame.totalMoves + result.endgame.totalMoves;
      return {
        valid: true,
        details: `Opening: ${result.opening.totalMoves} moves, Middlegame: ${result.middlegame.totalMoves}, Endgame: ${result.endgame.totalMoves}`
      };
    }
  );

  // Test 3: getTimeControlPerformance
  await testAggregationFunction(
    'getTimeControlPerformance()',
    () => getTimeControlPerformance(username),
    (result) => {
      if (!result || typeof result !== 'object') {
        return { valid: false, details: 'Invalid result type' };
      }
      const timeControls = Object.keys(result);
      const details = timeControls.map(tc => {
        const stats = (result as any)[tc];
        return `${tc}: ${stats?.games || 0} games`;
      }).join(', ');
      return {
        valid: true,
        details: details || 'No time controls found (may need data with timeClass)'
      };
    }
  );

  // Test 4: getTrendOverTime
  await testAggregationFunction(
    'getTrendOverTime()',
    () => getTrendOverTime(username, 30),
    (result) => {
      if (!result || !Array.isArray(result.periods)) {
        return { valid: false, details: 'Missing periods array' };
      }
      if (!['improving', 'declining', 'stable'].includes(result.trend)) {
        return { valid: false, details: `Invalid trend value: ${result.trend}` };
      }
      return {
        valid: true,
        details: `${result.periods.length} periods, trend: ${result.trend}, improvement rate: ${result.improvementRate.toFixed(2)}%`
      };
    }
  );

  // Test 5: getColorPerformance
  await testAggregationFunction(
    'getColorPerformance()',
    () => getColorPerformance(username),
    (result) => {
      if (!result || !result.asWhite || !result.asBlack) {
        return { valid: false, details: 'Missing color data' };
      }
      const whiteWinRate = (result.asWhite.winRate * 100).toFixed(1);
      const blackWinRate = (result.asBlack.winRate * 100).toFixed(1);
      return {
        valid: true,
        details: `White: ${result.asWhite.games} games (${whiteWinRate}% WR), Black: ${result.asBlack.games} games (${blackWinRate}% WR)`
      };
    }
  );

  // Test 6: getWeaknessSummary (calls all others)
  await testAggregationFunction(
    'getWeaknessSummary()',
    () => getWeaknessSummary(username),
    (result) => {
      if (!result) {
        return { valid: false, details: 'No result returned' };
      }
      if (!['improving', 'declining', 'stable'].includes(result.trend)) {
        return { valid: false, details: `Invalid trend: ${result.trend}` };
      }
      if (!Array.isArray(result.topIssues)) {
        return { valid: false, details: 'Missing topIssues array' };
      }

      const issues = result.topIssues.length;
      const weakPhase = result.weakestPhase;
      const colorStruggle = result.colorStruggle;

      return {
        valid: true,
        details: `Weakest phase: ${weakPhase}, Color struggle: ${colorStruggle}, Issues: ${issues}`
      };
    }
  );
}

// ============================================
// Sample Output Display
// ============================================

async function showSampleOutput(username: string) {
  logSection('Sample Output (getWeaknessSummary)');

  try {
    const summary = await getWeaknessSummary(username);
    console.log('\n' + JSON.stringify(summary, null, 2));
  } catch (error: any) {
    console.log(`  Failed to get sample output: ${error.message}`);
  }
}

// ============================================
// Main
// ============================================

async function main() {
  console.log('\n' + '═'.repeat(50));
  console.log('     PHASE 1 AGGREGATION VALIDATION');
  console.log('═'.repeat(50));

  const args = process.argv.slice(2);
  const pgnOnly = args.includes('--pgn-only');
  const username = args.find(arg => !arg.startsWith('--')) || 'kevinsbarski';

  console.log(`\n  Testing with username: ${username}`);

  // Always run PGN tests (no DB needed)
  await testPgnExtraction();

  if (pgnOnly) {
    logSection('Test Summary (PGN Only Mode)');
    console.log(`  ✅ Passed: ${passCount}`);
    console.log(`  ❌ Failed: ${failCount}`);
    console.log('\n  ℹ️  Run without --pgn-only for full database tests.\n');
    process.exit(failCount > 0 ? 1 : 0);
  }

  try {
    // Connect to database
    console.log('\n  Connecting to database...');
    await connectDatabase();

    // Run tests
    const hasData = await checkPrerequisites(username);

    if (!hasData) {
      console.log('\n  ⛔ Cannot run aggregation tests without analyzed data.');
      console.log('     Please run the analysis pipeline first.\n');
      await disconnectDatabase();
      process.exit(1);
    }

    await testAllAggregations(username);
    await showSampleOutput(username);

    // Summary
    logSection('Test Summary');
    console.log(`  ✅ Passed: ${passCount}`);
    console.log(`  ❌ Failed: ${failCount}`);

    if (failCount === 0) {
      console.log('\n  🎉 All tests passed! Phase 1 code is working.\n');
    } else {
      console.log('\n  ⚠️  Some tests failed. Review errors above.\n');
    }

    await disconnectDatabase();
    process.exit(failCount > 0 ? 1 : 0);

  } catch (error: any) {
    console.error('\n  💥 Fatal error:', error.message);
    console.log('\n  💡 If this is a connection error, try:');
    console.log('     1. Whitelist your IP on MongoDB Atlas');
    console.log('     2. Or run with --pgn-only to test PGN extraction only\n');
    try {
      await disconnectDatabase();
    } catch {}
    process.exit(1);
  }
}

main();
