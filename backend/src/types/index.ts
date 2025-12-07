import { Document, Types } from 'mongoose';

/**
 * Game Document Interface
 * Represents a chess game from Chess.com
 */
export interface IGame extends Document {
  chessComUsername: string;
  gameId: string;
  pgn: string;
  white: string;
  black: string;
  result: string;
  datePlayed: Date;
  analyzed: boolean;
  analyzedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Chess.com-style move classifications
 */
export type MoveClassification =
  | 'brilliant'     // Material sacrifice that's best/nearly best in competitive position
  | 'great'         // Critical move changing game outcome
  | 'best'          // Optimal engine move (0% expected points loss)
  | 'excellent'     // Nearly optimal (0-2% expected points loss)
  | 'good'          // Solid move (2-5% expected points loss)
  | 'book'          // Move from opening theory database
  | 'inaccuracy'    // Suboptimal (5-10% expected points loss)
  | 'mistake'       // Significantly weakening (10-20% expected points loss)
  | 'miss'          // Missed opportunity without position worsening
  | 'blunder'       // Material loss or forced mate (20%+ expected points loss)
  | 'missed_mate';  // Failed to find forced checkmate

/**
 * Game phase types
 */
export type GamePhase = 'opening' | 'middlegame' | 'endgame';

/**
 * Single Move Analysis
 */
export interface IMoveAnalysis {
  moveNumber: number;
  move: string;
  fen: string;

  // Evaluation data
  evalBefore: number;              // Centipawns before move
  evalAfter: number;               // Centipawns after move

  // Expected Points Model (Lichess style)
  winChanceBefore: number;         // Win probability before move (0.0-1.0)
  winChanceAfter: number;          // Win probability after move (0.0-1.0)
  expectedPointsLost: number;      // Win probability lost (0.0-1.0)

  // Move classification
  classification: MoveClassification;
  isBook: boolean;                 // Is this move from opening theory?
  gamePhase: GamePhase;            // Which phase of the game

  // Engine suggestions
  bestMove?: string;
  bestLine?: string[];

  // Special flags
  isSacrifice?: boolean;           // Material sacrificed for this move
  isOnlyGoodMove?: boolean;        // Only move that doesn't worsen position
  isCritical?: boolean;            // Critical moment in the game
  missedTactic?: string;           // Description of missed tactical opportunity
}

/**
 * Per-Player Statistics (Chess.com style - separate stats for White and Black)
 */
export interface IPerPlayerSummary {
  moves: number;                 // Total moves for this player

  // Move counts by classification
  brilliant: number;
  great: number;
  best: number;
  excellent: number;
  good: number;
  book: number;
  inaccuracies: number;
  mistakes: number;
  misses: number;
  blunders: number;
  missedMates: number;

  // Metrics
  avgExpectedPointsLost: number;
}

/**
 * Analysis Summary Statistics
 */
export interface IAnalysisSummary {
  totalMoves: number;

  // Per-player statistics (Chess.com style)
  white: IPerPlayerSummary;
  black: IPerPlayerSummary;

  // Combined move counts by classification (for backwards compatibility)
  brilliant: number;             // Brilliant moves (sacrifices)
  great: number;                 // Great moves (critical moments)
  best: number;                  // Perfect moves
  excellent: number;             // Nearly perfect moves
  good: number;                  // Solid moves
  book: number;                  // Opening theory moves
  inaccuracies: number;          // Suboptimal moves
  mistakes: number;              // Significantly weakening moves
  misses: number;                // Missed opportunities
  blunders: number;              // Severe errors
  missedMates: number;           // Missed forced checkmates

  // Combined metrics
  avgExpectedPointsLost: number; // Average win probability lost

  // Additional metrics
  performanceRating?: number;    // Estimated playing strength for this game
  numberOfCriticalMoments: number; // Count of critical positions
}

/**
 * Analysis Document Interface
 * Stores Stockfish analysis results for a game
 */
export interface IAnalysis extends Document {
  gameId: Types.ObjectId;
  engineDepth: number;
  engineVersion: string;
  moves: IMoveAnalysis[];
  summary: IAnalysisSummary;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Chat Message Interface
 */
export interface IChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * ChatHistory Document Interface
 * Stores conversations with AI coach
 */
export interface IChatHistory extends Document {
  sessionId: string;
  gameId?: Types.ObjectId;  // Optional: reference to specific game being discussed
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}
