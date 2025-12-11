import dotenv from 'dotenv';
dotenv.config();

import * as readline from 'readline';
import { connectDatabase } from '../config/database';
import { CoachService } from '../services/coaching';
import { ClaudeProvider } from '../services/coaching/providers/claude.provider';
import { ChessComService } from '../services/chesscom.service';
import { Game } from '../models/Game';
import { analyzeGame } from '../services/analysis';
import { deleteAnalysis } from '../services/analysis/stats-aggregator';
import { ICoachingSession } from '../types/coaching.types';

/**
 * Print ASCII art banner for Chess Coach AI
 */
function printBanner(): void {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║              ♔  CHESS COACH AI  ♚                        ║');
  console.log('║                                                           ║');
  console.log('║         Your Personal AI Chess Analysis Coach            ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('\n');
}

/**
 * Print available commands
 */
function printHelp(): void {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                     Available Commands                    ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║  /status          - Show game counts (fetched/analyzed)   ║');
  console.log('║  /fetch [count]   - Fetch latest games from Chess.com    ║');
  console.log('║  /analyze [count] - Analyze games with Stockfish         ║');
  console.log('║  /reset [count]   - Clear analysis to re-analyze games   ║');
  console.log('║  /refresh         - Reload context after fetch/analyze   ║');
  console.log('║  /help            - Show this help message               ║');
  console.log('║  /quit            - Exit the coaching session            ║');
  console.log('║                                                           ║');
  console.log('║  Just type your question to chat with the coach!          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('\n');
}

/**
 * Handle /status command - Show game counts
 */
async function handleStatus(username: string): Promise<void> {
  const totalGames = await Game.countDocuments({ chessComUsername: username.toLowerCase() });
  const analyzedGames = await Game.countDocuments({ chessComUsername: username.toLowerCase(), analyzed: true });
  const lastGame = await Game.findOne({ chessComUsername: username.toLowerCase() }).sort({ datePlayed: -1 });

  const percentage = totalGames > 0 ? Math.round((analyzedGames / totalGames) * 100) : 0;

  console.log(`\n📊 Status for ${username}:`);
  console.log(`   • Total games: ${totalGames}`);
  console.log(`   • Analyzed: ${analyzedGames} (${percentage}%)`);
  console.log(`   • Last game: ${lastGame?.datePlayed?.toLocaleDateString() || 'N/A'}\n`);
}

/**
 * Save parsed games to database
 */
async function saveGamesToDb(username: string, games: any[]): Promise<{ saved: number; duplicates: number }> {
  let saved = 0;
  let duplicates = 0;

  for (const game of games) {
    const exists = await Game.findOne({ gameId: game.gameId });
    if (exists) {
      duplicates++;
      continue;
    }
    await Game.create({ ...game, chessComUsername: username.toLowerCase() });
    saved++;
  }

  return { saved, duplicates };
}

/**
 * Handle /fetch command - Fetch games from Chess.com
 */
async function handleFetch(username: string, count: number = 50): Promise<void> {
  console.log(`\n⏳ Fetching latest games from Chess.com...`);

  try {
    const games = await ChessComService.fetchCurrentMonthGames(username);
    const gamesToSave = games.slice(0, count);
    const { saved, duplicates } = await saveGamesToDb(username, gamesToSave);

    console.log(`✓ Found ${saved} new games (${duplicates} already in database)\n`);
  } catch (error) {
    if (error instanceof Error) {
      console.log(`❌ Failed to fetch games: ${error.message}\n`);
    } else {
      console.log('❌ Failed to fetch games: Unknown error\n');
    }
  }
}

/**
 * Handle /analyze command - Analyze games with Stockfish
 */
async function handleAnalyze(username: string, count: number = 5): Promise<void> {
  console.log(`\n⏳ Finding unanalyzed games...`);

  const unanalyzed = await Game.find({
    chessComUsername: username.toLowerCase(),
    analyzed: { $ne: true }
  }).sort({ datePlayed: -1 }).limit(count);

  if (unanalyzed.length === 0) {
    console.log('✓ All games already analyzed!\n');
    return;
  }

  console.log(`   Found ${unanalyzed.length} games to analyze (this may take a few minutes)...`);

  let completed = 0;
  for (const game of unanalyzed) {
    try {
      await analyzeGame((game as any)._id, 'fast');
      completed++;
      process.stdout.write(`\r   Analyzed ${completed}/${unanalyzed.length}...`);
    } catch (error) {
      console.log(`\n   ⚠️ Failed to analyze game ${(game as any)._id}`);
    }
  }

  const total = await Game.countDocuments({ chessComUsername: username.toLowerCase(), analyzed: true });
  console.log(`\n✓ Analyzed ${completed} games (${total} total now)\n`);
}

/**
 * Handle /refresh command - Reload coaching context
 */
async function handleRefresh(
  coachService: CoachService,
  session: ICoachingSession
): Promise<ICoachingSession> {
  console.log('\n⏳ Reloading coaching context...');

  const newSession = await coachService.startSession(session.username);

  console.log(`✓ Context reloaded with ${newSession.context.analyzedGames} analyzed games\n`);
  return newSession;
}

/**
 * Handle /reset command - Clear analysis data for re-analysis
 */
async function handleReset(username: string, count: number): Promise<void> {
  // Find analyzed games
  const query = {
    chessComUsername: username.toLowerCase(),
    analyzed: true
  };

  const totalAnalyzed = await Game.countDocuments(query);

  if (totalAnalyzed === 0) {
    console.log('\n✓ No analyzed games to reset.\n');
    return;
  }

  // Determine how many to reset (0 = all)
  const toReset = count > 0 ? Math.min(count, totalAnalyzed) : totalAnalyzed;

  console.log(`\n⚠️  Resetting analysis for ${toReset} game(s)...`);
  console.log('   Games will need to be re-analyzed with /analyze\n');

  const games = await Game.find(query).limit(toReset);

  let deleted = 0;
  for (const game of games) {
    try {
      await deleteAnalysis((game as any)._id);
      deleted++;
      process.stdout.write(`\r   Resetting ${deleted}/${toReset}...`);
    } catch (error) {
      // Continue even if one fails
    }
  }

  console.log(`\n✓ Reset ${deleted} game(s). Run /analyze to re-analyze.\n`);
}

/**
 * Prompt user for their Chess.com username
 */
async function promptUsername(rl: readline.Interface): Promise<string> {
  return new Promise((resolve) => {
    rl.question('Enter your Chess.com username: ', (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Create a readline interface for user input
 */
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'You: '
  });
}

/**
 * Prompt for user input with a custom question
 */
function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Main CLI application
 */
async function main(): Promise<void> {
  const rl = createReadlineInterface();

  try {
    // Print welcome banner
    printBanner();

    // Connect to database
    console.log('Connecting to database...');
    await connectDatabase();
    console.log('✓ Database connected\n');

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ERROR: ANTHROPIC_API_KEY not found in environment variables.');
      console.error('Please add your Anthropic API key to the .env file:');
      console.error('ANTHROPIC_API_KEY=your_api_key_here\n');
      process.exit(1);
    }

    // Initialize coaching service
    const claudeProvider = new ClaudeProvider();
    const coachService = new CoachService(claudeProvider);

    // Get username from user
    const username = await promptUsername(rl);

    if (!username) {
      console.error('ERROR: Username cannot be empty.');
      process.exit(1);
    }

    console.log(`\nInitializing coaching session for ${username}...\n`);

    // Start coaching session
    let session;
    try {
      session = await coachService.startSession(username);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('No games found')) {
          console.error(`ERROR: No games found for user "${username}".`);
          console.error('Please make sure:');
          console.error('1. The username is correct');
          console.error('2. The user has played games on Chess.com');
          console.error('3. The games have been fetched and analyzed\n');
        } else {
          console.error(`ERROR: ${error.message}`);
        }
      } else {
        console.error('ERROR: An unexpected error occurred while starting the session.');
      }
      process.exit(1);
    }

    // Display session information
    const mostPlayedOpening = session.context.openings.asWhite[0]?.name || session.context.openings.asBlack[0]?.name || 'N/A';
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                   Coaching Session Started                ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log(`║  Username: ${username.padEnd(46)}║`);
    console.log(`║  Total Games: ${String(session.context.totalGames).padEnd(43)}║`);
    console.log(`║  Analyzed Games: ${String(session.context.analyzedGames).padEnd(40)}║`);
    console.log(`║  Most Played Opening: ${mostPlayedOpening.substring(0, 34).padEnd(34)}║`);
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n');
    console.log('Type /help for available commands, or just start chatting!\n');

    // REPL loop
    let running = true;

    while (running) {
      const input = await prompt(rl, 'You: ');

      if (!input) {
        continue;
      }

      // Handle commands (starts with /)
      if (input.startsWith('/')) {
        const [cmd, ...args] = input.split(' ');

        switch (cmd) {
          case '/quit':
          case '/exit':
            console.log('\n👋 Thanks for using Chess Coach AI. Keep improving!\n');
            running = false;
            break;

          case '/help':
            printHelp();
            break;

          case '/status':
            await handleStatus(username);
            break;

          case '/fetch':
            await handleFetch(username, parseInt(args[0]) || 50);
            break;

          case '/analyze':
            await handleAnalyze(username, parseInt(args[0]) || 5);
            break;

          case '/refresh':
            session = await handleRefresh(coachService, session);
            break;

          case '/reset':
            await handleReset(username, parseInt(args[0]) || 0);
            break;

          default:
            console.log(`\n❓ Unknown command: ${cmd}. Type /help for available commands.\n`);
        }
        continue;
      }

      // Stream chat response
      try {
        process.stdout.write('Coach: ');
        await coachService.streamChat(session.sessionId, input, (chunk) => {
          process.stdout.write(chunk);
        });
        console.log('\n');
      } catch (error) {
        console.error('\n');
        if (error instanceof Error) {
          console.error(`ERROR: ${error.message}`);
        } else {
          console.error('ERROR: An unexpected error occurred during chat.');
        }
        console.log('\n');
      }
    }

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n');
    if (error instanceof Error) {
      console.error(`FATAL ERROR: ${error.message}`);
    } else {
      console.error('FATAL ERROR: An unexpected error occurred.');
    }
    console.error('\n');
    rl.close();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down gracefully...\n');
  process.exit(0);
});

// Run the CLI
main();
