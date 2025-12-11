/**
 * Quick test script to verify Polyglot opening book is working
 */

import { isBookPosition, isBookMove } from '../services/utils/opening-book';

async function test() {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  console.log('Testing Polyglot opening book...\n');

  // Test starting position
  const isStartBook = await isBookPosition(startFen);
  console.log('Starting position is book position:', isStartBook);
  if (!isStartBook) {
    console.error('❌ FAILED: Starting position should be in book!');
  }

  // Test common opening moves from starting position (UCI format)
  const moves = ['e2e4', 'd2d4', 'g1f3', 'c2c4'];
  let bookMovesFound = 0;
  for (const move of moves) {
    const isBook = await isBookMove(startFen, move);
    console.log(`Move ${move} is book move: ${isBook}`);
    if (isBook) bookMovesFound++;
  }

  // Test position after 1.e4 (should also be in book)
  const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  const isAfterE4Book = await isBookPosition(afterE4);
  console.log(`\nPosition after 1.e4 is in book: ${isAfterE4Book}`);

  // Summary
  console.log('\n--- Summary ---');
  console.log(`Book moves found in starting position: ${bookMovesFound}/${moves.length}`);

  if (isStartBook && bookMovesFound > 0) {
    console.log('\n✅ Polyglot book is working correctly!');
  } else {
    console.log('\n⚠️  Book may not be working - check hash implementation');
  }
}

test().catch(console.error);
