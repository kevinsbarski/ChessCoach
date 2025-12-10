/**
 * Backfill Opening Data Script
 *
 * This script updates existing games that don't have opening/eco fields
 * by parsing the PGN headers.
 *
 * Usage: npx ts-node src/scripts/backfill-openings.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { connectDatabase, disconnectDatabase } from '../config/database';
import { Game } from '../models/Game';

/**
 * Extract a specific header value from PGN
 */
function extractPgnHeader(pgn: string, headerName: string): string | undefined {
  const regex = new RegExp(`\\[${headerName}\\s+"([^"]*)"\\]`, 'i');
  const match = pgn.match(regex);
  return match ? match[1] : undefined;
}

/**
 * Main backfill function
 */
async function backfillOpenings(): Promise<void> {
  console.log('🚀 Starting opening data backfill...\n');

  // Find games without opening data
  const gamesToUpdate = await Game.find({
    $or: [
      { opening: { $exists: false } },
      { opening: null },
      { eco: { $exists: false } },
      { eco: null }
    ]
  });

  console.log(`📊 Found ${gamesToUpdate.length} games to update\n`);

  if (gamesToUpdate.length === 0) {
    console.log('✅ All games already have opening data!');
    return;
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const game of gamesToUpdate) {
    try {
      const opening = extractPgnHeader(game.pgn, 'Opening');
      const eco = extractPgnHeader(game.pgn, 'ECO');

      if (!opening && !eco) {
        // PGN doesn't have opening info
        skipped++;
        continue;
      }

      await Game.updateOne(
        { _id: game._id },
        {
          $set: {
            ...(opening && { opening }),
            ...(eco && { eco })
          }
        }
      );

      updated++;

      // Progress log every 100 games
      if (updated % 100 === 0) {
        console.log(`  Progress: ${updated} updated...`);
      }
    } catch (error) {
      errors++;
      console.error(`  Error updating game ${game.gameId}:`, error);
    }
  }

  console.log('\n📈 Backfill Results:');
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ⏭️  Skipped (no opening in PGN): ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
}

/**
 * Run the script
 */
async function main(): Promise<void> {
  try {
    // Connect to database
    await connectDatabase();

    // Run backfill
    await backfillOpenings();

    console.log('\n✅ Backfill complete!');
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  } finally {
    // Disconnect from database
    await disconnectDatabase();
  }
}

// Run if called directly
main();
