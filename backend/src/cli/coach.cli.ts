import dotenv from 'dotenv';
dotenv.config();

import * as readline from 'readline';
import { connectDatabase } from '../config/database';
import { CoachService } from '../services/coaching';
import { ClaudeProvider } from '../services/coaching/providers/claude.provider';

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
  console.log('║  /help  - Show this help message                          ║');
  console.log('║  /quit  - Exit the coaching session                       ║');
  console.log('║  /reset - Clear conversation (not implemented yet)        ║');
  console.log('║                                                           ║');
  console.log('║  Just type your question to chat with the coach!          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('\n');
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

      // Handle commands
      if (input === '/quit' || input === '/exit') {
        console.log('\n👋 Thanks for using Chess Coach AI. Keep improving!\n');
        running = false;
        break;
      }

      if (input === '/help') {
        printHelp();
        continue;
      }

      if (input === '/reset') {
        console.log('\n⚠️  Reset functionality not implemented yet.\n');
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
